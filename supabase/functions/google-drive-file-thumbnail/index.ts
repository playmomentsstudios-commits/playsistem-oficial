import { corsHeaders, getDriveAccessToken, hasPermission, requireUser } from "../_shared/googleDrive.ts";

// Authenticated file preview only. Never publish the original Google Drive ACL.
const errorResponse = (message: string, status: number) =>
  new Response(JSON.stringify({ ok: false, error: message }), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json", "Cache-Control": "private, no-store" },
  });

const trustedThumbnailHost = (name: string) =>
  name === "drive.google.com" || name === "googleusercontent.com" || name.endsWith(".googleusercontent.com");
const MAX_THUMBNAIL_BYTES = 3 * 1024 * 1024;
const MAX_ORIGINAL_PREVIEW_BYTES = 20 * 1024 * 1024;

// Never buffer an unlimited Drive response in an edge worker.
async function readCappedImage(response: Response, limit: number): Promise<Uint8Array | null> {
  const declared = Number(response.headers.get("Content-Length") || "0");
  if (Number.isFinite(declared) && declared > limit) return null;
  const reader = response.body?.getReader();
  if (!reader) return null;
  const chunks: Uint8Array[] = [];
  let total = 0;
  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      total += value.byteLength;
      if (total > limit) {
        await reader.cancel();
        return null;
      }
      chunks.push(value);
    }
  } finally {
    reader.releaseLock();
  }
  const bytes = new Uint8Array(total);
  let offset = 0;
  for (const chunk of chunks) { bytes.set(chunk, offset); offset += chunk.byteLength; }
  return bytes;
}

function supportedImageMime(file: { name?: string | null; mime_type?: string | null; file_type?: string | null }) {
  const declared = String(file.mime_type || file.file_type || "").split(";")[0].toLowerCase();
  const extension = String(file.name || "").toLowerCase().split(".").pop();
  if (extension === "jpg" || extension === "jpeg") return "image/jpeg";
  if (extension === "png") return "image/png";
  if (declared === "image/jpeg" || declared === "image/png") return declared;
  return null;
}

function imageMatches(bytes: Uint8Array, mime: string) {
  if (mime === "image/jpeg")
    return bytes.length > 3 && bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff;
  if (mime === "image/png")
    return bytes.length > 8 && bytes[0] === 0x89 && bytes[1] === 0x50 && bytes[2] === 0x4e
      && bytes[3] === 0x47 && bytes[4] === 0x0d && bytes[5] === 0x0a
      && bytes[6] === 0x1a && bytes[7] === 0x0a;
  return false;
}

