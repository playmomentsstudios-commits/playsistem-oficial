import { corsHeaders, getDriveAccessToken, hasPermission, requireUser } from "../_shared/googleDrive.ts";

// Private thumbnail proxy for the authenticated customer portal.
// The original remains in Google Drive. Do NOT make its ACL public.
const errorResponse = (message: string, status: number) =>
  new Response(JSON.stringify({ ok: false, error: message }), {
    status, headers: { ...corsHeaders, "Content-Type": "application/json", "Cache-Control": "private, no-store" },
  });

const trustedThumbnailHost = (name: string) =>
  name === "drive.google.com" || name === "googleusercontent.com" || name.endsWith(".googleusercontent.com");

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (req.method !== "POST") return errorResponse("Method not allowed", 405);

  try {
    const ctx = await requireUser(req);
    const body = await req.json();
    const fileId = String(body?.file_id || "");
    if (!/^[0-9a-f-]{36}$/i.test(fileId)) return errorResponse("Invalid file id", 400);

    const { data: file, error } = await ctx.db.from("client_files")
      .select("id,project_id,customer_id,client_visible,storage_provider,drive_file_id,mime_type,file_type")
      .eq("id", fileId).maybeSingle();
    if (error || !file) return errorResponse("File not found", 404);
    if (file.storage_provider !== "google_drive" || !file.drive_file_id) {
      return errorResponse("Thumbnail unavailable", 404);
    }

    const staffAllowed = ctx.role === "admin"
      || hasPermission(ctx, "files.view") || hasPermission(ctx, "files.manage");
    let customerAllowed = false;
    if (ctx.role === "customer" && file.client_visible) {
      // Check project type even for primary members: internal projects must stay private.
      const { data: project } = file.project_id
        ? await ctx.db.from("projects").select("project_type").eq("id", file.project_id).maybeSingle()
        : { data: null };
      if (!file.project_id || (project && project.project_type !== "internal")) {
        customerAllowed = file.project_id ? project?.customer_id === ctx.userId : file.customer_id === ctx.userId;
        if (!customerAllowed && file.project_id) {
          const { data: extra } = await ctx.db.from("project_customer_access")
            .select("project_id").eq("project_id", file.project_id)
            .eq("customer_id", ctx.userId).maybeSingle();
          customerAllowed = Boolean(extra);
        }
      }
    }
    if (!staffAllowed && !customerAllowed) return errorResponse("Forbidden", 403);

    const token = await getDriveAccessToken();
    const metadataResponse = await fetch(
      "https://www.googleapis.com/drive/v3/files/" + encodeURIComponent(file.drive_file_id)
      + "?fields=id,mimeType,thumbnailLink",
      { headers: { Authorization: "Bearer " + token } },
    );
    if (!metadataResponse.ok) return errorResponse("Thumbnail unavailable", 404);
    const metadata = await metadataResponse.json();
    const thumbnailLink = typeof metadata.thumbnailLink === "string" ? metadata.thumbnailLink : "";
    if (!thumbnailLink) return errorResponse("Thumbnail unavailable", 404);

    const url = new URL(thumbnailLink);
    if (url.protocol !== "https:" || !trustedThumbnailHost(url.hostname)) {
      return errorResponse("Thumbnail origin not allowed", 502);
    }

    // Google returns short-lived, credentialed thumbnails. Fetch server-side, not as a
    // public <img src>, because direct private Drive URLs fail CORS/auth requirements.
    const thumbnailResponse = await fetch(url, {
      headers: { Authorization: "Bearer " + token },
      redirect: "follow",
    });
    if (!thumbnailResponse.ok) return errorResponse("Thumbnail unavailable", 404);
    const contentType = thumbnailResponse.headers.get("Content-Type") || "";
    if (!/^image\/(jpeg|png|webp|gif)(?:;|$)/i.test(contentType)) {
      return errorResponse("Unsupported thumbnail format", 415);
    }

    const declaredSize = Number(thumbnailResponse.headers.get("Content-Length") || "0");
    const maxSize = 3 * 1024 * 1024;
    if (declaredSize > maxSize) return errorResponse("Thumbnail too large", 413);
    const bytes = await thumbnailResponse.arrayBuffer();
    if (bytes.byteLength > maxSize) return errorResponse("Thumbnail too large", 413);

    return new Response(bytes, {
      status: 200,
      headers: {
        ...corsHeaders,
        "Content-Type": contentType,
        "Content-Length": String(bytes.byteLength),
        "Content-Disposition": "inline",
        "Cache-Control": "private, no-store",
        "Vary": "Authorization",
        "X-Content-Type-Options": "nosniff",
      },
    });
  } catch {
    // Avoid leaking private Drive URLs, IDs or auth details in error messages.
    return errorResponse("Não foi possível preparar a miniatura.", 400);
  }
});
