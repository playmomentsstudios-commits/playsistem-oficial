import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { corsHeaders,getDriveAccessToken,json,requireUser } from "../_shared/googleDrive.ts";

const env=(n:string)=>{const v=Deno.env.get(n);if(!v)throw new Error("Missing secret: "+n);return v};
const exposedHeaders="Content-Length, Content-Range, Accept-Ranges, Content-Type, ETag, Last-Modified";

function mediaHeaders(source?:Headers){
 const headers=new Headers();
 if(source){
  for(const name of ["content-type","content-length","content-range","etag","last-modified"]){
   const value=source.get(name);if(value)headers.set(name,value);
  }
 }
 headers.set("Access-Control-Allow-Origin","*");
 headers.set("Access-Control-Expose-Headers",exposedHeaders);
 headers.set("Accept-Ranges","bytes");
 headers.set("Cache-Control","private, no-store");
 headers.set("X-Content-Type-Options","nosniff");
 return headers;
}

function parseRange(value:string,size:number){
 const match=/^bytes=(\d*)-(\d*)$/.exec(value.trim());
 if(!match)throw new Error("Invalid byte range");
 let start:number;let end:number;
 if(match[1]===""&&match[2]!==""){
  const suffix=Number(match[2]);if(!Number.isSafeInteger(suffix)||suffix<=0)throw new Error("Invalid byte range");
  start=Math.max(0,size-suffix);end=size-1;
 }else{
  start=Number(match[1]);end=match[2]===""?size-1:Number(match[2]);
  if(!Number.isSafeInteger(start)||!Number.isSafeInteger(end)||start<0||end<start)throw new Error("Invalid byte range");
  end=Math.min(end,size-1);
 }
 if(start>=size)throw new Error("Range not satisfiable");
 return {start,end};
}

