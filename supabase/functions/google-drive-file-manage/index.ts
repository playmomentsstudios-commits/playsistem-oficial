import { corsHeaders, getDriveAccessToken, json, requirePermission, requireUser } from "../_shared/googleDrive.ts";

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  try {
    const ctx = await requireUser(req);
    requirePermission(ctx, "files.manage");

    const body = await req.json();
    const action = String(body.action || "");
    const fileId = String(body.file_id || "");
    if (!fileId) throw new Error("file_id is required");

    const { data: file, error: fileError } = await ctx.db
      .from("client_files")
      .select("id,name,project_id,storage_provider,storage_path,drive_file_id,drive_folder_id")
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

    if (action === "rename") {
      const nextName = String(body.name || "").trim();
      if (!nextName) throw new Error("File name is required");
      if (nextName.length > 255) throw new Error("File name is too long");

      if (file.storage_provider === "google_drive" && file.drive_file_id) {
        const token = await getDriveAccessToken();
        const response = await fetch(
          `https://www.googleapis.com/drive/v3/files/${encodeURIComponent(file.drive_file_id)}?fields=id,name`,
          {
            method: "PATCH",
            headers: {
              Authorization: `Bearer ${token}`,
              "Content-Type": "application/json",
            },
            body: JSON.stringify({ name: nextName }),
          },
        );
        if (!response.ok) {
          const detail = await response.text();
          throw new Error(`Could not rename Drive file: ${response.status} ${detail}`);
        }
      }

      const { error: renameError } = await ctx.db
        .from("client_files")
        .update({ name: nextName })
        .eq("id", fileId);
      if (renameError) throw renameError;

      return json({ ok: true, name: nextName });
    }

    if (action === "publish") {
      if (file.storage_provider !== "google_drive" || !file.drive_file_id) {
        throw new Error("Only Google Drive files can be published");
      }

      const token = await getDriveAccessToken();
      const response = await fetch(
        `https://www.googleapis.com/drive/v3/files/${encodeURIComponent(file.drive_file_id)}/permissions?sendNotificationEmail=false`,
        {
          method: "POST",
          headers: {
            Authorization: `Bearer ${token}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({ type: "anyone", role: "reader" }),
        },
      );

      if (!response.ok && response.status !== 409) {
        const detail = await response.text();
        throw new Error(`Could not publish Drive file: ${response.status} ${detail}`);
      }

      const { error: updateError } = await ctx.db
        .from("client_files")
        .update({ client_visible: true })
        .eq("id", fileId);
      if (updateError) throw updateError;

      return json({ ok: true });
    }

    if (action === "move") {
      const folderKind = String(body.folder_kind || "");
      const customFolderId = body.custom_folder_id ? String(body.custom_folder_id) : null;

      if (file.storage_provider !== "google_drive" || !file.drive_file_id || !file.project_id) {
        throw new Error("Only project files stored in Google Drive can be moved");
      }

      let target:any = null;

      if (customFolderId) {
        const { data: customFolder, error: customFolderError } = await ctx.db
          .from("project_custom_folders")
          .select("id,project_id,parent_kind,name,drive_folder_id")
          .eq("id", customFolderId)
          .eq("project_id", file.project_id)
          .single();
        if (customFolderError || !customFolder) throw new Error("Target custom folder not found");

        target = {
          id: customFolder.id,
          drive_folder_id: customFolder.drive_folder_id,
          folder_kind: customFolder.parent_kind,
          folder_name: customFolder.name,
          custom: true,
        };
      } else {
        const { data: standardFolder, error: folderError } = await ctx.db
          .from("project_drive_folders")
          .select("drive_folder_id,folder_kind,folder_name")
          .eq("project_id", file.project_id)
          .eq("folder_kind", folderKind)
          .single();
        if (folderError || !standardFolder) throw new Error("Target Drive folder not found");
        target = standardFolder;
      }

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
        .update({
          drive_folder_id: target.drive_folder_id,
          custom_folder_id: customFolderId,
        })
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
