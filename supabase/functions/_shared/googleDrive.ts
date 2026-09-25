import { createClient, type SupabaseClient } from "npm:@supabase/supabase-js@2";

export const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

export function json(data: unknown, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

function env(name: string) {
  const value = Deno.env.get(name);
  if (!value) throw new Error(`Missing secret: ${name}`);
  return value;
}

export type RequestContext = {
  db: SupabaseClient;
  userId: string;
  role: string;
};

export async function requireUser(req: Request): Promise<RequestContext> {
  const authorization = req.headers.get("Authorization") || "";
  const token = authorization.replace(/^Bearer\s+/i, "");
  if (!token) throw new Error("Unauthorized");

  const db = createClient(
    env("SUPABASE_URL"),
    env("SUPABASE_SERVICE_ROLE_KEY"),
    { auth: { persistSession: false, autoRefreshToken: false } },
  );

  const { data: authData, error: authError } = await db.auth.getUser(token);
  if (authError || !authData.user) throw new Error("Unauthorized");

  const { data: profile, error: profileError } = await db
    .from("profiles")
    .select("id,role,status")
    .eq("id", authData.user.id)
    .single();

  if (profileError || !profile || profile.status !== "active") {
    throw new Error("Inactive user");
  }

  return { db, userId: authData.user.id, role: profile.role };
}

export function requireStaff(ctx: RequestContext) {
  if (!["admin", "staff"].includes(ctx.role)) {
    throw new Error("Staff access required");
  }
}

export async function getDriveAccessToken() {
  const body = new URLSearchParams({
    client_id: env("GOOGLE_DRIVE_CLIENT_ID"),
    client_secret: env("GOOGLE_DRIVE_CLIENT_SECRET"),
    refresh_token: env("GOOGLE_DRIVE_REFRESH_TOKEN"),
    grant_type: "refresh_token",
  });

  const response = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body,
  });

  const payload = await response.json();
  if (!response.ok || !payload.access_token) {
    throw new Error(payload.error_description || payload.error || "Google OAuth token refresh failed");
  }

  return payload.access_token as string;
}

export async function driveJson(
  url: string,
  init: RequestInit = {},
) {
  const token = await getDriveAccessToken();
  const response = await fetch(url, {
    ...init,
    headers: {
      Authorization: `Bearer ${token}`,
      ...(init.headers || {}),
    },
  });

  const text = await response.text();
  const payload = text ? JSON.parse(text) : null;
  if (!response.ok) {
    throw new Error(payload?.error?.message || `Google Drive error ${response.status}`);
  }

  return payload;
}

function escapeDriveQuery(value: string) {
  return value.replace(/\\/g, "\\\\").replace(/'/g, "\\'");
}

export async function createDriveFolder(
  name: string,
  parentId: string | null,
  appProperties: Record<string,string>,
) {
  const metadata: Record<string,unknown> = {
    name,
    mimeType: "application/vnd.google-apps.folder",
    appProperties,
  };
  if (parentId) metadata.parents = [parentId];

  return await driveJson(
    "https://www.googleapis.com/drive/v3/files?fields=id,name,webViewLink,parents,appProperties",
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(metadata),
    },
  );
}

export async function findDriveFolder(
  parentId: string,
  kind: string,
  entityId?: string,
) {
  const conditions = [
    `'${escapeDriveQuery(parentId)}' in parents`,
    "mimeType='application/vnd.google-apps.folder'",
    "trashed=false",
    `appProperties has { key='playMomentsKind' and value='${escapeDriveQuery(kind)}' }`,
  ];
  if (entityId) {
    conditions.push(
      `appProperties has { key='playMomentsEntityId' and value='${escapeDriveQuery(entityId)}' }`,
    );
  }

  const params = new URLSearchParams({
    q: conditions.join(" and "),
    spaces: "drive",
    fields: "files(id,name,webViewLink,parents,appProperties)",
    pageSize: "10",
  });

  const result = await driveJson(
    `https://www.googleapis.com/drive/v3/files?${params.toString()}`,
  );
  return result.files?.[0] || null;
}

