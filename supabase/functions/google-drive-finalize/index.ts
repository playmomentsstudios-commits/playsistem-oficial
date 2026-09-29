import { corsHeaders, driveJson, ensureProjectFolder, getDriveAccessToken, hasPermission, json, requireUser } from "../_shared/googleDrive.ts";

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  try {
    const ctx = await requireUser(req);
    const body = await req.json();
    const projectId = String(body.project_id || "");
    const driveFileId = String(body.drive_file_id || "");
    const uploadId = String(body.upload_id || "");
    const taskId = body.task_id ? String(body.task_id) : null;
    const clientVisible = Boolean(body.client_visible);
    const customFolderId = body.custom_folder_id ? String(body.custom_folder_id) : null;

    if (!projectId || (!driveFileId && !uploadId)) throw new Error("Missing file metadata");

    const { data: project, error: projectError } = await ctx.db
      .from("projects")
      .select("id,customer_id,project_type")
      .eq("id", projectId)
      .single();
    if (projectError || !project) throw new Error("Project not found");

    const staff = ctx.role === "admin" || hasPermission(ctx, "files.manage");
    if (!staff && project.customer_id !== ctx.userId) throw new Error("Forbidden");

    if (taskId) {
      const { data: task, error: taskError } = await ctx.db
        .from("tasks")
        .select("id,project_id")
        .eq("id", taskId)
        .single();
      if (taskError || task?.project_id !== projectId) throw new Error("Task does not belong to project");
    }

    if (uploadId) {
      const { data: session, error: sessionError } = await ctx.db
        .from("drive_upload_sessions")
        .select("id,user_id,project_id,status")
        .eq("id", uploadId)
        .eq("project_id", projectId)
        .eq("user_id", ctx.userId)
        .maybeSingle();
      if (sessionError || !session) throw new Error("Upload session does not belong to this user and project");
    }

    const folders = await ensureProjectFolder(ctx.db, ctx.userId, projectId);
    const { data: customFolders, error: customFoldersError } = await ctx.db
      .from("project_custom_folders")
      .select("id,project_id,drive_folder_id")
      .eq("project_id", projectId);
    if (customFoldersError) throw customFoldersError;

    if (customFolderId && !(customFolders || []).some((row:any) => row.id === customFolderId)) {
      throw new Error("Custom folder does not belong to this project");
    }

    const allowedFolderIds = new Set<string>([
      folders.projectFolderId,
      ...folders.folders.map((row:any) => row.drive_folder_id),
      ...(customFolders || []).map((row:any) => row.drive_folder_id),
    ]);

    let file:any = null;

    if (driveFileId) {
      file = await driveJson(
        `https://www.googleapis.com/drive/v3/files/${encodeURIComponent(driveFileId)}?fields=id,name,mimeType,size,parents,webViewLink,webContentLink,trashed,appProperties`
      );
    } else {
      const q = [
        "trashed=false",
        `appProperties has { key='playMomentsUploadId' and value='${uploadId.replace(/\\/g,"\\\\").replace(/'/g,"\\'")}' }`,
        `appProperties has { key='playMomentsEntityId' and value='${projectId.replace(/\\/g,"\\\\").replace(/'/g,"\\'")}' }`,
      ].join(" and ");
      const params = new URLSearchParams({
        q,
        spaces:"drive",
        pageSize:"2",
        fields:"files(id,name,mimeType,size,parents,webViewLink,webContentLink,trashed,appProperties)",
      });
      const result = await driveJson(
        `https://www.googleapis.com/drive/v3/files?${params.toString()}`
      );
      file = result.files?.[0] || null;
      if (!file) throw new Error("Uploaded Drive file was not found yet");
    }

    if (file.trashed) throw new Error("Drive file is in trash");
    // Bind finalization to the resumable session that created the Drive object.
    // Folder membership alone is not enough proof of ownership of the upload.
    if (uploadId) {
      if (file.appProperties?.playMomentsUploadId !== uploadId
        || file.appProperties?.playMomentsEntityId !== projectId) {
        throw new Error("Drive file does not belong to this upload session");
      }
    }
    const parentId = file.parents?.[0] || null;
    if (!parentId || !allowedFolderIds.has(parentId)) {
      throw new Error("Drive file is outside this project");
    }

    // Drive objects stay private. Visibility is enforced by Play Moments and
    // authenticated downloads are proxied by google-drive-file-download.
    const values = {
      customer_id: project.customer_id,
      project_id: projectId,
      task_id: taskId,
      uploaded_by: ctx.userId,
      name: file.name,
      external_url: file.webViewLink || `https://drive.google.com/file/d/${file.id}/view`,
      storage_path: null,
      file_type: file.mimeType || null,
      client_visible: project.project_type === "internal" ? false : (staff ? clientVisible : true),
      storage_provider: "google_drive",
      drive_file_id: file.id,
      drive_folder_id: parentId,
      file_size: file.size ? Number(file.size) : null,
      mime_type: file.mimeType || null,
      custom_folder_id: customFolderId,
    };

    const { data, error } = await ctx.db
      .from("client_files")
      .upsert(values, { onConflict: "drive_file_id" })
      .select()
      .single();
    if (error) throw error;

    return json({ ok: true, file: data });
  } catch (error) {
    return json({ ok: false, error: error instanceof Error ? error.message : "Unknown error" }, 400);
  }
});
