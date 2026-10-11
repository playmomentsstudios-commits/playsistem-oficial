import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

/**
 * Public endpoint with its own authentication:
 * 64-hex unguessable bearer token, SHA-256 stored in DB, TTL 48h, verified
 * user/project/task/stage/file visibility on EVERY request.
 * Not a publicly shared Google Drive permission.
 */
function errorPage() {
  return new Response("Este link de arquivo não está mais disponível. Solicite um novo aviso à Sagamente.", {
    status: 410,
    headers: {
      "Content-Type": "text/plain; charset=utf-8",
      "Cache-Control": "private, no-store",
      "X-Content-Type-Options": "nosniff",
      "X-Robots-Tag": "noindex, nofollow, noarchive",
    },
  });
}
function env(name: string): string {
  const value = Deno.env.get(name);
  if (!value) throw new Error("Servidor não configurado");
  return value;
}
async function driveToken(): Promise<string> {
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
  if (!response.ok) throw new Error("Drive token refresh unavailable");
  const data = await response.json();
  if (typeof data?.access_token !== "string") throw new Error("Drive token missing");
  return data.access_token;
}

Deno.serve(async (request: Request) => {
  if (request.method !== "GET") return new Response("Method not allowed", { status: 405 });
  const url = new URL(request.url);
  const token = url.searchParams.get("t") || "";
  if (!/^[0-9a-f]{64}$/.test(token)) return errorPage();
  try {
    const db = createClient(env("SUPABASE_URL"), env("SUPABASE_SERVICE_ROLE_KEY"), {
      auth: { persistSession: false, autoRefreshToken: false },
    });
    const { data, error } = await db.rpc("wa_resolve_file_link", { p_token: token });
    if (error || !Array.isArray(data) || data.length !== 1) return errorPage();
    const file = data[0];
    if (typeof file.drive_file_id !== "string" || !file.drive_file_id) return errorPage();
    const accessToken = await driveToken();
    const upstream = await fetch(
      "https://www.googleapis.com/drive/v3/files/" +
        encodeURIComponent(file.drive_file_id) + "?alt=media",
      { headers: { Authorization: "Bearer " + accessToken } },
    );
    if (!upstream.ok || !upstream.body) return errorPage();
    const filename = String(file.file_name || "arquivo").replace(/[\r\n"\\]/g, " ").slice(0,140);
    const contentType = String(file.mime_type || upstream.headers.get("Content-Type") || "application/octet-stream");
    // Keep media viewing possible on mobile; the filename is sanitized.
    const headers = new Headers({
      "Content-Type": contentType,
      "Content-Disposition": "inline; filename*=UTF-8''" + encodeURIComponent(filename),
      "Cache-Control": "private, no-store, max-age=0",
      "Pragma": "no-cache",
      "X-Content-Type-Options": "nosniff",
      "X-Robots-Tag": "noindex, nofollow, noarchive",
      "Referrer-Policy": "no-referrer",
      "Cross-Origin-Resource-Policy": "cross-origin",
    });
    const length = upstream.headers.get("Content-Length");
    if (length && /^\d+$/.test(length)) headers.set("Content-Length", length);
    return new Response(upstream.body, { status: 200, headers });
  } catch {
    // Never reveal the Drive file id, institutional credentials, or token.
    return errorPage();
  }
});
