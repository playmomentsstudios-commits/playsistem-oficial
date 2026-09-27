import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { corsHeaders,getDriveAccessToken,json,requireUser } from "../_shared/googleDrive.ts";
const env=(n:string)=>{const v=Deno.env.get(n);if(!v)throw new Error("Missing secret: "+n);return v};
Deno.serve(async(req)=>{
 if(req.method==="OPTIONS")return new Response("ok",{headers:corsHeaders});
 try{
  const url=new URL(req.url);const ticket=url.searchParams.get("ticket");
  if(req.method==="GET"&&ticket){
   const db=createClient(env("SUPABASE_URL"),env("SUPABASE_SERVICE_ROLE_KEY"),{auth:{persistSession:false}});
   const {data:t,error}=await db.from("academy_media_tickets").select("*").eq("token",ticket).gt("expires_at",new Date().toISOString()).single();
   if(error||!t)return new Response("Expired or invalid media ticket",{status:403});
   const token=await getDriveAccessToken();const headers:any={Authorization:`Bearer ${token}`};const range=req.headers.get("Range");if(range)headers.Range=range;
   const drive=await fetch(`https://www.googleapis.com/drive/v3/files/${encodeURIComponent(t.drive_file_id)}?alt=media`,{headers});
   const outHeaders=new Headers();for(const h of ["content-type","content-length","content-range","accept-ranges","content-disposition"])if(drive.headers.get(h))outHeaders.set(h,drive.headers.get(h)!);
   outHeaders.set("Access-Control-Allow-Origin","*");outHeaders.set("Cache-Control","private, max-age=60");
   return new Response(drive.body,{status:drive.status,headers:outHeaders});
  }
  const ctx=await requireUser(req);const body=await req.json();const kind=String(body.kind||"");const id=String(body.id||"");let driveFileId="";
  if(kind==="lesson"){
   const {data,error}=await ctx.db.from("course_lessons").select("id,video_drive_file_id,module:course_modules!inner(course_id)").eq("id",id).single();if(error||!data?.video_drive_file_id)throw new Error("Lesson media not available");driveFileId=data.video_drive_file_id;
  }else if(kind==="material"){
   const {data,error}=await ctx.db.from("lesson_materials").select("id,drive_file_id").eq("id",id).single();if(error||!data?.drive_file_id)throw new Error("Material not available");driveFileId=data.drive_file_id;
  }else throw new Error("Invalid media kind");
  const {data:t,error:ticketError}=await ctx.db.from("academy_media_tickets").insert({user_id:ctx.userId,drive_file_id:driveFileId,purpose:kind==="lesson"?"lesson_video":"material"}).select("token,expires_at").single();
  if(ticketError)throw ticketError;return json({ok:true,ticket:t.token,expires_at:t.expires_at,url:`${url.origin}${url.pathname}?ticket=${t.token}`});
 }catch(error){return json({ok:false,error:error instanceof Error?error.message:"Unknown error"},400)}
});