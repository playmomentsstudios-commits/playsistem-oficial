import { corsHeaders, customerCanAccessProject, driveJson, ensureProjectFolder, getDriveAccessToken, hasPermission, json, requireUser } from "../_shared/googleDrive.ts";

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
    const requestedStageId = body.stage_id ? String(body.stage_id) : null;

    if (!projectId || (!driveFileId && !uploadId)) throw new Error("Missing file metadata");

    const { data: project, error: projectError } = await ctx.db
      .from("projects")
      .select("id,customer_id,project_type")
      .eq("id", projectId)
      .single();
    if (projectError || !project) throw new Error("Project not found");

    const staff = ctx.role === "admin" || hasPermission(ctx, "files.manage");
    if (!staff && !(await customerCanAccessProject(ctx, project))) throw new Error("Forbidden");

    let taskStageId:string|null = null;
    if (taskId) {
      const { data: task, error: taskError } = await ctx.db
        .from("tasks")
        .select("id,project_id,stage_id")
        .eq("id", taskId)
        .single();
      if (taskError || task?.project_id !== projectId) throw new Error("Task does not belong to project");
      taskStageId = task.stage_id || null;
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
      .select("id,project_id,drive_folder_id,parent_kind,client_visible")
      .eq("project_id", projectId);
    if (customFoldersError) throw customFoldersError;

    const customFolder = customFolderId
      ? (customFolders || []).find((row:any) => row.id === customFolderId) || null
      : null;
    if (customFolderId && !customFolder) throw new Error("Custom folder does not belong to this project");
    if (!staff && customFolder && (!customFolder.client_visible || customFolder.parent_kind !== "received")) {
      throw new Error("Custom folder is not available for customer uploads");
    }

    const allowedFolderIds = new Set<string>([
      folders.projectFolderId,
      ...folders.folders.map((row:any) => row.drive_folder_id),
      ...(folders.stageFolders || []).map((row:any) => row.drive_folder_id),
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

    if (!staff) {
      const isReceivedFolder = (folders.folders || []).some(
        (row:any) => row.drive_folder_id === parentId && row.folder_kind === "received",
      );
      if (!isReceivedFolder && customFolder?.drive_folder_id !== parentId) {
        throw new Error("Customers can only upload to received files");
      }
    }

    const fileStageId = taskStageId || (staff ? requestedStageId : null)
      || (project.project_type === "internal" ? file.appProperties?.playMomentsStageId || null : null);
    const driveFolderKind = (folders.folders || []).find((row:any) => row.drive_folder_id === parentId)?.folder_kind
      || (customFolders || []).find((row:any) => row.drive_folder_id === parentId)?.parent_kind
      || null;

    if (fileStageId) {
      const { data: stage, error: stageError } = await ctx.db.from("project_stages")
        .select("id,project_id").eq("id",fileStageId).maybeSingle();
      if (stageError || stage?.project_id !== projectId) throw new Error("Stage does not belong to project");
      if (project.project_type === "internal"
        && !(folders.stageFolders || []).some((row:any) => row.stage_id === fileStageId)) {
        throw new Error("Stage folder does not belong to this project");
      }
    }

    // Drive objects stay private. Visibility is enforced by Play Moments and
    // authenticated downloads are proxied by google-drive-file-download.
    const values = {
      customer_id: project.customer_id,
      project_id: projectId,
      task_id: taskId,
      stage_id: fileStageId,
      uploaded_by: ctx.userId,
      name: file.name,
      external_url: file.webViewLink || `https://drive.google.com/file/d/${file.id}/view`,
      storage_path: null,
      file_type: file.mimeType || null,
      client_visible: project.project_type === "internal" ? false : (staff ? clientVisible : true),
      storage_provider: "google_drive",
      drive_file_id: file.id,
      drive_folder_id: parentId,
      drive_folder_kind: driveFolderKind,
      file_size: file.size ? Number(file.size) : null,
      mime_type: file.mimeType || null,
      custom_folder_id: customFolderId,
    };

    // Drive inventory may register a file before the upload finalizer runs.
    // UPDATE an existing record rather than INSERT ... ON CONFLICT, which can
    // run insert-only validations and make an already saved file look failed.
    const { data: existing, error: existingError } = await ctx.db
      .from("client_files").select("id,project_id")
      .eq("drive_file_id", file.id).maybeSingle();
    if (existingError) throw existingError;
    if (existing?.project_id && existing.project_id !== projectId) {
      throw new Error("File already belongs to another project");
    }
    const mutation = existing
      ? ctx.db.from("client_files").update(values).eq("id", existing.id)
      : ctx.db.from("client_files").insert({
          ...values,
          version_group_id: crypto.randomUUID(),
          version_number: 1,
        });
    const { data, error } = await mutation.select().single();
    if (error) throw error;

    return json({ ok: true, file: data });
  } catch (error) {
    const err = error as {message?:string;code?:string;details?:string;hint?:string};
    const message = typeof err?.message === "string" && err.message.trim()
      ? err.message : "Falha ao finalizar o arquivo no sistema.";
    console.error("Drive finalize failed:", {
      message,
      code: err?.code || null,
      details: err?.details || null,
    });
    return json({ ok: false, error: message }, 400);
  }
});
