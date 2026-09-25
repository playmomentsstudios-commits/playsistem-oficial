import { corsHeaders, getDriveAccessToken, json, requireStaff, requireUser } from "../_shared/googleDrive.ts";

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  try {
    const ctx = await requireUser(req);
    requireStaff(ctx);

    const body = await req.json();
    const action = String(body.action || "");
    const fileId = String(body.file_id || "");
    if (!fileId) throw new Error("file_id is required");

    const { data: file, error: fileError } = await ctx.db
      .from("client_files")
      .select("id,project_id,storage_provider,storage_path,drive_file_id,drive_folder_id")
      .eq("id", fileId)
      .single();
    if (fileError || !file) throw new Error("File not found");

    if (action === "delete") {
      if (file.storage_provider === "google_drive" && file.drive_file_id) {
        const token = await getDriveAccessToken();
        const response = await fetch(
          `https://www.googleapis.com/drive/v3/files/${encodeURIComponent(file.drive_file_id)}`,
          { method: "DELETE", headers: { Authorization: `Bearer ${token}` } },
        );
        if (!response.ok && response.status !== 404) {
          const detail = await response.text();
          throw new Error(`Could not delete Drive file: ${response.status} ${detail}`);
        }
      }

      if (file.storage_provider === "supabase" && file.storage_path) {
        const { error: storageError } = await ctx.db.storage
          .from("client-files")
          .remove([file.storage_path]);
        if (storageError) throw storageError;
      }

      const { error: deleteError } = await ctx.db
        .from("client_files")
        .delete()
        .eq("id", fileId);
      if (deleteError) throw deleteError;

      return json({ ok: true });
    }

    if (action === "move") {
      const folderKind = String(body.folder_kind || "");
      if (file.storage_provider !== "google_drive" || !file.drive_file_id || !file.project_id) {
        throw new Error("Only project files stored in Google Drive can be moved");
      }

      const { data: target, error: folderError } = await ctx.db
        .from("project_drive_folders")
        .select("drive_folder_id,folder_kind,folder_name")
        .eq("project_id", file.project_id)
        .eq("folder_kind", folderKind)
        .single();
      if (folderError || !target) throw new Error("Target Drive folder not found");

      const token = await getDriveAccessToken();
      const params = new URLSearchParams({
        addParents: target.drive_folder_id,
        fields: "id,parents",
      });
      if (file.drive_folder_id) params.set("removeParents", file.drive_folder_id);

      const response = await fetch(
        `https://www.googleapis.com/drive/v3/files/${encodeURIComponent(file.drive_file_id)}?${params.toString()}`,
        {
          method: "PATCH",
          headers: { Authorization: `Bearer ${token}` },
        },
      );

      if (!response.ok) {
        const detail = await response.text();
        throw new Error(`Could not move Drive file: ${response.status} ${detail}`);
      }

      const { error: updateError } = await ctx.db
        .from("client_files")
        .update({ drive_folder_id: target.drive_folder_id })
        .eq("id", fileId);
      if (updateError) throw updateError;

      return json({ ok: true, folder: target });
    }

    throw new Error("Unsupported action");
  } catch (error) {
    return json(
      { ok: false, error: error instanceof Error ? error.message : "Unknown error" },
      400,
    );
  }
});
