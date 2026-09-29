import { createClient, type SupabaseClient } from "https://esm.sh/@supabase/supabase-js@2";

export const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, range",
  "Access-Control-Allow-Methods": "GET, HEAD, POST, OPTIONS",
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
  permissions: string[];
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

  let permissions: string[] = [];
  if (profile.role === "staff") {
    const { data: staff } = await db
      .from("staff_profiles")
      .select("permissions,active")
      .eq("user_id", authData.user.id)
      .maybeSingle();
    if (staff?.active) permissions = Array.isArray(staff.permissions) ? staff.permissions : [];
  }

  return { db, userId: authData.user.id, role: profile.role, permissions };
}

export function requireStaff(ctx: RequestContext) {
  if (!["admin", "staff"].includes(ctx.role)) {
    throw new Error("Staff access required");
  }
}

export function hasPermission(ctx: RequestContext, permission: string) {
  return ctx.role === "admin" || ctx.permissions.includes("*") || ctx.permissions.includes(permission);
}

export function requirePermission(ctx: RequestContext, permission: string) {
  if (!hasPermission(ctx, permission)) {
    throw new Error("Permission required: " + permission);
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
    .select("id,title,customer_id,project_type,drive_folder_id")
    .eq("id", projectId)
    .single();
  if (error) throw error;

  const isInternal = project.project_type === "internal";
  let customerFolderId: string | null = null;
  let projectParentId: string;

  if (isInternal) {
    const { rootFolderId } = await ensureDriveRoot(db, userId);
    const { data: settings, error: settingsError } = await db
      .from("drive_settings")
      .select("internal_projects_folder_id")
      .eq("id", true)
      .maybeSingle();
    if (settingsError) throw settingsError;

    let internalRootId = settings?.internal_projects_folder_id || null;
    if (!internalRootId) {
      const existing = await findDriveFolder(rootFolderId, "internal-projects-root");
      const internalRoot = existing || await createDriveFolder(
        "PROJETOS INTERNOS",
        rootFolderId,
        { playMomentsKind: "internal-projects-root" },
      );
      internalRootId = internalRoot.id;
      const { error: updateError } = await db
        .from("drive_settings")
        .update({
          internal_projects_folder_id: internalRootId,
          updated_at: new Date().toISOString(),
          updated_by: userId,
        })
        .eq("id", true);
      if (updateError) throw updateError;
    }
    projectParentId = internalRootId;
  } else {
    if (!project.customer_id) throw new Error("External project has no customer");

    const client = await ensureClientFolder(db, userId, project.customer_id);
    customerFolderId = client.customerFolderId;

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
    projectParentId = projectsRoot.id;
  }

  let projectFolderId = project.drive_folder_id || null;
  const expectedProjectFolderName = isInternal
    ? project.title
    : `PM-${projectId.slice(0,8).toUpperCase()} - ${project.title}`;

  if (!projectFolderId) {
    const existing = await findDriveFolder(projectParentId, "project", projectId);
    const projectFolder = existing || await createDriveFolder(
      expectedProjectFolderName,
      projectParentId,
      {
        playMomentsKind: "project",
        playMomentsEntityId: projectId,
        playMomentsProjectScope: isInternal ? "internal" : "customer",
      },
    );
    projectFolderId = projectFolder.id;
    await db.from("projects")
      .update({ drive_folder_id: projectFolderId })
      .eq("id", projectId);
  } else if (isInternal) {
    // Internal project folders mirror the project title exactly.
    await driveJson(
      `https://www.googleapis.com/drive/v3/files/${encodeURIComponent(projectFolderId)}?fields=id,name`,
      {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: expectedProjectFolderName }),
      },
    );
  }

  if (isInternal) {
    const { data: stages, error: stagesError } = await db
      .from("project_stages")
      .select("id,project_id,name,position,status")
      .eq("project_id", projectId)
      .order("position");
    if (stagesError) throw stagesError;

    const { data: existingStageFolders, error: stageFolderError } = await db
      .from("project_stage_drive_folders")
      .select("*")
      .eq("project_id", projectId);
    if (stageFolderError) throw stageFolderError;

    const byStage = new Map((existingStageFolders || []).map((row:any) => [row.stage_id,row]));

    for (const stage of stages || []) {
      const existingRow = byStage.get(stage.id);
      if (existingRow) {
        if (existingRow.folder_name !== stage.name) {
          await driveJson(
            `https://www.googleapis.com/drive/v3/files/${encodeURIComponent(existingRow.drive_folder_id)}?fields=id,name`,
            {
              method: "PATCH",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ name: stage.name }),
            },
          );
          await db.from("project_stage_drive_folders")
            .update({ folder_name: stage.name })
            .eq("stage_id", stage.id);
        }
        continue;
      }

      const existing = await findDriveFolder(projectFolderId, "project-stage", stage.id);
      const folder = existing || await createDriveFolder(
        stage.name,
        projectFolderId,
        {
          playMomentsKind: "project-stage",
          playMomentsEntityId: stage.id,
          playMomentsProjectId: projectId,
        },
      );

      const { error: insertStageFolderError } = await db
        .from("project_stage_drive_folders")
        .upsert({
          stage_id: stage.id,
          project_id: projectId,
          drive_folder_id: folder.id,
          folder_name: stage.name,
        });
      if (insertStageFolderError) throw insertStageFolderError;
    }

    const { data: stageFolders, error: finalStageError } = await db
      .from("project_stage_drive_folders")
      .select("*")
      .eq("project_id", projectId);
    if (finalStageError) throw finalStageError;

    const orderedStageFolders = (stages || []).map((stage:any) => {
      const folder = (stageFolders || []).find((row:any) => row.stage_id === stage.id);
      return folder ? { ...folder, stage } : null;
    }).filter(Boolean);

    return {
      projectFolderId,
      customerFolderId,
      projectScope: "internal",
      folders: [],
      stageFolders: orderedStageFolders,
    };
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
    projectScope: "customer",
    folders: folders || [],
    stageFolders: [],
  };
}


