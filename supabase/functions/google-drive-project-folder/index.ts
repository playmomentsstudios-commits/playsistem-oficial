import { corsHeaders, ensureProjectFolder, json, requireUser } from "../_shared/googleDrive.ts";

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  try {
    const ctx = await requireUser(req);
    const body = await req.json();
    const projectId = String(body.project_id || "");
    if (!projectId) throw new Error("project_id is required");

    if (!["admin","staff"].includes(ctx.role)) {
      const { data: project, error } = await ctx.db
        .from("projects")
        .select("customer_id")
        .eq("id", projectId)
        .single();
      if (error || project?.customer_id !== ctx.userId) throw new Error("Forbidden");
    }

    const result = await ensureProjectFolder(ctx.db, ctx.userId, projectId);
    return json({ ok: true, ...result });
  } catch (error) {
    return json({ ok: false, error: error instanceof Error ? error.message : "Unknown error" }, 400);
  }
});
