import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders={
  "Access-Control-Allow-Origin":"*",
  "Access-Control-Allow-Headers":"authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods":"POST, OPTIONS",
};

const allowedTypes=new Set(["page","product","service","resume","landing","course"]);

function json(data:unknown,status=200){
  return new Response(JSON.stringify(data),{
    status,
    headers:{...corsHeaders,"Content-Type":"application/json","Cache-Control":"no-store"},
  });
}

function clientIp(req:Request){
  const direct=req.headers.get("cf-connecting-ip")?.trim();
  if(direct)return direct;
  const forwarded=req.headers.get("x-forwarded-for")?.split(",")[0]?.trim();
  if(forwarded)return forwarded;
  return req.headers.get("x-real-ip")?.trim()||"";
}

function saoPauloDate(){
  const parts=new Intl.DateTimeFormat("en-CA",{
    timeZone:"America/Sao_Paulo",
    year:"numeric",
    month:"2-digit",
    day:"2-digit",
  }).formatToParts(new Date());
  const values=Object.fromEntries(parts.map(part=>[part.type,part.value]));
  return `${values.year}-${values.month}-${values.day}`;
}

async function hashVisitor(ip:string,date:string,secret:string){
  const key=await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(secret),
    {name:"HMAC",hash:"SHA-256"},
    false,
    ["sign"],
  );
  const signature=await crypto.subtle.sign(
    "HMAC",
    key,
    new TextEncoder().encode(date+"|"+ip),
  );
  return Array.from(new Uint8Array(signature)).map(byte=>byte.toString(16).padStart(2,"0")).join("");
}

function referrerHost(value:string|null){
  if(!value)return null;
  try{
    return new URL(value).hostname.slice(0,180)||null;
  }catch{
    return null;
  }
}

Deno.serve(async req=>{
  if(req.method==="OPTIONS")return new Response("ok",{headers:corsHeaders});
  if(req.method!=="POST")return json({error:"Método não permitido"},405);

  try{
    const body=await req.json().catch(()=>null) as {
      content_type?:string;
      content_key?:string;
      path?:string;
    }|null;

    const contentType=String(body?.content_type||"").trim();
    const contentKey=String(body?.content_key||"").trim();
    const path=String(body?.path||"").trim();

    if(!allowedTypes.has(contentType))return json({error:"Tipo de conteúdo inválido"},400);
    if(!contentKey||contentKey.length>240)return json({error:"Conteúdo inválido"},400);
    if(!path||path.length>500||!path.startsWith("/"))return json({error:"Caminho inválido"},400);

    const ip=clientIp(req);
    if(!ip)return json({ok:true,counted:false,reason:"ip_unavailable"});

    const supabaseUrl=Deno.env.get("SUPABASE_URL");
    const serviceRole=Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
    if(!supabaseUrl||!serviceRole)throw new Error("Configuração do Supabase indisponível");

    const date=saoPauloDate();
    const hashSecret=Deno.env.get("VIEW_HASH_SECRET")||serviceRole;
    const visitorHash=await hashVisitor(ip,date,hashSecret);
    const db=createClient(supabaseUrl,serviceRole,{
      auth:{persistSession:false,autoRefreshToken:false},
    });

    const {error}=await db.from("public_content_views").insert({
      view_date:date,
      visitor_hash:visitorHash,
      content_type:contentType,
      content_key:contentKey,
      path,
      referrer_host:referrerHost(req.headers.get("referer")),
    });

    if(error){
      if(error.code==="23505")return json({ok:true,counted:false,reason:"already_counted"});
      throw error;
    }

    return json({ok:true,counted:true});
  }catch(error){
    console.error("[track-public-view]",error);
    return json({error:"Não foi possível registrar a visualização"},500);
  }
});