export async function ensureSiteAssetFolder(db: SupabaseClient, userId: string, section = "HOME") {
  const { rootFolderId } = await ensureDriveRoot(db, userId);
  let siteRoot = await findDriveFolder(rootFolderId, "site-assets-root");
  if (!siteRoot) {
    siteRoot = await createDriveFolder("SITE", rootFolderId, { playMomentsKind: "site-assets-root" });
  }
  const safeSection = section.trim().toUpperCase().replace(/[^A-Z0-9 _-]/g, "").slice(0, 40) || "GERAL";
  let folder = await findDriveFolder(siteRoot.id, "site-assets-section", safeSection);
  if (!folder) {
    folder = await createDriveFolder(safeSection, siteRoot.id, {
      playMomentsKind: "site-assets-section",
      playMomentsEntityId: safeSection,
    });
  }
  return { siteRootId: siteRoot.id, folderId: folder.id, section: safeSection };
}

export async function ensureAcademyFolder(db: SupabaseClient, userId: string, courseId: string, moduleId?: string) {
  const { rootFolderId } = await ensureDriveRoot(db, userId);
  // Academy media must not inherit the sharing policy of the general PLAY MOMENTS tree.
  // Keep it directly under My Drive and remove broad link/domain permissions.
  let academyRoot = await findDriveFolder("root", "academy-root");
  if (!academyRoot) {
    const legacyRoot = await findDriveFolder(rootFolderId, "academy-root");
    if (legacyRoot) {
      academyRoot = await driveJson(`https://www.googleapis.com/drive/v3/files/${encodeURIComponent(legacyRoot.id)}?addParents=root&removeParents=${encodeURIComponent(rootFolderId)}&fields=id,name,parents,appProperties`,{method:"PATCH"});
    } else {
      academyRoot = await createDriveFolder("PLAY MOMENTS - ACADEMIA PRIVADA", "root", { playMomentsKind: "academy-root" });
    }
  }
  const permissions = await driveJson(`https://www.googleapis.com/drive/v3/files/${encodeURIComponent(academyRoot.id)}/permissions?fields=permissions(id,type,role)`);
  for (const permission of permissions?.permissions || []) {
    if (permission.type === "anyone" || permission.type === "domain") {
      try { await driveJson(`https://www.googleapis.com/drive/v3/files/${encodeURIComponent(academyRoot.id)}/permissions/${encodeURIComponent(permission.id)}`,{method:"DELETE"}); } catch { /* inherited permissions disappear after the root move */ }
    }
  }

  const { data: course, error: courseError } = await db.from("courses").select("id,title,drive_folder_id").eq("id",courseId).single();
  if (courseError) throw new Error(`Academy course lookup failed: ${courseError.message}`);
  if (!course) throw new Error("Academy course not found");
  let courseFolderId = course.drive_folder_id;
  if (!courseFolderId) {
    const existing = await findDriveFolder(academyRoot.id,"academy-course",courseId);
    const folder = existing || await createDriveFolder(course.title,academyRoot.id,{playMomentsKind:"academy-course",playMomentsEntityId:courseId});
    courseFolderId = folder.id;
    const { error } = await db.from("courses").update({drive_folder_id:courseFolderId}).eq("id",courseId);
    if (error) throw error;
  }
  if (!moduleId) return { academyRootId:academyRoot.id, courseFolderId, folderId:courseFolderId };

  const { data: module, error: moduleError } = await db.from("course_modules").select("id,title,course_id,drive_folder_id").eq("id",moduleId).eq("course_id",courseId).single();
  if (moduleError) throw new Error(`Academy module lookup failed: ${moduleError.message}`);
  if (!module) throw new Error("Academy course module not found");
  let moduleFolderId = module.drive_folder_id;
  if (!moduleFolderId) {
    const existing = await findDriveFolder(courseFolderId,"academy-module",moduleId);
    const folder = existing || await createDriveFolder(module.title,courseFolderId,{playMomentsKind:"academy-module",playMomentsEntityId:moduleId});
    moduleFolderId = folder.id;
    const { error } = await db.from("course_modules").update({drive_folder_id:moduleFolderId}).eq("id",moduleId);
    if (error) throw error;
  }
  return { academyRootId:academyRoot.id, courseFolderId, moduleFolderId, folderId:moduleFolderId };
}



