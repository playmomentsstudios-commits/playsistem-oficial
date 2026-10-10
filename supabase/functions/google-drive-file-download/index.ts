import { corsHeaders, getDriveAccessToken, hasPermission, requireUser } from "../_shared/googleDrive.ts";

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  try {
    const ctx = await requireUser(req);
    const body = await req.json();
    const fileId = String(body.file_id || "");
    if (!/^[0-9a-f-]{36}$/i.test(fileId)) throw new Error("Invalid file id");

    const { data: file, error } = await ctx.db
      .from("client_files")
      .select("id,name,customer_id,project_id,client_visible,storage_provider,drive_file_id,mime_type")
      .eq("id", fileId)
      .single();
    if (error || !file) throw new Error("File not found");
    if (file.storage_provider !== "google_drive" || !file.drive_file_id) {
      throw new Error("File is not stored in Google Drive");
    }

    const staffAllowed = ctx.role === "admin"
      || hasPermission(ctx, "files.view")
      || hasPermission(ctx, "files.manage");
    const { data: linkedProject } = file.project_id
      ? await ctx.db.from("projects").select("customer_id,project_type").eq("id",file.project_id).maybeSingle()
      : { data: null };
    const isPrimaryCustomer = ctx.role === "customer" && file.client_visible
      && (file.project_id ? linkedProject?.project_type !== "internal" && linkedProject?.customer_id === ctx.userId : file.customer_id === ctx.userId);
    let isAdditionalViewer = false;
    if (ctx.role === "customer" && file.client_visible && file.project_id && !isPrimaryCustomer) {
      // Always authorize from the database. Never trust project/customer IDs sent by the client.
      const { data: project } = await ctx.db
        .from("projects").select("project_type").eq("id", file.project_id).maybeSingle();
      if (project && project.project_type !== "internal") {
        const { data: access } = await ctx.db.from("project_customer_access")
          .select("project_id").eq("project_id", file.project_id)
          .eq("customer_id", ctx.userId).maybeSingle();
        isAdditionalViewer = Boolean(access);
      }
    }
    if (!staffAllowed && !isPrimaryCustomer && !isAdditionalViewer) throw new Error("Forbidden");

    const token = await getDriveAccessToken();
    const response = await fetch(
      `https://www.googleapis.com/drive/v3/files/${encodeURIComponent(file.drive_file_id)}?alt=media`,
      { headers: { Authorization: `Bearer ${token}` } },
    );
    if (!response.ok || !response.body) {
      // Avoid returning private Google API bodies and file identifiers to clients.
      if (response.status === 401 || response.status === 403) {
        throw new Error("O Google Drive recusou a autorização. Reconecte a conta institucional.");
      }
      throw new Error("Não foi possível recuperar este arquivo no Google Drive.");
    }

    const headers = new Headers(corsHeaders);
    const upstreamType = response.headers.get("Content-Type") || "";
    headers.set("Content-Type", upstreamType === "application/octet-stream" && file.mime_type ? file.mime_type : upstreamType || file.mime_type || "application/octet-stream");
    const length = response.headers.get("Content-Length");
    if (length) headers.set("Content-Length", length);
    headers.set("Content-Disposition", `inline; filename*=UTF-8''${encodeURIComponent(file.name)}`);
    headers.set("Cache-Control", "private, no-store");

    return new Response(response.body, { status: 200, headers });
  } catch (error) {
    const reason = error instanceof Error ? error.message : "";
    const expired = /conexão do Google Drive expirou|revogad|GOOGLE_DRIVE_REFRESH_TOKEN/i.test(reason);
    const forbidden = /Forbidden|File not found|File is not stored/i.test(reason);
    const unauthorized = /Unauthorized|Inactive user/i.test(reason);
    const message = expired
      ? "Conexão do Google Drive expirada ou revogada. Um administrador precisa renovar a autorização institucional."
      : forbidden ? "Arquivo indisponível para sua conta."
      : unauthorized ? "Sua sessão expirou. Entre novamente."
      : reason.startsWith("O Google Drive recusou") || reason.startsWith("Não foi possível recuperar")
        ? reason : "Não foi possível recuperar o arquivo.";
    return new Response(JSON.stringify({ ok: false, error: message }), {
      status: expired ? 503 : unauthorized ? 401 : forbidden ? 403 : 502,
      headers: { ...corsHeaders, "Content-Type": "application/json", "Cache-Control": "private, no-store" },
    });
  }
});
