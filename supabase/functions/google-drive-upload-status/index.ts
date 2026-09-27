import { corsHeaders, getDriveAccessToken, hasPermission, json, requireUser } from "../_shared/googleDrive.ts";

function isAllowedUploadUrl(value:string) {
  try {
    const url = new URL(value);
    return url.protocol === "https:"
      && url.hostname === "www.googleapis.com"
      && url.pathname === "/upload/drive/v3/files"
      && url.searchParams.get("uploadType") === "resumable"
      && Boolean(url.searchParams.get("upload_id"));
  } catch {
    return false;
  }
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  try {
    const ctx = await requireUser(req);
    const body = await req.json();
    const projectId = String(body.project_id || "");
    const uploadUrl = String(body.upload_url || "");
    const fileSize = Number(body.file_size || 0);

    if (!projectId || !isAllowedUploadUrl(uploadUrl) || !Number.isFinite(fileSize) || fileSize <= 0) {
      throw new Error("Invalid upload status request");
    }

    const { data: project, error: projectError } = await ctx.db
      .from("projects")
      .select("id,customer_id")
      .eq("id", projectId)
      .single();
    if (projectError || !project) throw new Error("Project not found");

    const staffAllowed = ctx.role === "admin" || hasPermission(ctx, "files.manage");
    if (!staffAllowed && project.customer_id !== ctx.userId) throw new Error("Forbidden");

    const { data: session, error: sessionError } = await ctx.db
      .from("drive_upload_sessions")
      .select("id,user_id,project_id,file_size,status")
      .eq("upload_url", uploadUrl)
      .eq("project_id", projectId)
      .eq("user_id", ctx.userId)
      .maybeSingle();
    if (sessionError || !session || session.status !== "active" || Number(session.file_size) !== fileSize) {
      throw new Error("Upload session does not belong to this user and project");
    }

    const token = await getDriveAccessToken();
    const response = await fetch(uploadUrl, {
      method: "PUT",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Length": "0",
        "Content-Range": `bytes */${fileSize}`,
      },
    });

    if (response.status === 308) {
      const range = response.headers.get("Range");
      const match = range?.match(/bytes=0-(\d+)/);
      const nextOffset = match ? Number(match[1]) + 1 : 0;
      return json({ ok:true, complete:false, next_offset:nextOffset });
    }

    if (response.ok) {
      const file = await response.json().catch(() => null);
      await ctx.db.from("drive_upload_sessions").update({ status:"completed", completed_at:new Date().toISOString() }).eq("id", session.id);
      return json({ ok:true, complete:true, file });
    }

    if (response.status === 404) {
      await ctx.db.from("drive_upload_sessions").update({ status:"expired" }).eq("id", session.id);
      return json({ ok:false, expired:true, error:"Upload session expired" }, 410);
    }

    const detail = await response.text();
    return json({ ok:false, error:`Google Drive status error ${response.status}: ${detail}` }, 400);
  } catch (error) {
    return json({ ok:false, error:error instanceof Error ? error.message : "Unknown error" }, 400);
  }
});
