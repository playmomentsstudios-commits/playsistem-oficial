import { corsHeaders, driveJson, getDriveAccessToken } from "../_shared/googleDrive.ts";

Deno.serve(async(req)=>{
  if(req.method==="OPTIONS")return new Response("ok",{headers:corsHeaders});
  try{
    const url=new URL(req.url); const id=url.searchParams.get("id")||"";
    if(!id)throw new Error("id is required");
    const file=await driveJson(`https://www.googleapis.com/drive/v3/files/${encodeURIComponent(id)}?fields=id,mimeType,size,trashed,appProperties`);
    if(file.trashed||file.appProperties?.playMomentsKind!=="site-public-asset")return new Response("Not found",{status:404,headers:corsHeaders});
    const token=await getDriveAccessToken();
    const response=await fetch(`https://www.googleapis.com/drive/v3/files/${encodeURIComponent(id)}?alt=media`,{headers:{Authorization:`Bearer ${token}`}});
    if(!response.ok||!response.body)return new Response("Not found",{status:404,headers:corsHeaders});
    const headers=new Headers(corsHeaders);
    headers.set("Content-Type",response.headers.get("Content-Type")||file.mimeType||"application/octet-stream");
    headers.set("Cache-Control","public, max-age=3600, s-maxage=86400, stale-while-revalidate=604800");
    headers.set("X-Content-Type-Options","nosniff");
    return new Response(response.body,{status:200,headers});
  }catch{return new Response("Not found",{status:404,headers:corsHeaders})}
});