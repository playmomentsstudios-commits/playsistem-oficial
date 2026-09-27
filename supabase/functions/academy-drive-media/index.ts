import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { corsHeaders,getDriveAccessToken,json,requireUser } from "../_shared/googleDrive.ts";
const env=(n:string)=>{const v=Deno.env.get(n);if(!v)throw new Error("Missing secret: "+n);return v};
Deno.serve(async(req)=>{
 if(req.method==="OPTIONS")return new Response("ok",{headers:corsHeaders});
 try{
  const url=new URL(req.url);const ticket=url.searchParams.get("ticket");
  if((req.method==="GET"||req.method==="HEAD")&&ticket){
   const db=createClient(env("SUPABASE_URL"),env("SUPABASE_SERVICE_ROLE_KEY"),{auth:{persistSession:false}});
   const {data:t,error}=await db.from("academy_media_tickets").select("*").eq("token",ticket).gt("expires_at",new Date().toISOString()).single();
   if(error||!t)return new Response("Expired or invalid media ticket",{status:403});
   const token=await getDriveAccessToken();
   if(req.method==="HEAD"){
    const meta=await fetch(`https://www.googleapis.com/drive/v3/files/${encodeURIComponent(t.drive_file_id)}?fields=size,mimeType`,{headers:{Authorization:`Bearer ${token}`}});
    if(!meta.ok)return new Response("Could not read media metadata",{status:meta.status});
    const info=await meta.json();const head=new Headers({"Access-Control-Allow-Origin":"*","Access-Control-Expose-Headers":"Content-Length, Accept-Ranges, Content-Type","Accept-Ranges":"bytes","Cache-Control":"private, max-age=60"});
    if(info.mimeType)head.set("Content-Type",info.mimeType);if(info.size)head.set("Content-Length",String(info.size));
    return new Response(null,{status:200,headers:head});
   }
   const headers:any={Authorization:`Bearer ${token}`};const requestedRange=req.headers.get("Range");
   // Chromium may start with a normal GET. Force a byte-range in that case so the response
   // has the 206/Content-Range semantics required by the native HTML5 player.
   headers.Range=requestedRange||"bytes=0-1048575";
   const drive=await fetch(`https://www.googleapis.com/drive/v3/files/${encodeURIComponent(t.drive_file_id)}?alt=media`,{headers});
   const outHeaders=new Headers();for(const h of ["content-type","content-length","content-range","accept-ranges","content-disposition"])if(drive.headers.get(h))outHeaders.set(h,drive.headers.get(h)!);
   outHeaders.set("Access-Control-Allow-Origin","*");outHeaders.set("Access-Control-Expose-Headers","Content-Length, Content-Range, Accept-Ranges, Content-Type");outHeaders.set("Accept-Ranges","bytes");outHeaders.set("Cache-Control","private, max-age=60");outHeaders.delete("content-disposition");
   // Never advertise a partial body as a complete 200 response. Drive normally returns 206;
   // keep that status explicit whenever Content-Range confirms a partial payload.
   const status=outHeaders.has("content-range")?206:drive.status;
   return new Response(drive.body,{status,headers:outHeaders});
  }
  const ctx=await requireUser(req);const body=await req.json();const kind=String(body.kind||"");const id=String(body.id||"");let driveFileId="";
  if(kind==="lesson"){
   const {data,error}=await ctx.db.from("course_lessons").select("id,video_source,video_url,video_drive_file_id,module_id,status,is_preview").eq("id",id).single();
   if(error)throw new Error("Could not read lesson media: "+(error.message||error.code||"database error"));
   if(!data)throw new Error("Lesson not found");
   if(data.video_source!=="drive")throw new Error("Lesson is not configured as a Drive video");
   if(!data.video_drive_file_id)throw new Error("Lesson has no Drive file linked. Save the uploaded video in the lesson again.");
   driveFileId=data.video_drive_file_id;
   // Validate that Drive actually sees this as a playable video before issuing a ticket.
   // This catches uploads that exist but are still processing or were stored with a non-video MIME type.
   const driveToken=await getDriveAccessToken();
   const metaResponse=await fetch(`https://www.googleapis.com/drive/v3/files/${encodeURIComponent(driveFileId)}?fields=id,name,size,mimeType,videoMediaMetadata`,{headers:{Authorization:`Bearer ${driveToken}`}});
   if(!metaResponse.ok)throw new Error("Google Drive could not read the uploaded video metadata ("+metaResponse.status+").");
   const meta=await metaResponse.json();
   if(!String(meta.mimeType||"").startsWith("video/"))throw new Error("O arquivo está no Drive, mas foi armazenado como "+(meta.mimeType||"tipo desconhecido")+" em vez de vídeo.");
   if(!meta.size)throw new Error("O arquivo de vídeo está vazio no Google Drive.");
  }else if(kind==="material"){
   const {data,error}=await ctx.db.from("lesson_materials").select("id,drive_file_id").eq("id",id).single();if(error||!data?.drive_file_id)throw new Error("Material not available");driveFileId=data.drive_file_id;
  }else throw new Error("Invalid media kind");
  if(ctx.role!=="admin"){
   let courseId="";let preview=false;
   if(kind==="lesson"){
    const {data:lesson}=await ctx.db.from("course_lessons").select("is_preview,status,module_id").eq("id",id).single();
    if(!lesson||lesson.status!=="published")throw new Error("Lesson is not published");
    preview=lesson.is_preview===true;
    const {data:moduleRow}=await ctx.db.from("course_modules").select("course_id").eq("id",lesson.module_id).single();
    courseId=moduleRow?.course_id||"";
   }else{
    const {data:material}=await ctx.db.from("lesson_materials").select("lesson_id").eq("id",id).single();
    const {data:lesson}=await ctx.db.from("course_lessons").select("status,module_id").eq("id",material?.lesson_id||"").single();
    if(!lesson||lesson.status!=="published")throw new Error("Material is not published");
    const {data:moduleRow}=await ctx.db.from("course_modules").select("course_id").eq("id",lesson.module_id).single();
    courseId=moduleRow?.course_id||"";
   }
   const {data:course}=await ctx.db.from("courses").select("status,access_type").eq("id",courseId).single();
   if(!course||course.status!=="published")throw new Error("Course is not published");
   if(kind==="material"||(!preview&&course.access_type!=="free")){
    const {data:enrollment}=await ctx.db.from("course_enrollments").select("id").eq("course_id",courseId).eq("user_id",ctx.userId).in("status",["active","completed"]).maybeSingle();
    if(!enrollment)throw new Error("Enrollment required");
   }
  }
  const {data:t,error:ticketError}=await ctx.db.from("academy_media_tickets").insert({user_id:ctx.userId,drive_file_id:driveFileId,purpose:kind==="lesson"?"lesson_video":"material"}).select("token,expires_at").single();
  if(ticketError)throw new Error("Could not create media ticket: "+(ticketError.message||ticketError.code||"database error"));return json({ok:true,ticket:t.token,expires_at:t.expires_at,url:`${url.origin}${url.pathname}?ticket=${t.token}`});
 }catch(error){const message=error instanceof Error?error.message:(typeof error==="object"&&error&&"message" in error?String((error as any).message):String(error||"Unknown error"));console.error("academy-drive-media",message,error);return json({ok:false,error:message},400)}
});