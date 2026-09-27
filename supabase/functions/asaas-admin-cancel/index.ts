import { asaas, corsHeaders, json, serviceDb } from "../_shared/asaas.ts";

async function requireAdmin(req:Request){
 const token=(req.headers.get("Authorization")||"").replace(/^Bearer\s+/i,"");
 if(!token)throw new Error("Unauthorized");
 const db=serviceDb();
 const {data,error}=await db.auth.getUser(token);
 if(error||!data.user)throw new Error("Unauthorized");
 const {data:profile,error:pe}=await db.from("profiles").select("id,role,status").eq("id",data.user.id).single();
 if(pe||!profile||profile.role!=="admin"||profile.status!=="active")throw new Error("Admin access required");
 return db;
}

Deno.serve(async(req)=>{
 if(req.method==="OPTIONS")return new Response("ok",{headers:corsHeaders});
 try{
  const db=await requireAdmin(req);
  const {payment_id}=await req.json();
  if(!payment_id)throw new Error("payment_id is required");
  const {data:payment,error}=await db.from("payments").select("id,provider,provider_reference,status,order_id").eq("id",payment_id).single();
  if(error||!payment)throw new Error("Payment not found");
  if(["paid","refunded"].includes(payment.status))throw new Error("Pagamentos recebidos ou reembolsados permanecem no histórico e não podem ser excluídos.");
  if(payment.provider==="asaas"&&payment.provider_reference){
   await asaas("/payments/"+encodeURIComponent(payment.provider_reference),{method:"DELETE"});
  }
  if(payment.provider==="asaas_checkout"&&payment.provider_reference){
   await asaas("/checkouts/"+encodeURIComponent(payment.provider_reference)+"/cancel",{method:"POST"});
  }
  const now=new Date().toISOString();
  const {error:updateError}=await db.from("payments").update({status:"cancelled",updated_at:now}).eq("id",payment.id);
  if(updateError)throw updateError;
  if(payment.order_id){
   const {error:orderError}=await db.from("orders").update({payment_status:"cancelled"}).eq("id",payment.order_id).neq("payment_status","paid");
   if(orderError)throw orderError;
   const {error:stockError}=await db.rpc("release_order_stock",{p_order_id:payment.order_id});
   if(stockError)throw stockError;
  }
  return json({ok:true});
 }catch(error){return json({ok:false,error:error instanceof Error?error.message:"Unknown error"},400)}
});
