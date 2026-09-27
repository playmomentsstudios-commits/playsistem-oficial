import { corsHeaders, getDriveAccessToken, hasPermission, requireUser } from "../_shared/googleDrive.ts";

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  try {
    const ctx = await requireUser(req);
    const body = await req.json();
    const fileId = String(body.file_id || "");
    if (!fileId) throw new Error("file_id is required");

    const { data: file, error } = await ctx.db
      .from("client_files")
      .select("id,name,customer_id,client_visible,storage_provider,drive_file_id,mime_type")
      .eq("id", fileId)
      .single();
    if (error || !file) throw new Error("File not found");
    if (file.storage_provider !== "google_drive" || !file.drive_file_id) {
      throw new Error("File is not stored in Google Drive");
    }

    const staffAllowed = ctx.role === "admin"
      || hasPermission(ctx, "files.view")
      || hasPermission(ctx, "files.manage");
    const customerAllowed = file.customer_id === ctx.userId && file.client_visible;
    if (!staffAllowed && !customerAllowed) throw new Error("Forbidden");

    const token = await getDriveAccessToken();
    const response = await fetch(
      `https://www.googleapis.com/drive/v3/files/${encodeURIComponent(file.drive_file_id)}?alt=media`,
      { headers: { Authorization: `Bearer ${token}` } },
    );
    if (!response.ok || !response.body) {
      const detail = await response.text();
      throw new Error(`Could not download Drive file: ${response.status} ${detail}`);
    }

    const headers = new Headers(corsHeaders);
    headers.set("Content-Type", response.headers.get("Content-Type") || file.mime_type || "application/octet-stream");
    const length = response.headers.get("Content-Length");
    if (length) headers.set("Content-Length", length);
    headers.set("Content-Disposition", `inline; filename*=UTF-8''${encodeURIComponent(file.name)}`);
    headers.set("Cache-Control", "private, no-store");

    return new Response(response.body, { status: 200, headers });
  } catch (error) {
    return new Response(
      JSON.stringify({ ok: false, error: error instanceof Error ? error.message : "Unknown error" }),
      { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  }
});
