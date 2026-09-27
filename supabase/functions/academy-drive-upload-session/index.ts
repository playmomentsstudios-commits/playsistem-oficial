import { corsHeaders, ensureAcademyFolder, getDriveAccessToken, json, requireUser } from "../_shared/googleDrive.ts";
Deno.serve(async(req)=>{
 if(req.method==="OPTIONS")return new Response("ok",{headers:corsHeaders});
 try{
  const ctx=await requireUser(req);if(ctx.role!=="admin")throw new Error("Admin access required");
  const body=await req.json();const courseId=String(body.course_id||"");const moduleId=body.module_id?String(body.module_id):undefined;const fileName=String(body.file_name||"").trim();const mimeType=String(body.mime_type||"application/octet-stream");const fileSize=Number(body.file_size||0);
  if(!courseId||!fileName||!Number.isFinite(fileSize)||fileSize<=0)throw new Error("Invalid upload metadata");
  if(fileSize>50*1024*1024*1024)throw new Error("File exceeds the 50 GB limit");
  const folders=await ensureAcademyFolder(ctx.db,ctx.userId,courseId,moduleId);const token=await getDriveAccessToken();
  const response=await fetch("https://www.googleapis.com/upload/drive/v3/files?uploadType=resumable&fields=id,name,mimeType,size,parents",{
   method:"POST",headers:{Authorization:`Bearer ${token}`,"Content-Type":"application/json; charset=UTF-8","X-Upload-Content-Type":mimeType,"X-Upload-Content-Length":String(fileSize)},
   body:JSON.stringify({name:fileName,parents:[folders.folderId],appProperties:{playMomentsKind:"academy-file",playMomentsEntityId:courseId,playMomentsModuleId:moduleId||""}})
  });
  if(!response.ok)throw new Error(`Could not create Drive upload session: ${response.status} ${await response.text()}`);
  const uploadUrl=response.headers.get("Location");if(!uploadUrl)throw new Error("Google Drive did not return an upload session");
  return json({ok:true,upload_url:uploadUrl,folder_id:folders.folderId});
 }catch(error){return json({ok:false,error:error instanceof Error?error.message:"Unknown error"},400)}
});