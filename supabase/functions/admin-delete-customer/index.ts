import { corsHeaders, getDriveAccessToken, json, requireUser } from "../_shared/googleDrive.ts";

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  try {
    const ctx = await requireUser(req);
    if (ctx.role !== "admin") throw new Error("Admin access required");

    const body = await req.json();
    const customerId = String(body.customer_id || "");
    const confirmation = String(body.confirmation || "").trim().toLowerCase();
    if (!customerId) throw new Error("customer_id is required");
    if (customerId === ctx.userId) throw new Error("You cannot delete your own account");

    const { data: customer, error: customerError } = await ctx.db
      .from("profiles")
      .select("id,email,first_name,last_name,role,drive_folder_id")
      .eq("id", customerId)
      .single();

    if (customerError || !customer || customer.role !== "customer") {
      throw new Error("Customer not found");
    }

    if (confirmation !== String(customer.email || "").trim().toLowerCase()) {
      throw new Error("Confirmation e-mail does not match");
    }

    const checks = await Promise.all([
      ctx.db.from("orders").select("id",{count:"exact",head:true}).eq("customer_id",customerId),
      ctx.db.from("payments").select("id",{count:"exact",head:true}).eq("customer_id",customerId),
      ctx.db.from("projects").select("id",{count:"exact",head:true}).eq("customer_id",customerId),
      ctx.db.from("quotes").select("id",{count:"exact",head:true}).eq("customer_id",customerId),
      ctx.db.from("conversations").select("id",{count:"exact",head:true}).eq("customer_id",customerId),
    ]);

    const [orders,payments,projects,quotes,conversations]=checks;
    const blockers = {
      orders: orders.count || 0,
      payments: payments.count || 0,
      projects: projects.count || 0,
      quotes: quotes.count || 0,
      conversations: conversations.count || 0,
    };
    const blockerTotal = Object.values(blockers).reduce((sum,value)=>sum+Number(value||0),0);

    if (blockerTotal > 0) {
      return json({
        ok:false,
        code:"CUSTOMER_HAS_HISTORY",
        error:"Este cliente possui histórico operacional. Inative ou bloqueie para preservar pedidos, pagamentos, projetos e conversas.",
        blockers,
      },409);
    }

    if (customer.drive_folder_id) {
      try {
        const token = await getDriveAccessToken();
        const response = await fetch(
          `https://www.googleapis.com/drive/v3/files/${encodeURIComponent(customer.drive_folder_id)}`,
          {
            method:"DELETE",
            headers:{ Authorization:`Bearer ${token}` },
          },
        );
        if (!response.ok && response.status !== 404) {
          const detail = await response.text();
          throw new Error(`Google Drive: ${response.status} ${detail}`);
        }
      } catch (error) {
        return json({
          ok:false,
          code:"DRIVE_DELETE_FAILED",
          error:error instanceof Error ? error.message : "Não foi possível excluir a pasta do Google Drive.",
        },400);
      }
    }

    const { error: authDeleteError } = await ctx.db.auth.admin.deleteUser(customerId);
    if (authDeleteError) throw authDeleteError;

    return json({ ok:true });
  } catch (error) {
    return json({
      ok:false,
      error:error instanceof Error ? error.message : "Unknown error",
    },400);
  }
});
