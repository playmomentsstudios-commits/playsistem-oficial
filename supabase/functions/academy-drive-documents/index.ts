import { corsHeaders,driveJson,ensureAcademyDocumentsFolder,getDriveAccessToken,json,requireUser } from "../_shared/googleDrive.ts";

Deno.serve(async(req)=>{
 if(req.method==="OPTIONS")return new Response("ok",{headers:corsHeaders});
 try{
  const ctx=await requireUser(req);if(ctx.role!=="admin")throw new Error("Admin access required");
  const body=await req.json();const documentId=String(body.document_id||"");const action=String(body.action||"prepare");
  const {data:doc,error}=await ctx.db.from("academy_documents").select("*,student:academy_students(id,profile_id),enrollment:course_enrollments(id,course_id,enrollment_number)").eq("id",documentId).single();
  if(error||!doc)throw new Error("Academic document not found");
  const folders=await ensureAcademyDocumentsFolder(ctx.db,ctx.userId,doc.student_id,doc.enrollment_id||undefined);
  if(action==="prepare")return json({ok:true,folder_id:folders.folderId});
  if(action!=="upload")throw new Error("Invalid action");
  const fileName=String(body.file_name||"").trim();const mimeType=String(body.mime_type||"application/pdf");const fileSize=Number(body.file_size||0);
  if(!fileName||!Number.isFinite(fileSize)||fileSize<=0)throw new Error("Invalid file metadata");
  const token=await getDriveAccessToken();
  const metadata={name:fileName,parents:[folders.folderId],appProperties:{playMomentsKind:"academy-document",playMomentsEntityId:documentId,playMomentsVersion:String(doc.current_version)}};
  const response=await fetch("https://www.googleapis.com/upload/drive/v3/files?uploadType=resumable&fields=id,name,mimeType,size,parents,webViewLink",{method:"POST",headers:{Authorization:`Bearer ${token}`,"Content-Type":"application/json; charset=UTF-8","X-Upload-Content-Type":mimeType,"X-Upload-Content-Length":String(fileSize)},body:JSON.stringify(metadata)});
  if(!response.ok)throw new Error("Could not create academic document upload session: "+response.status);
  const uploadUrl=response.headers.get("Location");if(!uploadUrl)throw new Error("Google Drive did not return upload session");
  return json({ok:true,upload_url:uploadUrl,folder_id:folders.folderId,version:doc.current_version});
 }catch(error){return json({ok:false,error:error instanceof Error?error.message:"Unknown error"},400)}
});
