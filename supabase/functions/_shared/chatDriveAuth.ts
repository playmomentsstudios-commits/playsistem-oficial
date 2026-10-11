import { createClient, type SupabaseClient } from "https://esm.sh/@supabase/supabase-js@2.117.1";

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
  // Inactive collaborators must never qualify for staff-only operations.
  staffActive?: boolean;
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
  let staffActive = false;
  if (profile.role === "staff") {
    const { data: staff, error: staffError } = await db
      .from("staff_profiles")
      .select("permissions,active")
      .eq("user_id", authData.user.id)
      .maybeSingle();
    if (staffError) throw new Error("Unable to verify collaborator access");
    if (staff?.active === true) {
      staffActive = true;
      permissions = Array.isArray(staff.permissions) ? staff.permissions : [];
    }
  }

  return { db, userId: authData.user.id, role: profile.role, permissions, staffActive };
}

export function requireStaff(ctx: RequestContext) {
  if (ctx.role !== "admin" && !(ctx.role === "staff" && ctx.staffActive === true)) {
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

  // Bound the OAuth request so Drive-dependent screens never hang indefinitely.
  // Never forward raw Google error descriptions to client-facing Edge Functions.
  const response = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body,
    signal: AbortSignal.timeout(10000),
  }).catch(() => {
    throw new Error("Serviço de autenticação do Google Drive indisponível. Tente novamente.");
  });

  const payload = await response.json().catch(() => null);
  if (!response.ok || !payload.access_token) {
    const raw = String(payload?.error_description || payload?.error || "Google OAuth token refresh failed");
    const normalized = raw.toLowerCase();
    if (normalized.includes("expired") || normalized.includes("revoked") || normalized.includes("invalid_grant")) {
      throw new Error("A conexão do Google Drive expirou ou foi revogada. Atualize o segredo GOOGLE_DRIVE_REFRESH_TOKEN no Supabase e tente novamente.");
    }
    if (normalized.includes("invalid_client") || normalized.includes("unauthorized_client")) {
      throw new Error("O Google recusou a configuração OAuth institucional. Solicite uma verificação ao administrador.");
    }
    if (response.status === 429 || response.status >= 500) {
      throw new Error("Serviço de autenticação do Google Drive temporariamente indisponível. Tente novamente.");
    }
    throw new Error("O Google recusou a autenticação do Drive. Solicite uma verificação da conexão institucional.");
  }

  return payload.access_token as string;
}

export async function driveJson(
  url: string,
  init: RequestInit = {},
) {
  const token = await getDriveAccessToken();
  // Protect caller-facing handlers from leaking raw Google error descriptions.
  const response = await fetch(url, {
    ...init,
    headers: {
      Authorization: `Bearer ${token}`,
      ...(init.headers || {}),
    },
  }).catch(() => {
    throw new Error("Falha de conexão com o Google Drive. Tente novamente.");
  });

  const raw = await response.text().catch(() => "");
  let payload: any = null;
  if (raw) {
    try {
      payload = JSON.parse(raw);
    } catch {
      if (response.ok) throw new Error("O Google Drive retornou uma resposta inválida.");
    }
  }
  if (!response.ok) {
    if (response.status === 401 || response.status === 403) {
      throw new Error("O Google Drive recusou o acesso. Verifique a conta institucional e as permissões.");
    }
    if (response.status === 404) {
      throw new Error("Arquivo ou pasta não encontrado no Google Drive.");
    }
    if (response.status === 429 || response.status >= 500) {
      throw new Error("O Google Drive está temporariamente indisponível. Tente novamente.");
    }
    throw new Error(`A operação no Google Drive falhou (HTTP ${response.status}).`);
  }
  return payload;
}

