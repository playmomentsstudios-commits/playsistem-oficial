import { corsHeaders, ensureProjectFolder, getDriveAccessToken, json, requireUser } from "../_shared/googleDrive.ts";

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  try {
    const ctx = await requireUser(req);
    const body = await req.json();
    const projectId = String(body.project_id || "");
    const taskId = body.task_id ? String(body.task_id) : null;
    const fileName = String(body.file_name || "").trim();
    const mimeType = String(body.mime_type || "application/octet-stream");
    const fileSize = Number(body.file_size || 0);
    const folderKind = String(body.folder_kind || "received");

    if (!projectId || !fileName || !Number.isFinite(fileSize) || fileSize <= 0) {
      throw new Error("Invalid upload metadata");
    }

    const maxFileSize = 1024 * 1024 * 1024;
    if (fileSize > maxFileSize) {
      throw new Error("File exceeds the 1 GB limit");
    }

    const uploadId = crypto.randomUUID();

    const { data: project, error: projectError } = await ctx.db
      .from("projects")
      .select("id,customer_id")
      .eq("id", projectId)
      .single();
    if (projectError || !project) throw new Error("Project not found");

    const staff = ["admin","staff"].includes(ctx.role);
    if (!staff && project.customer_id !== ctx.userId) throw new Error("Forbidden");

    if (taskId) {
      const { data: task, error: taskError } = await ctx.db
        .from("tasks")
        .select("id,project_id")
        .eq("id", taskId)
        .single();
      if (taskError || task?.project_id !== projectId) throw new Error("Task does not belong to project");
    }

    const folders = await ensureProjectFolder(ctx.db, ctx.userId, projectId);
    const target = folders.folders.find((row:any) => row.folder_kind === folderKind)
      || folders.folders.find((row:any) => row.folder_kind === "received");
    if (!target) throw new Error("Drive target folder not found");

    const token = await getDriveAccessToken();
    const metadata = {
      name: fileName,
      parents: [target.drive_folder_id],
      appProperties: {
        playMomentsKind: "project-file",
        playMomentsEntityId: projectId,
        playMomentsTaskId: taskId || "",
        playMomentsUploadId: uploadId,
      },
    };

    const response = await fetch(
      "https://www.googleapis.com/upload/drive/v3/files?uploadType=resumable&fields=id,name,mimeType,size,parents,webViewLink,webContentLink",
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json; charset=UTF-8",
          "X-Upload-Content-Type": mimeType,
          "X-Upload-Content-Length": String(fileSize),
        },
        body: JSON.stringify(metadata),
      },
    );

    if (!response.ok) {
      const payload = await response.text();
      throw new Error(`Could not create Drive upload session: ${response.status} ${payload}`);
    }

    const uploadUrl = response.headers.get("Location");
    if (!uploadUrl) throw new Error("Google Drive did not return an upload session");

    return json({
      ok: true,
      upload_url: uploadUrl,
      folder_id: target.drive_folder_id,
      customer_id: project.customer_id,
      upload_id: uploadId,
    });
  } catch (error) {
    return json({ ok: false, error: error instanceof Error ? error.message : "Unknown error" }, 400);
  }
});
