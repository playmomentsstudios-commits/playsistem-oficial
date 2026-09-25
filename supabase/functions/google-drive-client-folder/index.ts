import { corsHeaders, ensureClientFolder, json, requireUser } from "../_shared/googleDrive.ts";

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  try {
    const ctx = await requireUser(req);
    const body = await req.json().catch(() => ({}));
    const customerId = String(body.customer_id || ctx.userId);

    if (!["admin","staff"].includes(ctx.role) && customerId !== ctx.userId) {
      throw new Error("Forbidden");
    }

    const result = await ensureClientFolder(ctx.db, ctx.userId, customerId);
    return json({ ok: true, ...result });
  } catch (error) {
    return json({ ok: false, error: error instanceof Error ? error.message : "Unknown error" }, 400);
  }
});
