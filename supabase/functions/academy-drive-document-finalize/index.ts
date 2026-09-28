import { corsHeaders,driveJson,json,requireUser } from "../_shared/googleDrive.ts";

Deno.serve(async(req)=>{
 if(req.method==="OPTIONS")return new Response("ok",{headers:corsHeaders});
 try{
  const ctx=await requireUser(req);if(ctx.role!=="admin")throw new Error("Admin access required");
  const body=await req.json();const documentId=String(body.document_id||"");const driveFileId=String(body.drive_file_id||"");
  if(!documentId||!driveFileId)throw new Error("Missing document metadata");
  const {data:doc,error}=await ctx.db.from("academy_documents").select("*").eq("id",documentId).single();if(error||!doc)throw new Error("Academic document not found");
  const file=await driveJson(`https://www.googleapis.com/drive/v3/files/${encodeURIComponent(driveFileId)}?fields=id,name,mimeType,size,parents,trashed,md5Checksum,appProperties`);
  if(file.trashed||file.appProperties?.playMomentsKind!=="academy-document"||file.appProperties?.playMomentsEntityId!==documentId)throw new Error("Drive file does not belong to this academic document");
  const version=Number(doc.current_version||1);
  const values={drive_file_id:file.id,file_name:file.name,mime_type:file.mimeType||null,file_size:file.size?Number(file.size):null,file_hash:file.md5Checksum||null,status:"issued",issued_at:doc.issued_at||new Date().toISOString()};
  const {error:updateError}=await ctx.db.from("academy_documents").update(values).eq("id",documentId);if(updateError)throw updateError;
  const {error:versionError}=await ctx.db.from("academy_document_versions").upsert({document_id:documentId,version,drive_file_id:file.id,file_name:file.name,mime_type:file.mimeType||null,file_size:file.size?Number(file.size):null,file_hash:file.md5Checksum||null,snapshot:{document_type:doc.document_type,title:doc.title,status:"issued"},created_by:ctx.userId},{onConflict:"document_id,version"});if(versionError)throw versionError;
  return json({ok:true,file:{id:file.id,name:file.name,mime_type:file.mimeType,size:file.size,hash:file.md5Checksum||null},version});
 }catch(error){return json({ok:false,error:error instanceof Error?error.message:"Unknown error"},400)}
});
