import { corsHeaders, driveJson, ensureProjectFolder, json, requireUser } from "../_shared/googleDrive.ts";

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  try {
    const ctx = await requireUser(req);
    const body = await req.json();
    const projectId = String(body.project_id || "");
    const driveFileId = String(body.drive_file_id || "");
    const taskId = body.task_id ? String(body.task_id) : null;
    const clientVisible = Boolean(body.client_visible);

    if (!projectId || !driveFileId) throw new Error("Missing file metadata");

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
    const allowedFolderIds = new Set<string>([
      folders.projectFolderId,
      ...folders.folders.map((row:any) => row.drive_folder_id),
    ]);

    const file = await driveJson(
      `https://www.googleapis.com/drive/v3/files/${encodeURIComponent(driveFileId)}?fields=id,name,mimeType,size,parents,webViewLink,webContentLink,trashed`
    );

    if (file.trashed) throw new Error("Drive file is in trash");
    const parentId = file.parents?.[0] || null;
    if (!parentId || !allowedFolderIds.has(parentId)) {
      throw new Error("Drive file is outside this project");
    }

    const values = {
      customer_id: project.customer_id,
      project_id: projectId,
      task_id: taskId,
      uploaded_by: ctx.userId,
      name: file.name,
      external_url: file.webViewLink || `https://drive.google.com/file/d/${file.id}/view`,
      storage_path: null,
      file_type: file.mimeType || null,
      client_visible: staff ? clientVisible : true,
      storage_provider: "google_drive",
      drive_file_id: file.id,
      drive_folder_id: parentId,
      file_size: file.size ? Number(file.size) : null,
      mime_type: file.mimeType || null,
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
