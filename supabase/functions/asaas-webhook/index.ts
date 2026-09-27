import { env, json, serviceDb } from "../_shared/asaas.ts";

Deno.serve(async(req)=>{
 if(req.method!=="POST")return json({ok:false,error:"Method not allowed"},405);
 try{
  const received=req.headers.get("asaas-access-token")||"";
  if(!received||received!==env("ASAAS_WEBHOOK_TOKEN"))return json({ok:false,error:"Unauthorized"},401);
  const payload=await req.json();const event=String(payload.event||"");const charge=payload.payment||{};
  const eventId=String(payload.id||[event,charge.id,charge.status].filter(Boolean).join(":"));
  if(!eventId||!charge.id)throw new Error("Invalid webhook payload");
  const db=serviceDb();
  const {error:eventError}=await db.from("payment_webhook_events").insert({id:eventId,provider:"asaas",event_type:event,provider_reference:charge.id,payload});
  if(eventError?.code==="23505")return json({ok:true,duplicate:true});
  if(eventError)throw eventError;
  const paid=["PAYMENT_CONFIRMED","PAYMENT_RECEIVED"].includes(event);
  const refunded=event==="PAYMENT_REFUNDED";
  const cancelled=["PAYMENT_DELETED","PAYMENT_RESTORED"].includes(event)?event==="PAYMENT_DELETED":false;
  const rejected=["PAYMENT_CREDIT_CARD_CAPTURE_REFUSED"].includes(event);
  const status=paid?"paid":refunded?"refunded":cancelled?"cancelled":rejected?"rejected":"pending";
  const update:any={status,provider_payload:charge,updated_at:new Date().toISOString()};
  if(paid)update.paid_at=new Date().toISOString();
  const {data:payment,error}=await db.from("payments").update(update).eq("provider","asaas").eq("provider_reference",charge.id).select("id,order_id,customer_id").maybeSingle();
  if(error)throw error;
  if(payment?.order_id){
   const orderUpdate:any={payment_status:status};
   if(paid){orderUpdate.status="paid";orderUpdate.payment_status="paid"}
   await db.from("orders").update(orderUpdate).eq("id",payment.order_id);
   if(paid)await db.from("notifications").insert({user_id:payment.customer_id,type:"payment_confirmed",title:"Pagamento confirmado",message:"Seu pagamento foi confirmado.",link:"/app/pedidos/"+payment.order_id,metadata:{order_id:payment.order_id,payment_id:payment.id}});
  }
  return json({ok:true});
 }catch(error){return json({ok:false,error:error instanceof Error?error.message:"Unknown error"},400)}
});