Deno.serve(async(req)=>{
 if(req.method==="OPTIONS")return new Response("ok",{headers:corsHeaders});
 try{
  const url=new URL(req.url);const ticket=url.searchParams.get("ticket");
  if((req.method==="GET"||req.method==="HEAD")&&ticket){
   const db=createClient(env("SUPABASE_URL"),env("SUPABASE_SERVICE_ROLE_KEY"),{auth:{persistSession:false}});
   const {data:t,error}=await db.from("academy_media_tickets").select("drive_file_id,expires_at").eq("token",ticket).gt("expires_at",new Date().toISOString()).single();
   if(error||!t)return new Response("Expired or invalid media ticket",{status:403,headers:mediaHeaders()});

   const driveToken=await getDriveAccessToken();
   const meta=await fetch(`https://www.googleapis.com/drive/v3/files/${encodeURIComponent(t.drive_file_id)}?fields=id,name,size,mimeType,modifiedTime,capabilities(canDownload)`,{headers:{Authorization:`Bearer ${driveToken}`}});
   if(!meta.ok)return new Response("Could not read media metadata",{status:meta.status,headers:mediaHeaders()});
   const info=await meta.json();const size=Number(info.size||0);
   if(!Number.isSafeInteger(size)||size<=0)return new Response("Invalid media size",{status:502,headers:mediaHeaders()});
   if(info.capabilities?.canDownload===false)return new Response("Media download is restricted",{status:403,headers:mediaHeaders()});

   const baseHeaders=mediaHeaders();
   if(info.mimeType)baseHeaders.set("Content-Type",String(info.mimeType));
   baseHeaders.set("Content-Length",String(size));
   if(info.modifiedTime)baseHeaders.set("Last-Modified",new Date(info.modifiedTime).toUTCString());
   if(req.method==="HEAD")return new Response(null,{status:200,headers:baseHeaders});

   const requestedRange=req.headers.get("Range");
   const driveHeaders:Record<string,string>={Authorization:`Bearer ${driveToken}`};
   let expectedRange:{start:number;end:number}|null=null;
   if(requestedRange){
    try{expectedRange=parseRange(requestedRange,size)}
    catch{
     const headers=mediaHeaders();headers.set("Content-Range",`bytes */${size}`);
     return new Response("Range Not Satisfiable",{status:416,headers});
    }
    driveHeaders.Range=`bytes=${expectedRange.start}-${expectedRange.end}`;
   }

   const drive=await fetch(`https://www.googleapis.com/drive/v3/files/${encodeURIComponent(t.drive_file_id)}?alt=media`,{headers:driveHeaders});
   if(!drive.ok&&drive.status!==206){
    const message=await drive.text().catch(()=>"");
    console.error("academy-drive-media upstream",drive.status,message.slice(0,500));
    return new Response("Could not stream media",{status:drive.status,headers:mediaHeaders(drive.headers)});
   }

   const out=mediaHeaders(drive.headers);
   if(info.mimeType&&!out.has("Content-Type"))out.set("Content-Type",String(info.mimeType));

   if(expectedRange){
    const expectedLength=expectedRange.end-expectedRange.start+1;
    out.set("Content-Range",`bytes ${expectedRange.start}-${expectedRange.end}/${size}`);
    out.set("Content-Length",String(expectedLength));
    return new Response(drive.body,{status:206,headers:out});
   }

   // A normal GET must remain a normal 200 response. Do not manufacture a Range request:
   // the HTML5 media element decides when it needs byte ranges for metadata and seeking.
   out.delete("Content-Range");
   out.set("Content-Length",String(size));
   return new Response(drive.body,{status:200,headers:out});
  }

  const ctx=await requireUser(req);const body=await req.json();const kind=String(body.kind||"");const id=String(body.id||"");let driveFileId="";let mediaMimeType="";let mediaSize=0;let mediaDurationMs=0;
  if(kind==="lesson"){
   const {data,error}=await ctx.db.from("course_lessons").select("id,video_source,video_url,video_drive_file_id,module_id,status,is_preview").eq("id",id).single();
   if(error)throw new Error("Could not read lesson media: "+(error.message||error.code||"database error"));
   if(!data)throw new Error("Lesson not found");
   if(data.video_source!=="drive")throw new Error("Lesson is not configured as a Drive video");
   if(!data.video_drive_file_id)throw new Error("Lesson has no Drive file linked. Save the uploaded video in the lesson again.");
   driveFileId=data.video_drive_file_id;
   const driveToken=await getDriveAccessToken();
   const metaResponse=await fetch(`https://www.googleapis.com/drive/v3/files/${encodeURIComponent(driveFileId)}?fields=id,name,size,mimeType,videoMediaMetadata,capabilities(canDownload)`,{headers:{Authorization:`Bearer ${driveToken}`}});
   if(!metaResponse.ok)throw new Error("Google Drive could not read the uploaded video metadata ("+metaResponse.status+").");
   const meta=await metaResponse.json();
   if(!String(meta.mimeType||"").startsWith("video/"))throw new Error("O arquivo está no Drive, mas foi armazenado como "+(meta.mimeType||"tipo desconhecido")+" em vez de vídeo.");
   if(!meta.size)throw new Error("O arquivo de vídeo está vazio no Google Drive.");
   if(meta.capabilities?.canDownload===false)throw new Error("O Google Drive bloqueou a leitura deste vídeo.");
   mediaMimeType=String(meta.mimeType||"video/mp4");
   mediaSize=Number(meta.size||0);
   mediaDurationMs=Number(meta.videoMediaMetadata?.durationMillis||0);
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

  const expiresAt=new Date(Date.now()+4*60*60*1000).toISOString();
  const {data:t,error:ticketError}=await ctx.db.from("academy_media_tickets").insert({user_id:ctx.userId,drive_file_id:driveFileId,purpose:kind==="lesson"?"lesson_video":"material",expires_at:expiresAt}).select("token,expires_at").single();
  if(ticketError)throw new Error("Could not create media ticket: "+(ticketError.message||ticketError.code||"database error"));
  return json({ok:true,ticket:t.token,expires_at:t.expires_at,url:`${url.origin}${url.pathname}?ticket=${t.token}`,mime_type:mediaMimeType||undefined,size:mediaSize||undefined,duration_ms:mediaDurationMs||undefined});
 }catch(error){
  const message=error instanceof Error?error.message:(typeof error==="object"&&error&&"message" in error?String((error as any).message):String(error||"Unknown error"));
  console.error("academy-drive-media",message,error);return json({ok:false,error:message},400);
 }
});
