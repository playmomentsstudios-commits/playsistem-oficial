import { corsHeaders, json, requireUser } from "../_shared/googleDrive.ts";

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  try {
    const ctx = await requireUser(req);
    if (ctx.role !== "admin") throw new Error("Administrator access required");

    const body = await req.json();
    const email = String(body.email || "").trim().toLowerCase();
    const firstName = String(body.first_name || "").trim();
    const lastName = String(body.last_name || "").trim();
    const jobTitle = String(body.job_title || "Colaborador").trim();
    const department = String(body.department || "custom").trim();
    const permissions = Array.isArray(body.permissions)
      ? body.permissions.map((value: unknown) => String(value)).filter(Boolean)
      : [];
    const redirectTo = String(body.redirect_to || "").trim();

    if (!email || !email.includes("@")) throw new Error("Valid email is required");
    if (!firstName) throw new Error("First name is required");

    const { data: existing } = await ctx.db
      .from("profiles")
      .select("id,email,role")
      .eq("email", email)
      .maybeSingle();

    let userId = existing?.id || null;
    let invited = false;

    if (!userId) {
      const { data, error } = await ctx.db.auth.admin.inviteUserByEmail(email, {
        data: { first_name: firstName, last_name: lastName },
        ...(redirectTo ? { redirectTo } : {}),
      });
      if (error) throw error;
      userId = data.user?.id || null;
      invited = true;
      if (!userId) throw new Error("Invite did not create a user");
    }

    const { error: profileError } = await ctx.db
      .from("profiles")
      .upsert({
        id: userId,
        email,
        first_name: firstName,
        last_name: lastName || null,
        role: "staff",
        status: "active",
      }, { onConflict: "id" });
    if (profileError) throw profileError;

    const { error: staffError } = await ctx.db
      .from("staff_profiles")
      .upsert({
        user_id: userId,
        job_title: jobTitle || "Colaborador",
        department,
        permissions,
        active: true,
        updated_by: ctx.userId,
        updated_at: new Date().toISOString(),
      }, { onConflict: "user_id" });
    if (staffError) throw staffError;

    return json({ ok: true, user_id: userId, invited });
  } catch (error) {
    return json({ ok: false, error: error instanceof Error ? error.message : "Unknown error" }, 400);
  }
});
