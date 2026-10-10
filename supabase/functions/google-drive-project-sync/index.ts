import { corsHeaders, getDriveAccessToken, hasPermission, json, requireUser } from "../_shared/googleDrive.ts";

// Read-only Drive inventory reconciliation: never deletes a Drive object or publishes files.
// Every discovered file is recorded against the authoritative Google Drive ID.
type Folder = { id: string; customId: string | null; stageId: string | null; depth: number };
type DriveEntry = { id: string; name: string; mimeType: string; size?: string; webViewLink?: string; createdTime?: string };
const DRIVE_FOLDER = "application/vnd.google-apps.folder";
const MAX_ITEMS = 2500;
const MAX_DEPTH = 3;

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (req.method !== "POST") return json({ ok: false, error: "Method not allowed" }, 405);
  try {
    const ctx = await requireUser(req);
    if (!hasPermission(ctx, "files.manage") && !hasPermission(ctx, "files.view") && !hasPermission(ctx, "projects.manage")) {
      return json({ ok: false, error: "Forbidden" }, 403);
    }
    const body = await req.json();
    const projectId = String(body?.project_id || "");
    if (!/^[0-9a-f-]{36}$/i.test(projectId)) return json({ ok: false, error: "Invalid project ID" }, 400);

    const { data: project, error: projectError } = await ctx.db.from("projects")
      .select("id,customer_id,project_type,drive_folder_id").eq("id", projectId).maybeSingle();
    if (projectError || !project) return json({ ok: false, error: "Project not found" }, 404);
    if (!project.drive_folder_id) return json({ ok: true, added: 0, updated: 0, scanned: 0, folders: 0, unconfigured: true });

    const [standard, custom, stages, existing] = await Promise.all([
      ctx.db.from("project_drive_folders").select("drive_folder_id").eq("project_id", projectId),
      ctx.db.from("project_custom_folders").select("id,drive_folder_id").eq("project_id", projectId),
      ctx.db.from("project_stage_drive_folders").select("stage_id,drive_folder_id").eq("project_id", projectId),
      ctx.db.from("client_files").select("id,name,drive_file_id,project_id,customer_id,drive_folder_id,mime_type,file_size,custom_folder_id,stage_id").eq("project_id", projectId).eq("storage_provider", "google_drive"),
    ]);
    for (const result of [standard, custom, stages, existing]) if (result.error) throw result.error;

    const queue: Folder[] = [];
    const seenFolders = new Set<string>();
    const addFolder = (id: string | null, customId: string | null, stageId: string | null, depth: number) => {
      if (!id || seenFolders.has(id)) return;
      seenFolders.add(id);
      queue.push({ id, customId, stageId, depth });
    };
    addFolder(project.drive_folder_id, null, null, 0);
    for (const row of standard.data || []) addFolder(row.drive_folder_id, null, null, 1);
    for (const row of custom.data || []) addFolder(row.drive_folder_id, row.id, null, 2);
    for (const row of stages.data || []) addFolder(row.drive_folder_id, null, row.stage_id, 1);

    const known = new Map<string, any>((existing.data || []).filter((row: any) => row.drive_file_id).map((row: any) => [row.drive_file_id, row]));
    const token = await getDriveAccessToken();
    const scannedIds = new Set<string>();
    let scanned = 0, added = 0, updated = 0;
    const escaped = (value: string) => value.replace(/\\/g, "\\\\").replace(/'/g, "\\'");
    const getEntries = async (folderId: string): Promise<DriveEntry[]> => {
      const out: DriveEntry[] = [];
      let pageToken = "";
      do {
        const params = new URLSearchParams({
          q: "'" + escaped(folderId) + "' in parents and trashed=false",
          pageSize: "1000",
          fields: "nextPageToken,files(id,name,mimeType,size,webViewLink,createdTime)",
          spaces: "drive",
          supportsAllDrives: "true",
          includeItemsFromAllDrives: "true",
        });
        if (pageToken) params.set("pageToken", pageToken);
        const response = await fetch("https://www.googleapis.com/drive/v3/files?" + params, {
          headers: { Authorization: "Bearer " + token },
        });
        if (!response.ok) throw new Error("Google Drive inventory failed (" + response.status + ")");
        const page = await response.json();
        out.push(...(page.files || []));
        pageToken = String(page.nextPageToken || "");
        if (out.length + scanned > MAX_ITEMS) throw new Error("A pasta excede o limite de sincronização por execução.");
      } while (pageToken);
      return out;
    };

    for (let index = 0; index < queue.length; index++) {
      const folder = queue[index];
      const entries = await getEntries(folder.id);
      for (const entry of entries) {
        if (entry.mimeType === DRIVE_FOLDER) {
          if (folder.depth < MAX_DEPTH) addFolder(entry.id, folder.customId, folder.stageId, folder.depth + 1);
          continue;
        }
        if (scannedIds.has(entry.id)) continue;
        scannedIds.add(entry.id);
        scanned++;
        const matched = known.get(entry.id);
        const size = /^\d+$/.test(entry.size || "") ? Number(entry.size) : null;
        const metadata = {
          name: entry.name,
          drive_folder_id: folder.id,
          mime_type: entry.mimeType || "application/octet-stream",
          file_type: entry.mimeType || "application/octet-stream",
          file_size: size,
          custom_folder_id: folder.customId,
          stage_id: folder.stageId,
        };
        if (matched) {
          const changes: Record<string, unknown> = {};
          for (const [key, value] of Object.entries(metadata)) {
            if ((matched[key] ?? null) !== value && key !== "file_type") changes[key] = value;
          }
          if (Object.keys(changes).length) {
            const { error } = await ctx.db.from("client_files").update(changes).eq("id", matched.id);
            if (error) throw error;
            updated++;
          }
          continue;
        }
        // An object can have been registered in a different project and physically moved in Drive.
        const { data: globalExisting, error: globalError } = await ctx.db.from("client_files")
          .select("id,project_id").eq("drive_file_id", entry.id).maybeSingle();
        if (globalError) throw globalError;
        if (globalExisting) {
          const { error } = await ctx.db.from("client_files").update({
            ...metadata, project_id: projectId, customer_id: project.customer_id,
            client_visible: false, task_id: null,
          }).eq("id", globalExisting.id);
          if (error) throw error;
          updated++;
          continue;
        }
        const { error } = await ctx.db.from("client_files").insert({
          ...metadata,
          project_id: projectId,
          customer_id: project.customer_id,
          uploaded_by: ctx.userId,
          storage_provider: "google_drive",
          drive_file_id: entry.id,
          external_url: entry.webViewLink || "https://drive.google.com/file/d/" + encodeURIComponent(entry.id) + "/view",
          version_group_id: crypto.randomUUID(),
          version_number: 1,
          client_visible: false, // Explicit human approval required for customer visibility.
        });
        if (error && error.code !== "23505") throw error;
        if (!error) added++;
      }
    }
    return json({ ok: true, project_id: projectId, added, updated, scanned, folders: queue.length });
  } catch (error) {
    return json({ ok: false, error: error instanceof Error ? error.message : "Falha na sincronização" }, 400);
  }
});
