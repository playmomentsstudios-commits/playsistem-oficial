import { corsHeaders } from "../_shared/googleDrive.ts";

function json(message:string,status=400){return new Response(JSON.stringify({error:message}),{status,headers:{...corsHeaders,"Content-Type":"application/json"}})}

Deno.serve(async(req)=>{
  if(req.method==="OPTIONS")return new Response("ok",{headers:corsHeaders});
  const slug=new URL(req.url).searchParams.get("slug")?.trim();
  if(!slug)return json("Slug obrigatório");
  const site=(Deno.env.get("PUBLIC_SITE_URL")||"https://playsistem-oficial.playmomentsstudios.workers.dev").replace(/\/$/,"");
  const browserless=Deno.env.get("BROWSERLESS_URL");
  if(!browserless)return json("Gerador de PDF não configurado",503);
  try{
    const target=site+"/curriculos/"+encodeURIComponent(slug)+"?pdf=1";
    const response=await fetch(browserless,{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({url:target,options:{format:"A4",printBackground:true,preferCSSPageSize:true,margin:{top:"0",right:"0",bottom:"0",left:"0"}}})});
    if(!response.ok)return json("Falha ao gerar PDF",502);
    const bytes=await response.arrayBuffer();
    return new Response(bytes,{status:200,headers:{...corsHeaders,"Content-Type":"application/pdf","Content-Disposition":'attachment; filename="curriculo.pdf"',"Cache-Control":"no-store"}});
  }catch{return json("Falha ao gerar PDF",502)}
});
