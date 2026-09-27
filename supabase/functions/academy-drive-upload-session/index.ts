import { corsHeaders, ensureAcademyFolder, getDriveAccessToken, json, requireUser } from "../_shared/googleDrive.ts";
Deno.serve(async(req)=>{
 if(req.method==="OPTIONS")return new Response("ok",{headers:corsHeaders});
 try{
  const ctx=await requireUser(req);if(ctx.role!=="admin")throw new Error("Admin access required");
  const body=await req.json();
  const action=String(body.action||"start");
  if(action==="delete"){
   const fileId=String(body.drive_file_id||"");if(!fileId)throw new Error("Missing Drive file id");
   const token=await getDriveAccessToken();const removed=await fetch(`https://www.googleapis.com/drive/v3/files/${encodeURIComponent(fileId)}`,{method:"DELETE",headers:{Authorization:`Bearer ${token}`}});
   if(!removed.ok&&removed.status!==404)throw new Error("Could not delete Drive file: "+await removed.text());
   return json({ok:true});
  }
  const courseId=String(body.course_id||"");const moduleId=body.module_id?String(body.module_id):undefined;const fileName=String(body.file_name||"").trim();const mimeType=String(body.mime_type||"application/octet-stream");const fileSize=Number(body.file_size||0);const materialFolder=String(body.material_folder||"").trim().replace(/[\\/]/g,"-").slice(0,80);
  if(!courseId||!fileName||!Number.isFinite(fileSize)||fileSize<=0)throw new Error("Invalid upload metadata");
  if(fileSize>50*1024*1024*1024)throw new Error("File exceeds the 50 GB limit");
  const folders=await ensureAcademyFolder(ctx.db,ctx.userId,courseId,moduleId);const token=await getDriveAccessToken();
  let targetFolderId=folders.folderId;
  if(materialFolder){const q=new URLSearchParams({q:`'${targetFolderId}' in parents and mimeType='application/vnd.google-apps.folder' and trashed=false and name='${materialFolder.replace(/'/g,"\\'")}'`,fields:"files(id,name)",pageSize:"1"});const found=await fetch("https://www.googleapis.com/drive/v3/files?"+q,{headers:{Authorization:`Bearer ${token}`}}).then(r=>r.json());if(found.files?.[0])targetFolderId=found.files[0].id;else{const created=await fetch("https://www.googleapis.com/drive/v3/files?fields=id,name",{method:"POST",headers:{Authorization:`Bearer ${token}`,"Content-Type":"application/json"},body:JSON.stringify({name:materialFolder,mimeType:"application/vnd.google-apps.folder",parents:[targetFolderId],appProperties:{playMomentsKind:"academy-material-folder",playMomentsEntityId:moduleId||courseId}})});if(!created.ok)throw new Error("Could not create material folder: "+await created.text());targetFolderId=(await created.json()).id}}
  if(action==="confirm"){const params=new URLSearchParams({q:`'${targetFolderId}' in parents and trashed=false and name='${fileName.replace(/'/g,"\\'")}'`,orderBy:"modifiedTime desc",fields:"files(id,name,mimeType,size,parents,modifiedTime)",pageSize:"5"});const lookup=await fetch("https://www.googleapis.com/drive/v3/files?"+params,{headers:{Authorization:`Bearer ${token}`}});if(!lookup.ok)throw new Error("Could not confirm Drive upload: "+await lookup.text());const files=(await lookup.json()).files||[];const file=files.find((f:any)=>Number(f.size||0)===fileSize)||files[0];if(!file)throw new Error("Uploaded file was not found in Drive");return json({ok:true,file,folder_id:targetFolderId})}
  const response=await fetch("https://www.googleapis.com/upload/drive/v3/files?uploadType=resumable&fields=id,name,mimeType,size,parents",{
   method:"POST",headers:{Authorization:`Bearer ${token}`,"Content-Type":"application/json; charset=UTF-8","X-Upload-Content-Type":mimeType,"X-Upload-Content-Length":String(fileSize)},
   body:JSON.stringify({name:fileName,parents:[targetFolderId],appProperties:{playMomentsKind:"academy-file",playMomentsEntityId:courseId,playMomentsModuleId:moduleId||""}})
  });
  if(!response.ok)throw new Error(`Could not create Drive upload session: ${response.status} ${await response.text()}`);
  const uploadUrl=response.headers.get("Location");if(!uploadUrl)throw new Error("Google Drive did not return an upload session");
  return json({ok:true,upload_url:uploadUrl,folder_id:targetFolderId});
 }catch(error){return json({ok:false,error:error instanceof Error?error.message:"Unknown error"},400)}
});