export async function ensureDriveRoot(db: SupabaseClient, userId: string) {
  const { data: settings, error } = await db
    .from("drive_settings")
    .select("*")
    .eq("id", true)
    .maybeSingle();
  if (error) throw error;

  let rootFolderId = settings?.root_folder_id || null;
  let clientsFolderId = settings?.clients_folder_id || null;

  if (!rootFolderId) {
    const root = await createDriveFolder(
      settings?.root_folder_name || "PLAY MOMENTS",
      null,
      { playMomentsKind: "root" },
    );
    rootFolderId = root.id;
  }

  if (!clientsFolderId) {
    const existing = await findDriveFolder(rootFolderId, "clients-root");
    const clients = existing || await createDriveFolder(
      "CLIENTES",
      rootFolderId,
      { playMomentsKind: "clients-root" },
    );
    clientsFolderId = clients.id;
  }

  const { error: updateError } = await db
    .from("drive_settings")
    .update({
      root_folder_id: rootFolderId,
      clients_folder_id: clientsFolderId,
      updated_at: new Date().toISOString(),
      updated_by: userId,
    })
    .eq("id", true);
  if (updateError) throw updateError;

  return { rootFolderId, clientsFolderId };
}

export async function ensureClientFolder(
  db: SupabaseClient,
  userId: string,
  customerId: string,
) {
  const { data: customer, error } = await db
    .from("profiles")
    .select("id,first_name,last_name,email,role,drive_folder_id")
    .eq("id", customerId)
    .single();
  if (error) throw error;
  if (customer.role !== "customer") throw new Error("Customer not found");

  if (customer.drive_folder_id) {
    return { customerFolderId: customer.drive_folder_id };
  }

  const { clientsFolderId } = await ensureDriveRoot(db, userId);
  const existing = await findDriveFolder(clientsFolderId, "customer", customerId);
  const displayName = [customer.first_name, customer.last_name].filter(Boolean).join(" ").trim()
    || customer.email
    || "Cliente";
  const folder = existing || await createDriveFolder(
    `${displayName} - ${customerId.slice(0,8)}`,
    clientsFolderId,
    { playMomentsKind: "customer", playMomentsEntityId: customerId },
  );

  await db.from("profiles")
    .update({ drive_folder_id: folder.id })
    .eq("id", customerId);

  return { customerFolderId: folder.id };
}

export const projectFolderKinds = [
  ["received", "01 - Arquivos recebidos"],
  ["raw", "02 - Brutos"],
  ["production", "03 - Produção"],
  ["preview", "04 - Prévia"],
  ["approved", "05 - Aprovados"],
  ["delivery", "06 - Entrega final"],
] as const;

export async function ensureProjectFolder(
  db: SupabaseClient,
  userId: string,
  projectId: string,
) {
  const { data: project, error } = await db
    .from("projects")
    .select("id,title,customer_id,drive_folder_id")
    .eq("id", projectId)
    .single();
  if (error) throw error;
  if (!project.customer_id) throw new Error("Project has no customer");

  const { customerFolderId } = await ensureClientFolder(
    db,
    userId,
    project.customer_id,
  );

  let projectsRoot = await findDriveFolder(
    customerFolderId,
    "customer-projects-root",
    project.customer_id,
  );
  if (!projectsRoot) {
    projectsRoot = await createDriveFolder(
      "PROJETOS",
      customerFolderId,
      {
        playMomentsKind: "customer-projects-root",
        playMomentsEntityId: project.customer_id,
      },
    );
  }

  let projectFolderId = project.drive_folder_id || null;
  if (!projectFolderId) {
    const existing = await findDriveFolder(projectsRoot.id, "project", projectId);
    const projectFolder = existing || await createDriveFolder(
      `PM-${projectId.slice(0,8).toUpperCase()} - ${project.title}`,
      projectsRoot.id,
      { playMomentsKind: "project", playMomentsEntityId: projectId },
    );
    projectFolderId = projectFolder.id;
    await db.from("projects")
      .update({ drive_folder_id: projectFolderId })
      .eq("id", projectId);
  }

  const { data: currentFolders, error: folderError } = await db
    .from("project_drive_folders")
    .select("*")
    .eq("project_id", projectId);
  if (folderError) throw folderError;

  const byKind = new Map((currentFolders || []).map((row:any) => [row.folder_kind,row]));
  for (const [kind, name] of projectFolderKinds) {
    if (byKind.has(kind)) continue;
    const existing = await findDriveFolder(projectFolderId, `project-${kind}`, projectId);
    const folder = existing || await createDriveFolder(
      name,
      projectFolderId,
      { playMomentsKind: `project-${kind}`, playMomentsEntityId: projectId },
    );
    const { error: upsertError } = await db.from("project_drive_folders").upsert({
      project_id: projectId,
      folder_kind: kind,
      drive_folder_id: folder.id,
      folder_name: name,
    });
    if (upsertError) throw upsertError;
  }

  const { data: folders, error: finalError } = await db
    .from("project_drive_folders")
    .select("*")
    .eq("project_id", projectId)
    .order("folder_name");
  if (finalError) throw finalError;

  return {
    projectFolderId,
    customerFolderId,
    folders: folders || [],
  };
}
