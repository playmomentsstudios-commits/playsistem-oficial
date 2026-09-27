import { corsHeaders, ensureSiteAssetFolder, getDriveAccessToken, json, requireUser } from "../_shared/googleDrive.ts";

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  try {
    const ctx = await requireUser(req);
    if (ctx.role !== "admin") throw new Error("Admin access required");
    const body = await req.json();
    const fileName = String(body.file_name || "").trim();
    const mimeType = String(body.mime_type || "").trim();
    const fileSize = Number(body.file_size || 0);
    const section = String(body.section || "HOME");
    const normalizedSection = section.trim().toUpperCase();
    const imageSection = ["HOME","PROFILE","PORTFOLIO","COURSES"].includes(normalizedSection);
    const resumeSection = normalizedSection === "RESUME";
    if (!fileName || !Number.isFinite(fileSize) || fileSize <= 0) throw new Error("Invalid file metadata");
    if (imageSection && !mimeType.startsWith("image/")) throw new Error("This section only accepts images");
    if (resumeSection && mimeType !== "application/pdf") throw new Error("Resume must be a PDF");
    if (!imageSection && !resumeSection) throw new Error("Unsupported site asset section");
    if (fileSize > 25 * 1024 * 1024) throw new Error("File exceeds the 25 MB limit");
    const target = await ensureSiteAssetFolder(ctx.db, ctx.userId, section);
    const token = await getDriveAccessToken();
    const metadata = { name:fileName, parents:[target.folderId], appProperties:{playMomentsKind:"site-public-asset",playMomentsSection:target.section} };
    const response = await fetch("https://www.googleapis.com/upload/drive/v3/files?uploadType=resumable&fields=id,name,mimeType,size,parents",{
      method:"POST",headers:{Authorization:`Bearer ${token}`,"Content-Type":"application/json; charset=UTF-8","X-Upload-Content-Type":mimeType,"X-Upload-Content-Length":String(fileSize)},body:JSON.stringify(metadata)
    });
    if(!response.ok)throw new Error(`Could not create Drive upload session: ${response.status} ${await response.text()}`);
    const uploadUrl=response.headers.get("Location");
    if(!uploadUrl)throw new Error("Google Drive did not return an upload session");
    return json({ok:true,upload_url:uploadUrl,folder_id:target.folderId,section:target.section});
  } catch(error){return json({ok:false,error:error instanceof Error?error.message:"Unknown error"},400)}
});