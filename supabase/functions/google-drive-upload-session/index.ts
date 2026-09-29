import { corsHeaders, ensureProjectFolder, getDriveAccessToken, hasPermission, json, requireUser } from "../_shared/googleDrive.ts";

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
    const customFolderId = body.custom_folder_id ? String(body.custom_folder_id) : null;

    if (!projectId || !fileName || !Number.isFinite(fileSize) || fileSize <= 0) {
      throw new Error("Invalid upload metadata");
    }

    const maxFileSize = 50 * 1024 * 1024 * 1024;
    if (fileSize > maxFileSize) {
      throw new Error("File exceeds the 50 GB limit");
    }

    const uploadId = crypto.randomUUID();

    const { data: project, error: projectError } = await ctx.db
      .from("projects")
      .select("id,customer_id")
      .eq("id", projectId)
      .single();
    if (projectError || !project) throw new Error("Project not found");

    const staffAllowed = ctx.role === "admin" || hasPermission(ctx, "files.manage");
    if (!staffAllowed && project.customer_id !== ctx.userId) throw new Error("Forbidden");
    // Customers can only send material to the intake area. Internal production,
    // approval and delivery folders are staff-controlled even when the customer owns the project.
    if (!staffAllowed && folderKind !== "received") throw new Error("Customers can only upload to received files");

    if (taskId) {
      const { data: task, error: taskError } = await ctx.db
        .from("tasks")
        .select("id,project_id")
        .eq("id", taskId)
        .single();
      if (taskError || task?.project_id !== projectId) throw new Error("Task does not belong to project");
    }

    const folders = await ensureProjectFolder(ctx.db, ctx.userId, projectId);
    let target:any = folders.folders.find((row:any) => row.folder_kind === folderKind)
      || folders.folders.find((row:any) => row.folder_kind === "received");
    if (!target) throw new Error("Drive target folder not found");

    if (customFolderId) {
      const { data: customFolder, error: customFolderError } = await ctx.db
        .from("project_custom_folders")
        .select("id,project_id,parent_kind,name,drive_folder_id,client_visible")
        .eq("id", customFolderId)
        .eq("project_id", projectId)
        .single();
      if (customFolderError || !customFolder) throw new Error("Custom folder not found");
      if (!staffAllowed && (!customFolder.client_visible || customFolder.parent_kind !== "received")) {
        throw new Error("Custom folder is not available for customer uploads");
      }
      target = {
        drive_folder_id: customFolder.drive_folder_id,
        folder_kind: customFolder.parent_kind,
        folder_name: customFolder.name,
        custom_folder_id: customFolder.id,
      };
    }

    const token = await getDriveAccessToken();
    const metadata = {
      name: fileName,
      parents: [target.drive_folder_id],
      appProperties: {
        playMomentsKind: "project-file",
        playMomentsEntityId: projectId,
        playMomentsTaskId: taskId || "",
        playMomentsUploadId: uploadId,
        playMomentsCustomFolderId: customFolderId || "",
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

    const { error: sessionError } = await ctx.db.from("drive_upload_sessions").insert({
      id: uploadId,
      user_id: ctx.userId,
      project_id: projectId,
      upload_url: uploadUrl,
      file_name: fileName,
      file_size: fileSize,
      status: "active",
    });
    if (sessionError) throw sessionError;

    return json({
      ok: true,
      upload_url: uploadUrl,
      folder_id: target.drive_folder_id,
      customer_id: project.customer_id,
      upload_id: uploadId,
      custom_folder_id: customFolderId,
    });
  } catch (error) {
    return json({ ok: false, error: error instanceof Error ? error.message : "Unknown error" }, 400);
  }
});
