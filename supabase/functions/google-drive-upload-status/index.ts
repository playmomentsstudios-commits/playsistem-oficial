import { corsHeaders, getDriveAccessToken, json, requireUser } from "../_shared/googleDrive.ts";

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

    const staff = ["admin","staff"].includes(ctx.role);
    if (!staff && project.customer_id !== ctx.userId) throw new Error("Forbidden");

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
      return json({ ok:true, complete:true, file });
    }

    if (response.status === 404) {
      return json({ ok:false, expired:true, error:"Upload session expired" }, 410);
    }

    const detail = await response.text();
    return json({ ok:false, error:`Google Drive status error ${response.status}: ${detail}` }, 400);
  } catch (error) {
    return json({ ok:false, error:error instanceof Error ? error.message : "Unknown error" }, 400);
  }
});
