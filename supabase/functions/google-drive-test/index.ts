import { corsHeaders, getDriveAccessToken, json, requireStaff, requireUser } from "../_shared/googleDrive.ts";

// Read-only diagnostic: checking a connection must never create folders or
// update persisted settings. Authenticated staff only; secrets stay server-side.
type FailureCode = "missing_configuration" | "oauth_rejected" | "google_access_denied" | "folder_inaccessible" | "unexpected_failure";

function fail(code: FailureCode, error: string, status = 400) {
  return json({ ok: false, code, error }, status);
}

async function checkFolder(token: string, id: string): Promise<boolean> {
  const request = await fetch(
    "https://www.googleapis.com/drive/v3/files/" + encodeURIComponent(id)
      + "?fields=id,mimeType,trashed",
    { headers: { Authorization: "Bearer " + token }, redirect: "manual" },
  );
  if (!request.ok) return false;
  const data = await request.json().catch(() => null);
  return Boolean(data?.id === id && !data?.trashed && data.mimeType === "application/vnd.google-apps.folder");
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (req.method !== "POST") return fail("unexpected_failure", "Método não permitido.", 405);

  try {
    const ctx = await requireUser(req);
    requireStaff(ctx);

    // Validate actual Google authorization BEFORE checking any folder. This
    // distinguishes a configured but revoked refresh token from missing access
    // to an otherwise valid institutional Drive.
    let token: string;
    try {
      token = await getDriveAccessToken();
    } catch (cause) {
      const detail = cause instanceof Error ? cause.message : "";
      if (detail.includes("Missing secret:")) {
        const secret = ["GOOGLE_DRIVE_CLIENT_ID", "GOOGLE_DRIVE_CLIENT_SECRET", "GOOGLE_DRIVE_REFRESH_TOKEN"]
          .find(name => detail.includes(name));
        return fail("missing_configuration", secret
          ? "A variável " + secret + " não está disponível na função Supabase."
          : "Uma configuração necessária do Google Drive está ausente.", 503);
      }
      return fail("oauth_rejected",
        "O Google recusou a autorização atual do Drive. A variável GOOGLE_DRIVE_REFRESH_TOKEN pode estar salva, mas seu valor pode ter expirado, sido revogado ou não corresponder ao CLIENT_ID/CLIENT_SECRET configurados.", 503);
    }

    const aboutResponse = await fetch(
      "https://www.googleapis.com/drive/v3/about?fields=user(displayName,emailAddress)",
      { headers: { Authorization: "Bearer " + token }, redirect: "manual" },
    );
    if (!aboutResponse.ok) {
      return fail("google_access_denied",
        "O Google forneceu um token, mas não autorizou o acesso à API do Drive. Verifique a conta, os escopos OAuth e as permissões.", 503);
    }
    const about = await aboutResponse.json().catch(() => ({}));

    // Read stored folder associations without recreating or modifying anything.
    const { data: settings, error: settingsError } = await ctx.db.from("drive_settings")
      .select("root_folder_id,clients_folder_id")
      .eq("id", true).maybeSingle();
    if (settingsError) return fail("unexpected_failure", "Falha ao consultar a configuração de pastas do Drive.", 500);

    if (!settings?.root_folder_id || !settings?.clients_folder_id) {
      return fail("missing_configuration",
        "O Google Drive respondeu, mas falta a associação das pastas raiz e CLIENTES no sistema. Nenhuma pasta foi criada.", 409);
    }
    const rootOk = await checkFolder(token, settings.root_folder_id);
    const clientsOk = await checkFolder(token, settings.clients_folder_id);
    if (!rootOk || !clientsOk) {
      return json({
        ok: false, code: "folder_inaccessible",
        error: "Autorização Google válida, mas a conta não consegue acessar "
          + (!rootOk && !clientsOk ? "as pastas raiz e CLIENTES" : !rootOk ? "a pasta raiz" : "a pasta CLIENTES")
          + ". Confira a conta institucional e as permissões das pastas.",
        account: about.user || null,
        folders: { root: rootOk, clients: clientsOk },
      }, 409);
    }

    return json({
      ok: true, code: "connected",
      account: about.user || null,
      folders: { root: true, clients: true },
      message: "Autorização Google e pastas da Sagamente verificadas.",
    });
  } catch (cause) {
    const msg = cause instanceof Error ? cause.message : "";
    if (msg === "Unauthorized" || msg === "Inactive user") {
      return fail("unexpected_failure", "Sessão inválida ou expirada. Entre novamente.", 401);
    }
    if (msg === "Staff access required") return fail("unexpected_failure", "Acesso restrito à equipe administrativa.", 403);
    return fail("unexpected_failure", "Falha ao verificar a conexão. Tente novamente ou confira o registro da Edge Function.", 500);
  }
});