function imageResponse(bytes: Uint8Array, contentType: string, source: "thumbnail" | "original") {
  return new Response(bytes, {
    status: 200,
    headers: {
      ...corsHeaders,
      "Content-Type": contentType,
      "Content-Length": String(bytes.length),
      "Content-Disposition": "inline",
      "Cache-Control": "private, no-store",
      "Vary": "Authorization",
      "X-Content-Type-Options": "nosniff",
      "X-Preview-Source": source,
    },
  });
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (req.method !== "POST") return errorResponse("Method not allowed", 405);

  try {
    const ctx = await requireUser(req);
    const body = await req.json();
    const fileId = String(body?.file_id || "");
    if (!/^[0-9a-f-]{36}$/i.test(fileId)) return errorResponse("Invalid file id", 400);

    const { data: file, error } = await ctx.db.from("client_files")
      .select("id,name,file_size,project_id,customer_id,client_visible,storage_provider,drive_file_id,mime_type,file_type")
      .eq("id", fileId).maybeSingle();
    if (error || !file) return errorResponse("File not found", 404);
    if (file.storage_provider !== "google_drive" || !file.drive_file_id)
      return errorResponse("Thumbnail unavailable", 404);

    const staffAllowed = ctx.role === "admin"
      || hasPermission(ctx, "files.view") || hasPermission(ctx, "files.manage");

    let customerAllowed = false;
    if (ctx.role === "customer" && file.client_visible) {
      const { data: project } = file.project_id
        ? await ctx.db.from("projects").select("customer_id,project_type")
          .eq("id", file.project_id).maybeSingle()
        : { data: null };
      if (!file.project_id) {
        customerAllowed = file.customer_id === ctx.userId;
      } else if (project && project.project_type !== "internal") {
        customerAllowed = project.customer_id === ctx.userId;
        if (!customerAllowed) {
          const { data: extra } = await ctx.db.from("project_customer_access")
            .select("project_id").eq("project_id", file.project_id)
            .eq("customer_id", ctx.userId).maybeSingle();
          customerAllowed = Boolean(extra);
        }
      }
    }
    if (!staffAllowed && !customerAllowed) return errorResponse("Forbidden", 403);

    const mime = supportedImageMime(file);
    if (!mime) return errorResponse("Preview is available only for JPG, JPEG and PNG images", 415);

    // OAuth must be valid to read any private image. Never fall back to a public URL.
    const token = await getDriveAccessToken();
    const googleFileUrl = "https://www.googleapis.com/drive/v3/files/" + encodeURIComponent(file.drive_file_id);

    // Preferred: small private Google thumbnail, avoiding multi-megabyte artwork.
    const metadataResponse = await fetch(googleFileUrl + "?fields=id,mimeType,thumbnailLink", {
      headers: { Authorization: "Bearer " + token },
    });
    if (metadataResponse.status === 401 || metadataResponse.status === 403)
      return errorResponse("Google Drive não autorizou acesso ao arquivo. Reconecte a conta institucional.", 503);
    if (!metadataResponse.ok) return errorResponse("Google Drive não encontrou a imagem original.", 404);
    const metadata = await metadataResponse.json();
    const thumbnailLink = typeof metadata.thumbnailLink === "string" ? metadata.thumbnailLink : "";
    if (thumbnailLink) {
      const url = new URL(thumbnailLink);
      if (url.protocol === "https:" && trustedThumbnailHost(url.hostname)) {
        // Never follow arbitrary redirects with a Drive bearer token attached.
        const preview = await fetch(url, {
          headers: { Authorization: "Bearer " + token },
          redirect: "manual",
        });
        const contentType = (preview.headers.get("Content-Type") || "").split(";")[0].toLowerCase();
        if (preview.ok && ["image/jpeg","image/png","image/webp","image/gif"].includes(contentType)) {
          const bytes = await readCappedImage(preview, MAX_THUMBNAIL_BYTES);
          if (bytes) return imageResponse(bytes, contentType, "thumbnail");
        }
      }
    }

    // When Google does not supply a usable thumbnail, the original is a
    // bounded, authenticated fallback ONLY for verified JPG/JPEG/PNG.
    if (file.file_size != null && Number(file.file_size) > MAX_ORIGINAL_PREVIEW_BYTES)
      return errorResponse("A imagem original é grande demais para a prévia; baixe o arquivo.", 413);
    const original = await fetch(googleFileUrl + "?alt=media", {
      headers: { Authorization: "Bearer " + token },
      redirect: "manual",
    });
    if (original.status === 401 || original.status === 403)
      return errorResponse("Google Drive não autorizou o arquivo. Reconecte a conta institucional.", 503);
    if (!original.ok) return errorResponse("Não foi possível carregar a imagem do Google Drive.", 502);
    const bytes = await readCappedImage(original, MAX_ORIGINAL_PREVIEW_BYTES);
    if (!bytes) return errorResponse("A imagem excede o limite de pré-visualização segura.", 413);
    if (!imageMatches(bytes, mime)) return errorResponse("O conteúdo original não corresponde a uma imagem JPG/PNG.", 415);
    return imageResponse(bytes, mime, "original");
  } catch (error) {
    const message = error instanceof Error ? error.message : "";
    if (message.includes("conexão do Google Drive expirou") || message.includes("GOOGLE_DRIVE_REFRESH_TOKEN"))
      return errorResponse("Conexão do Google Drive expirada ou revogada. Um administrador precisa renovar a autorização institucional.", 503);
    if (message === "Unauthorized" || message === "Inactive user") return errorResponse("Sessão inválida ou expirada.", 401);
    // Do not expose private Google file IDs, credentials or origins.
    return errorResponse("Não foi possível preparar a imagem.", 502);
  }
});
