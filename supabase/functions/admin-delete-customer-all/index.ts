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
      academyResult,
      rentalResult,
      selectedWhatsappResult,
      outsideMessagesResult,
      outsideUploadsResult,
    ] = await Promise.all([
      ctx.db.from("projects").select("id,title").eq("customer_id",customerId),
      ctx.db.from("orders").select("id,order_number,total,payment_status").eq("customer_id",customerId),
      ctx.db.from("payments").select("id,amount,status").eq("customer_id",customerId),
      ctx.db.from("quotes").select("id,quote_number,total,status").eq("customer_id",customerId),
      ctx.db.from("conversations").select("id").eq("customer_id",customerId),
      ctx.db.from("client_files").select("id,name,storage_provider,storage_path,drive_file_id").eq("customer_id",customerId),
      ctx.db.from("payment_receipts").select("id,storage_path").eq("customer_id",customerId),
      ctx.db.rpc("admin_customer_academy_summary",{p_customer_id:customerId}),
      ctx.db.from("product_rentals").select("id",{count:"exact",head:true}).eq("customer_id",customerId),
      ctx.db.from("app_settings").select("id",{count:"exact",head:true}).eq("wa_bridge_single_customer_id",customerId),
      ctx.db.from("messages").select("id,conversations!inner(customer_id)")
        .eq("sender_id",customerId).neq("conversations.customer_id",customerId),
      ctx.db.from("chat_drive_uploads").select("message_id,conversations!inner(customer_id)")
        .eq("sender_id",customerId).neq("conversations.customer_id",customerId),
    ]);
    // Failed queries must never be interpreted as a zero-row deletion preview.
    for(const result of [projectsResult,ordersResult,paymentsResult,quotesResult,
      conversationsResult,filesResult,receiptsResult,academyResult,rentalResult,
      selectedWhatsappResult,outsideMessagesResult,outsideUploadsResult]){
      if(result.error) throw result.error;
    }

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
      academy_students:Number(academyResult.data?.students||0),
      academy_enrollments:Number(academyResult.data?.enrollments||0),
      academy_attempts:Number(academyResult.data?.attempts||0),
      academy_certificates:Number(academyResult.data?.certificates||0),
      academy_program_enrollments:Number(academyResult.data?.program_enrollments||0),
      academy_documents:Number(academyResult.data?.documents||0),
      academic_signed_records:Number(academyResult.data?.signed_records||0),
      active_rentals:Number(rentalResult.count||0),
      selected_whatsapp:Number(selectedWhatsappResult.count||0),
      shared_messages:(outsideMessagesResult.data||[]).length,
      shared_uploads:(outsideUploadsResult.data||[]).length,
      paid_total:payments
        .filter((row:any)=>row.status==="paid")
        .reduce((sum:number,row:any)=>sum+Number(row.amount||0),0),
    };

    const operationalTotal =
      summary.projects+summary.orders+summary.payments+summary.quotes+summary.conversations
      +summary.files+summary.receipts+summary.messages;
    const academicTotal=summary.academy_students+summary.academy_enrollments
      +summary.academy_attempts+summary.academy_certificates+summary.academy_program_enrollments
      +summary.academy_documents+summary.academic_signed_records;
    const mustForce=operationalTotal+academicTotal>0;

    if(action==="preview"){
      return json({ok:true,customer,summary,requires_force:mustForce,
        has_protected_records:summary.academic_signed_records>0});
    }

    if(action==="standard" && mustForce){
      return json({
        ok:false,
        code:"CUSTOMER_HAS_HISTORY",
        error:"Este cliente possui registros vinculados (incluindo dados acadêmicos). Revise o resumo e use a exclusão total para removê-los.",
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
    // Preserve legally relevant signed academic records and active rental contracts.
    // The operator must resolve these explicit blockers rather than receive a generic
    // "Database error deleting user" after partial external deletion.
    if(summary.academic_signed_records>0) return json({
      ok:false,code:"ACADEMY_SIGNED_RECORDS",
      error:"Há documentos assinados ou aceites acadêmicos vinculados. Para preservar o histórico legal, solicite revisão administrativa antes da exclusão.",
      summary
    },409);
    if(summary.active_rentals>0) return json({
      ok:false,code:"ACTIVE_RENTALS",
      error:"Este cliente possui locações registradas. Finalize ou regularize as locações antes de excluir a conta.",
      summary
    },409);
    if(summary.selected_whatsapp>0) return json({
      ok:false,code:"WHATSAPP_DELIVERY_TARGET",
      error:"O cliente está selecionado como destinatário de teste da Central WhatsApp. Troque o destinatário ou pause esse modo antes de excluir.",
      summary
    },409);
    if(summary.shared_messages>0||summary.shared_uploads>0) return json({
      ok:false,code:"SHARED_CONVERSATION_HISTORY",
      error:"Há mensagens ou arquivos enviados por este cliente em conversas de terceiros. Revise esses vínculos antes de excluir o cadastro.",
      summary
    },409);

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

    // Cleanup is scoped to this customer and transactional inside the database.
    // It is only invoked for the explicit force flow; an empty registration has
    // no academic relations and continues through its simpler deletion path.
    if(action==="force" && academicTotal>0){
      const {error:cleanupError}=await ctx.db.rpc("admin_customer_cleanup_academy",{p_customer_id:customerId});
      if(cleanupError) throw cleanupError;
    }

    const { error: authDeleteError } = await ctx.db.auth.admin.deleteUser(customerId);
    if(authDeleteError){
      if(/database error deleting user/i.test(authDeleteError.message||"")){
        throw new Error("O banco ainda possui uma referência protegida a este cadastro. Nenhuma exclusão de outro usuário foi realizada. Revise os vínculos do perfil antes de tentar novamente.");
      }
      throw authDeleteError;
    }

    return json({ok:true,summary});
  } catch (error) {
    return json({
      ok:false,
      error:error instanceof Error ? error.message : "Unknown error",
    },400);
  }
});