export async function ensureAcademyDocumentsFolder(db: SupabaseClient, userId: string, studentId: string, enrollmentId?: string) {
  const { academyRootId } = await ensureAcademyFolderRoot(db,userId);
  let documentsRoot = await findDriveFolder(academyRootId,"academy-documents-root");
  if (!documentsRoot) documentsRoot = await createDriveFolder("DOCUMENTOS ACADÊMICOS",academyRootId,{playMomentsKind:"academy-documents-root"});
  let studentFolder = await findDriveFolder(documentsRoot.id,"academy-student-documents",studentId);
  if (!studentFolder) studentFolder = await createDriveFolder("ALUNO-"+studentId.slice(0,8).toUpperCase(),documentsRoot.id,{playMomentsKind:"academy-student-documents",playMomentsEntityId:studentId});
  if (!enrollmentId) return {academyRootId,documentsRootId:documentsRoot.id,studentFolderId:studentFolder.id,folderId:studentFolder.id};
  let enrollmentFolder = await findDriveFolder(studentFolder.id,"academy-enrollment-documents",enrollmentId);
  if (!enrollmentFolder) enrollmentFolder = await createDriveFolder("MATRICULA-"+enrollmentId.slice(0,8).toUpperCase(),studentFolder.id,{playMomentsKind:"academy-enrollment-documents",playMomentsEntityId:enrollmentId});
  return {academyRootId,documentsRootId:documentsRoot.id,studentFolderId:studentFolder.id,enrollmentFolderId:enrollmentFolder.id,folderId:enrollmentFolder.id};
}

export async function ensureAcademyCertificateAssetsFolder(db: SupabaseClient, userId: string) {
  const { academyRootId } = await ensureAcademyFolderRoot(db, userId);
  let folder = await findDriveFolder(academyRootId, "academy-certificate-assets");
  if (!folder) folder = await createDriveFolder("MODELOS DE CERTIFICADOS", academyRootId, { playMomentsKind:"academy-certificate-assets" });
  return { academyRootId, folderId: folder.id };
}

async function ensureAcademyFolderRoot(db: SupabaseClient, userId: string) {
  const { rootFolderId } = await ensureDriveRoot(db, userId);
  let academyRoot = await findDriveFolder("root", "academy-root");
  if (!academyRoot) {
    const legacyRoot = await findDriveFolder(rootFolderId, "academy-root");
    academyRoot = legacyRoot || await createDriveFolder("PLAY MOMENTS - ACADEMIA PRIVADA", "root", { playMomentsKind:"academy-root" });
  }
  return { academyRootId: academyRoot.id };
}
