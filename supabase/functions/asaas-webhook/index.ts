import { env, json, serviceDb } from "../_shared/asaas.ts";

Deno.serve(async(req)=>{
 if(req.method!=="POST")return json({ok:false,error:"Method not allowed"},405);
 try{
  const received=req.headers.get("asaas-access-token")||"";
  if(!received||received!==env("ASAAS_WEBHOOK_TOKEN"))return json({ok:false,error:"Unauthorized"},401);
  const payload=await req.json();const event=String(payload.event||"");
  const checkout=payload.checkout||{};
  const charge=payload.payment||{};
  const providerReference=String(charge.id||checkout.id||"");
  const eventId=String(payload.id||[event,providerReference,charge.status||checkout.status].filter(Boolean).join(":"));
  if(!eventId||!providerReference)throw new Error("Invalid webhook payload");
  const db=serviceDb();
  const {data:processed}=await db.from("payment_webhook_events").select("id").eq("id",eventId).maybeSingle();
  if(processed)return json({ok:true,duplicate:true});

  const paid=["PAYMENT_CONFIRMED","PAYMENT_RECEIVED","CHECKOUT_PAID"].includes(event);
  const refunded=event==="PAYMENT_REFUNDED";
  const cancelled=["PAYMENT_DELETED","CHECKOUT_CANCELED","CHECKOUT_EXPIRED"].includes(event);
  const rejected=event==="PAYMENT_CREDIT_CARD_CAPTURE_REFUSED";
  const status=paid?"paid":refunded?"refunded":cancelled?"cancelled":rejected?"rejected":"pending";
  const update:any={status,provider_payload:checkout.id?checkout:charge,updated_at:new Date().toISOString()};
  if(paid)update.paid_at=new Date().toISOString();
  const {data:payment,error}=await db.from("payments").update(update).in("provider",["asaas","asaas_checkout"]).eq("provider_reference",providerReference).select("id,order_id,customer_id").maybeSingle();
  if(error)throw error;
  if(!payment)throw new Error("Payment not found for webhook");
  if(payment.order_id){
   const orderUpdate:any={payment_status:status};
   if(paid){orderUpdate.status="paid";orderUpdate.payment_status="paid"}
   const {error:orderError}=await db.from("orders").update(orderUpdate).eq("id",payment.order_id);
   if(orderError)throw orderError;
   if(paid){
    const {error:notificationError}=await db.from("notifications").insert({user_id:payment.customer_id,type:"payment_confirmed",title:"Pagamento confirmado",message:"Seu pagamento foi confirmado.",link:"/app/pedidos/"+payment.order_id,metadata:{order_id:payment.order_id,payment_id:payment.id}});
    if(notificationError)throw notificationError;
   }
  }
  const {error:eventError}=await db.from("payment_webhook_events").insert({id:eventId,provider:"asaas",event_type:event,provider_reference:providerReference,payload});
  if(eventError?.code==="23505")return json({ok:true,duplicate:true});
  if(eventError)throw eventError;
  return json({ok:true});
 }catch(error){return json({ok:false,error:error instanceof Error?error.message:"Unknown error"},400)}
});