import { corsHeaders, getDriveAccessToken, json, requireUser } from "../_shared/googleDrive.ts";

async function removeStoragePaths(db:any,bucket:string,paths:string[]) {
  const unique=[...new Set(paths.filter(Boolean))];
  for(let index=0;index<unique.length;index+=100){
    const chunk=unique.slice(index,index+100);
    const { error }=await db.storage.from(bucket).remove(chunk);
    if(error) throw error;
  }
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  try {
    const ctx = await requireUser(req);
    if (ctx.role !== "admin") throw new Error("Admin access required");

    const body = await req.json();
    const action = String(body.action || "preview");
    const customerId = String(body.customer_id || "");
    const confirmation = String(body.confirmation || "").trim().toLowerCase();
    const phrase = String(body.phrase || "").trim().toUpperCase();

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

    const [
      projectsResult,
      ordersResult,
      paymentsResult,
      quotesResult,
      conversationsResult,
      filesResult,
      receiptsResult,
    ] = await Promise.all([
      ctx.db.from("projects").select("id,title").eq("customer_id",customerId),
      ctx.db.from("orders").select("id,order_number,total,payment_status").eq("customer_id",customerId),
      ctx.db.from("payments").select("id,amount,status").eq("customer_id",customerId),
      ctx.db.from("quotes").select("id,quote_number,total,status").eq("customer_id",customerId),
      ctx.db.from("conversations").select("id").eq("customer_id",customerId),
      ctx.db.from("client_files").select("id,name,storage_provider,storage_path,drive_file_id").eq("customer_id",customerId),
      ctx.db.from("payment_receipts").select("id,storage_path").eq("customer_id",customerId),
    ]);

    const projects=projectsResult.data||[];
    const orders=ordersResult.data||[];
    const payments=paymentsResult.data||[];
    const quotes=quotesResult.data||[];
    const conversations=conversationsResult.data||[];
    const clientFiles=filesResult.data||[];
    const receipts=receiptsResult.data||[];
    const conversationIds=conversations.map((row:any)=>row.id);

    let messages:any[]=[];
    if(conversationIds.length){
      const { data,error }=await ctx.db
        .from("messages")
        .select("id,attachment_path")
        .in("conversation_id",conversationIds);
      if(error) throw error;
      messages=data||[];
    }

    const summary={
      projects:projects.length,
      orders:orders.length,
      payments:payments.length,
      quotes:quotes.length,
      conversations:conversations.length,
      messages:messages.length,
      files:clientFiles.length,
      receipts:receipts.length,
      paid_total:payments
        .filter((row:any)=>row.status==="paid")
        .reduce((sum:number,row:any)=>sum+Number(row.amount||0),0),
    };

    const operationalTotal =
      summary.projects+summary.orders+summary.payments+summary.quotes+summary.conversations;

    if(action==="preview"){
      return json({ok:true,customer,summary,requires_force:operationalTotal>0});
    }

    if(action==="standard" && operationalTotal>0){
      return json({
        ok:false,
        code:"CUSTOMER_HAS_HISTORY",
        error:"Este cliente possui histórico operacional. Use a exclusão total somente se quiser remover também projetos, financeiro, arquivos e conversas.",
        summary,
      },409);
    }

    if(action==="force" && phrase!=="EXCLUIR TUDO"){
      return json({
        ok:false,
        code:"FORCE_CONFIRMATION_REQUIRED",
        error:'Digite "EXCLUIR TUDO" para confirmar a exclusão completa.',
        summary,
      },400);
    }

    if(!["standard","force"].includes(action)){
      throw new Error("Unsupported deletion action");
    }

    if (customer.drive_folder_id) {
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
    } else {
      const driveFiles=clientFiles.filter((row:any)=>row.storage_provider==="google_drive"&&row.drive_file_id);
      if(driveFiles.length){
        const token=await getDriveAccessToken();
        for(const row of driveFiles){
          const response=await fetch(
            `https://www.googleapis.com/drive/v3/files/${encodeURIComponent(row.drive_file_id)}`,
            {method:"DELETE",headers:{Authorization:`Bearer ${token}`}},
          );
          if(!response.ok&&response.status!==404){
            const detail=await response.text();
            throw new Error(`Google Drive: ${response.status} ${detail}`);
          }
        }
      }
    }

    await removeStoragePaths(
      ctx.db,
      "client-files",
      clientFiles.filter((row:any)=>row.storage_provider==="supabase").map((row:any)=>row.storage_path),
    );
    await removeStoragePaths(ctx.db,"payment-receipts",receipts.map((row:any)=>row.storage_path));
    await removeStoragePaths(ctx.db,"chat-attachments",messages.map((row:any)=>row.attachment_path));

    for(const operation of [
      ctx.db.from("client_files").delete().eq("customer_id",customerId),
      ctx.db.from("payment_receipts").delete().eq("customer_id",customerId),
    ]){
      const { error }=await operation;
      if(error) throw error;
    }

    if(conversationIds.length){
      const { error }=await ctx.db.from("conversations").delete().in("id",conversationIds);
      if(error) throw error;
    }

    for(const operation of [
      ctx.db.from("projects").delete().eq("customer_id",customerId),
      ctx.db.from("payments").delete().eq("customer_id",customerId),
      ctx.db.from("orders").delete().eq("customer_id",customerId),
      ctx.db.from("quotes").delete().eq("customer_id",customerId),
      ctx.db.from("notifications").delete().eq("user_id",customerId),
    ]){
      const { error }=await operation;
      if(error) throw error;
    }

    const { error: authDeleteError } = await ctx.db.auth.admin.deleteUser(customerId);
    if (authDeleteError) throw authDeleteError;

    return json({ok:true,summary});
  } catch (error) {
    return json({
      ok:false,
      error:error instanceof Error ? error.message : "Unknown error",
    },400);
  }
});
