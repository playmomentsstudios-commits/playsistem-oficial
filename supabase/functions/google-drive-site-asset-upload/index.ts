import { corsHeaders, ensureSiteAssetFolder, getDriveAccessToken, json, requireUser } from "../_shared/googleDrive.ts";

function validateAsset(fileName:string,mimeType:string,fileSize:number,section:string){
  const normalizedSection=section.trim().toUpperCase();
  const imageSection=["HOME","PROFILE","PORTFOLIO","COURSES","LANDINGS","BRAND"].includes(normalizedSection);
  const resumeSection=normalizedSection==="RESUME";
  if(!fileName||!Number.isFinite(fileSize)||fileSize<=0)throw new Error("Invalid file metadata");
  if(imageSection&&!mimeType.startsWith("image/"))throw new Error("This section only accepts images");
  if(normalizedSection==="BRAND"&&!["image/png","image/jpeg","image/webp","image/svg+xml","image/x-icon","image/vnd.microsoft.icon"].includes(mimeType))throw new Error("Unsupported brand image format");
  if(resumeSection&&mimeType!=="application/pdf")throw new Error("Resume must be a PDF");
  if(!imageSection&&!resumeSection)throw new Error("Unsupported site asset section");
  if(fileSize>25*1024*1024)throw new Error("File exceeds the 25 MB limit");
  return normalizedSection;
}

Deno.serve(async(req)=>{
  if(req.method==="OPTIONS")return new Response("ok",{headers:corsHeaders});
  try{
    const ctx=await requireUser(req);
    if(ctx.role!=="admin")throw new Error("Admin access required");

    const contentType=req.headers.get("content-type")||"";
    if(contentType.includes("multipart/form-data")){
      const form=await req.formData();
      const file=form.get("file");
      const section=String(form.get("section")||"HOME");
      if(!(file instanceof File))throw new Error("File not provided");
      const normalizedSection=validateAsset(file.name,file.type||"application/octet-stream",file.size,section);
      if(normalizedSection==="BRAND" && file.type==="image/svg+xml"){
        const xml=await file.text();
        // SVG is public media: disallow executable markup and external subresources.
        if(/<\s*(?:script|foreignObject|iframe|object|embed|animate|set)\b|\bon[a-z]+\s*=|(?:href|xlink:href)\s*=\s*["'](?:\s*(?:https?:|javascript:|data:))/i.test(xml))throw new Error("O SVG contém conteúdo ativo ou referências externas.");
      }
      const target=await ensureSiteAssetFolder(ctx.db,ctx.userId,normalizedSection);
      const token=await getDriveAccessToken();
      const boundary="pm_site_"+crypto.randomUUID();
      const metadata={
        name:file.name,
        parents:[target.folderId],
        appProperties:{playMomentsKind:"site-public-asset",playMomentsSection:target.section},
      };
      const encoder=new TextEncoder();
      const head=encoder.encode(
        `--${boundary}\r\nContent-Type: application/json; charset=UTF-8\r\n\r\n${JSON.stringify(metadata)}\r\n--${boundary}\r\nContent-Type: ${file.type||"application/octet-stream"}\r\n\r\n`,
      );
      const tail=encoder.encode(`\r\n--${boundary}--`);
      const bytes=new Uint8Array(head.length+file.size+tail.length);
      bytes.set(head);
      bytes.set(new Uint8Array(await file.arrayBuffer()),head.length);
      bytes.set(tail,head.length+file.size);

      const response=await fetch(
        "https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart&fields=id,name,mimeType,size,parents",
        {
          method:"POST",
          headers:{Authorization:`Bearer ${token}`,"Content-Type":`multipart/related; boundary=${boundary}`},
          body:bytes,
        },
      );
      if(!response.ok)throw new Error(`Could not upload asset to Drive: ${response.status} ${await response.text()}`);
      return json({ok:true,file:await response.json(),folder_id:target.folderId,section:target.section});
    }

    // Legacy resumable-session flow kept for older clients.
    const body=await req.json();
    const fileName=String(body.file_name||"").trim();
    const mimeType=String(body.mime_type||"").trim();
    const fileSize=Number(body.file_size||0);
    const section=String(body.section||"HOME");
    const normalizedSection=validateAsset(fileName,mimeType,fileSize,section);
    const target=await ensureSiteAssetFolder(ctx.db,ctx.userId,normalizedSection);
    const token=await getDriveAccessToken();
    const metadata={
      name:fileName,
      parents:[target.folderId],
      appProperties:{playMomentsKind:"site-public-asset",playMomentsSection:target.section},
    };
    const response=await fetch(
      "https://www.googleapis.com/upload/drive/v3/files?uploadType=resumable&fields=id,name,mimeType,size,parents",
      {
        method:"POST",
        headers:{
          Authorization:`Bearer ${token}`,
          "Content-Type":"application/json; charset=UTF-8",
          "X-Upload-Content-Type":mimeType,
          "X-Upload-Content-Length":String(fileSize),
        },
        body:JSON.stringify(metadata),
      },
    );
    if(!response.ok)throw new Error(`Could not create Drive upload session: ${response.status} ${await response.text()}`);
    const uploadUrl=response.headers.get("Location");
    if(!uploadUrl)throw new Error("Google Drive did not return an upload session");
    return json({ok:true,upload_url:uploadUrl,folder_id:target.folderId,section:target.section});
  }catch(error){
    return json({ok:false,error:error instanceof Error?error.message:"Unknown error"},400);
  }
});
