import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { corsHeaders, getDriveAccessToken, json, requireUser } from "../_shared/googleDrive.ts";

// Separate from classroom media: paid PDF/MP3 never use public Google Drive sharing.
const required=(name:string)=>{const value=Deno.env.get(name);if(!value)throw new Error("Configuration unavailable");return value};
const isUuid=(value:string)=>/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value);
function mediaHeaders(source?:Headers,mime="application/octet-stream"){
 const h=new Headers({...corsHeaders,"Content-Type":mime,"Content-Disposition":"inline","Cache-Control":"private, no-store","X-Content-Type-Options":"nosniff","Referrer-Policy":"no-referrer","Accept-Ranges":"bytes","Access-Control-Expose-Headers":"Content-Length, Content-Range, Accept-Ranges, Content-Type"});
 if(source)for(const k of ["content-length","content-range","etag","last-modified","accept-ranges"]) {const v=source.get(k);if(v)h.set(k,v)}
 return h;
}
const allowed=new Set(["application/pdf","audio/mpeg"]);
async function hasAccess(db:any,userId:string,publicationId:string){
 const {data:profile}=await db.from("profiles").select("role,status").eq("id",userId).maybeSingle();
 if(!profile||profile.status!=="active")return false;
 if(profile.role==="admin")return true;
 const {data:entitlement,error}=await db.from("academy_publication_entitlements").select("id").eq("publication_id",publicationId).eq("user_id",userId).is("revoked_at",null).limit(1);
 if(error)throw new Error("Access verification failed");
 return (entitlement||[]).length>0;
}
Deno.serve(async(req)=>{
 if(req.method==="OPTIONS")return new Response("ok",{headers:corsHeaders});
 try{
  const url=new URL(req.url);
  if(req.method==="POST"){
   const ctx=await requireUser(req);
   const body=await req.json();
   const publicationId=String(body.publication_id||"");
   if(!isUuid(publicationId))return json({error:"Invalid publication"},400);
   const {data:publication,error:pError}=await ctx.db.from("academy_publications").select("id,status").eq("id",publicationId).maybeSingle();
   if(pError||!publication)return json({error:"Publication unavailable"},404);
   if(publication.status!=="published"&&ctx.role!=="admin")return json({error:"Publication unavailable"},404);
   if(!await hasAccess(ctx.db,ctx.userId,publicationId))return json({error:"Access not granted"},403);
   const {data:asset}=await ctx.db.from("academy_publication_assets").select("drive_file_id,mime_type").eq("publication_id",publicationId).maybeSingle();
   if(!asset||!allowed.has(asset.mime_type))return json({error:"Media not yet available"},404);
   const expiresAt=new Date(Date.now()+2*60*60*1000).toISOString();
   const {data:ticket,error:tError}=await ctx.db.from("academy_publication_tickets").insert({publication_id:publicationId,user_id:ctx.userId,expires_at:expiresAt}).select("token").single();
   if(tError||!ticket)return json({error:"Could not prepare secure reader"},502);
   return json({url:`${url.origin}${url.pathname}?ticket=${encodeURIComponent(ticket.token)}`,expires_at:expiresAt,mime_type:asset.mime_type});
  }
  if(req.method!=="GET"&&req.method!=="HEAD")return json({error:"Method not allowed"},405);
  const ticketId=url.searchParams.get("ticket")||"";
  if(!isUuid(ticketId))return new Response("Forbidden",{status:403,headers:mediaHeaders()});
  const db=createClient(required("SUPABASE_URL"),required("SUPABASE_SERVICE_ROLE_KEY"),{auth:{persistSession:false,autoRefreshToken:false}});
  const {data:ticket,error:tError}=await db.from("academy_publication_tickets").select("publication_id,user_id,expires_at").eq("token",ticketId).gt("expires_at",new Date().toISOString()).maybeSingle();
  if(tError||!ticket)return new Response("Ticket expired",{status:403,headers:mediaHeaders()});
  const {data:publication}=await db.from("academy_publications").select("status").eq("id",ticket.publication_id).maybeSingle();
  if(!publication)return new Response("Unavailable",{status:404,headers:mediaHeaders()});
  const {data:profile}=await db.from("profiles").select("role,status").eq("id",ticket.user_id).maybeSingle();
  if(!profile||profile.status!=="active"||(publication.status!=="published"&&profile.role!=="admin")||!await hasAccess(db,ticket.user_id,ticket.publication_id))return new Response("Forbidden",{status:403,headers:mediaHeaders()});
  const {data:asset}=await db.from("academy_publication_assets").select("drive_file_id,mime_type").eq("publication_id",ticket.publication_id).maybeSingle();
  if(!asset||!allowed.has(asset.mime_type))return new Response("Unavailable",{status:404,headers:mediaHeaders()});
  const driveToken=await getDriveAccessToken();
  const fileUrl=`https://www.googleapis.com/drive/v3/files/${encodeURIComponent(asset.drive_file_id)}`;
  const meta=await fetch(fileUrl+"?fields=id,mimeType,size,capabilities(canDownload)",{headers:{Authorization:`Bearer ${driveToken}`}});
  if(!meta.ok)return new Response("File unavailable",{status:502,headers:mediaHeaders()});
  const info=await meta.json();
  if(info.mimeType!==asset.mime_type||info.capabilities?.canDownload===false)return new Response("File format unavailable",{status:403,headers:mediaHeaders()});
  if(req.method==="HEAD"){
   const headers=mediaHeaders(undefined,asset.mime_type);
   if(Number(info.size)>0)headers.set("Content-Length",String(info.size));
   return new Response(null,{status:200,headers});
  }
  const reqRange=req.headers.get("Range");
  if(reqRange&&!/^bytes=(?:\d+-\d*|-\d+)$/.test(reqRange.trim()))return new Response("Invalid range",{status:416,headers:mediaHeaders()});
  const upstreamHeaders:Record<string,string>={Authorization:`Bearer ${driveToken}`};
  if(reqRange)upstreamHeaders.Range=reqRange;
  const upstream=await fetch(fileUrl+"?alt=media",{headers:upstreamHeaders});
  if(!upstream.ok)return new Response("Media unavailable",{status:upstream.status===404?404:502,headers:mediaHeaders()});
  const headers=mediaHeaders(upstream.headers,asset.mime_type);
  if(upstream.status===200)headers.delete("Content-Range");
  return new Response(upstream.body,{status:upstream.status===206?206:200,headers});
 }catch(e){
  console.error("academy-publication-media",e instanceof Error?e.message:"Unexpected error");
  return json({error:"Could not open this content"},500);
 }
});
