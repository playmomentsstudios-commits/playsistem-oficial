import { asaas, asaasEnvironment, corsHeaders, ensureAsaasCustomer, json, requireCustomer } from "../_shared/asaas.ts";

Deno.serve(async(req)=>{
 if(req.method==="OPTIONS")return new Response("ok",{headers:corsHeaders});
 try{
  const {db,userId,profile}=await requireCustomer(req);
  const {order_id,billing_type="PIX"}=await req.json();
  if(!order_id)throw new Error("order_id is required");
  // This endpoint is intentionally PIX-only. Card data must go through
  // asaas-card-payment so validation, remote IP and holder data cannot be bypassed.
  if(billing_type!=="PIX")throw new Error("Use the dedicated card payment flow for credit cards.");
  const {data:order,error}=await db.from("orders").select("id,order_number,total,status,payment_status").eq("id",order_id).eq("customer_id",userId).single();
  if(error||!order)throw new Error("Order not found");
  if(order.payment_status==="paid")throw new Error("Order already paid");
  const {data:existing}=await db.from("payments").select("*").eq("order_id",order.id).eq("provider","asaas").in("status",["pending","awaiting_confirmation","paid"]).order("created_at",{ascending:false}).limit(1).maybeSingle();
  if(existing?.provider_reference){
    const environment=asaasEnvironment();
    if(existing.environment!==environment){
      const {data:classified,error:classifyError}=await db.from("payments").update({environment,updated_at:new Date().toISOString()}).eq("id",existing.id).eq("provider","asaas").select("*").single();
      if(classifyError)throw classifyError;
      return json({ok:true,payment:classified,reused:true});
    }
    return json({ok:true,payment:existing,reused:true});
  }

  const customerId=await ensureAsaasCustomer(db,profile);
  const dueDate=new Date();dueDate.setDate(dueDate.getDate()+1);
  const charge=await asaas("/payments",{method:"POST",body:JSON.stringify({
    customer:customerId,billingType:billing_type,value:order.total/100,
    dueDate:dueDate.toISOString().slice(0,10),description:"Sagamente - "+order.order_number,
    externalReference:order.id
  })});
  const method="pix_gateway";
  const pixQrCode=await asaas("/payments/"+charge.id+"/pixQrCode");
  const providerPayload={...charge,...(pixQrCode?{pixQrCode}:{})};
  const paymentValues={
    customer_id:userId,order_id:order.id,amount:order.total,method,status:"pending",provider:"asaas",environment:asaasEnvironment(),
    provider_reference:charge.id,provider_customer_id:customerId,provider_payload:providerPayload,due_date:charge.dueDate||null
  };
  const {data:manual}=await db.from("payments").select("id").eq("order_id",order.id).eq("provider","manual").in("status",["pending","awaiting_confirmation"]).order("created_at",{ascending:false}).limit(1).maybeSingle();
  const write=manual?.id
    ? db.from("payments").update(paymentValues).eq("id",manual.id)
    : db.from("payments").insert(paymentValues);
  const {data:payment,error:paymentError}=await write.select("*").single();
  if(paymentError)throw paymentError;
  return json({ok:true,payment,charge,pixQrCode});
 }catch(error){return json({ok:false,error:error instanceof Error?error.message:"Unknown error"},400)}
});