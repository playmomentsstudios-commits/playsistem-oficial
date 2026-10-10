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
    const raw = String(payload?.error_description || payload?.error || "Google OAuth token refresh failed");
    const normalized = raw.toLowerCase();
    if (normalized.includes("expired") || normalized.includes("revoked") || normalized.includes("invalid_grant")) {
      throw new Error("A conexão do Google Drive expirou ou foi revogada. Atualize o segredo GOOGLE_DRIVE_REFRESH_TOKEN no Supabase e tente novamente.");
    }
    throw new Error(raw);
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

