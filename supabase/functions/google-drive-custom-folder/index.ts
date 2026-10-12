import { corsHeaders, createDriveFolder, ensureProjectFolder, getDriveAccessToken, json, requirePermission, requireUser } from "../_shared/googleDrive.ts";

const allowedKinds = new Set(["root","received","raw","production","preview","approved","delivery"]);

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  try {
    const ctx = await requireUser(req);
    requirePermission(ctx, "files.manage");

    const body = await req.json();
    if (body.action === "delete") {
      const folderId = String(body.folder_id || "");
      const projectId = String(body.project_id || "");
      if (!folderId || !projectId) throw new Error("Folder and project are required");
      const { data: folder, error: lookupError } = await ctx.db
        .from("project_custom_folders").select("id,project_id,drive_folder_id,parent_kind")
        .eq("id", folderId).eq("project_id",projectId).single();
      if (lookupError || !folder) throw new Error("Custom folder not found");
      if (folder.parent_kind !== "root") throw new Error("Only extra project-root folders can be removed here");

      // Never delete folders with any contents (including unindexed Drive objects).
      const token = await getDriveAccessToken();
      const params = new URLSearchParams({
        q: "'" + folder.drive_folder_id.replace(/'/g, "\\'") + "' in parents and trashed = false",
        fields: "files(id),nextPageToken", pageSize: "1",
      });
      const inspect = await fetch("https://www.googleapis.com/drive/v3/files?" + params.toString(), {
        headers: { Authorization: "Bearer " + token },
      });
      if (!inspect.ok) throw new Error("Could not verify folder contents");
      const inventory = await inspect.json();
      if (inventory.files?.length) throw new Error("Move or remove the files before deleting this folder");

      const trash = await fetch("https://www.googleapis.com/drive/v3/files/" + encodeURIComponent(folder.drive_folder_id), {
        method: "PATCH",
        headers: { Authorization: "Bearer " + token, "Content-Type": "application/json" },
        body: JSON.stringify({ trashed: true }),
      });
      if (!trash.ok) throw new Error("Could not move folder to Drive trash");
      const { error: removalError } = await ctx.db.from("project_custom_folders")
        .delete().eq("id", folder.id).eq("project_id",projectId);
      if (removalError) throw removalError;
      return json({ ok: true, removed: true });
    }

    const projectId = String(body.project_id || "");
    const parentKind = String(body.parent_kind || "received");
    const name = String(body.name || "").trim();
    const clientVisible = Boolean(body.client_visible);

    if (!projectId) throw new Error("project_id is required");
    if (!allowedKinds.has(parentKind)) throw new Error("Invalid parent folder");
    if (!name || name.length > 120) throw new Error("Folder name must have 1 to 120 characters");

    const { data: project, error: projectError } = await ctx.db
      .from("projects")
      .select("id,customer_id")
      .eq("id", projectId)
      .single();
    if (projectError || !project) throw new Error("Project not found");

    const ensured = await ensureProjectFolder(ctx.db, ctx.userId, projectId);
    const parent = parentKind === "root" ? { drive_folder_id: ensured.projectFolderId } : ensured.folders.find((row:any) => row.folder_kind === parentKind);
    if (!parent) throw new Error("Parent Drive folder not found");

    const { data: existing, error: existingError } = await ctx.db
      .from("project_custom_folders")
      .select("*")
      .eq("project_id", projectId)
      .eq("parent_kind", parentKind)
      .ilike("name", name)
      .maybeSingle();
    if (existingError) throw existingError;
    if (existing) return json({ ok: true, folder: existing, existing: true });

    const id = crypto.randomUUID();
    const driveFolder = await createDriveFolder(
      name,
      parent.drive_folder_id,
      {
        playMomentsKind: "project-custom-folder",
        playMomentsEntityId: projectId,
        playMomentsCustomFolderId: id,
        playMomentsParentKind: parentKind,
      },
    );

    const { data: folder, error: insertError } = await ctx.db
      .from("project_custom_folders")
      .insert({
        id,
        project_id: projectId,
        parent_kind: parentKind,
        name,
        drive_folder_id: driveFolder.id,
        client_visible: clientVisible,
        created_by: ctx.userId,
      })
      .select()
      .single();

    if (insertError) throw insertError;

    return json({ ok: true, folder });
  } catch (error) {
    return json({ ok: false, error: error instanceof Error ? error.message : "Unknown error" }, 400);
  }
});
