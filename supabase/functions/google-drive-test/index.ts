import { corsHeaders, driveJson, ensureDriveRoot, json, requireStaff, requireUser } from "../_shared/googleDrive.ts";

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  try {
    const ctx = await requireUser(req);
    requireStaff(ctx);

    const root = await ensureDriveRoot(ctx.db, ctx.userId);
    const about = await driveJson(
      "https://www.googleapis.com/drive/v3/about?fields=user(displayName,emailAddress),storageQuota(limit,usage,usageInDrive,usageInDriveTrash)"
    );

    return json({ ok: true, ...root, account: about.user, storageQuota: about.storageQuota });
  } catch (error) {
    return json({ ok: false, error: error instanceof Error ? error.message : "Unknown error" }, 400);
  }
});
