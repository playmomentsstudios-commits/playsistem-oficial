import { corsHeaders, createDriveFolder, ensureProjectFolder, json, requirePermission, requireUser } from "../_shared/googleDrive.ts";

const allowedKinds = new Set(["received","raw","production","preview","approved","delivery"]);

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  try {
    const ctx = await requireUser(req);
    requirePermission(ctx, "files.manage");

    const body = await req.json();
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
    const parent = ensured.folders.find((row:any) => row.folder_kind === parentKind);
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
