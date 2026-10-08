import { asaas, corsHeaders, json, requireCustomer } from "../_shared/asaas.ts";

Deno.serve(async(req)=>{
 if(req.method==="OPTIONS")return new Response("ok",{headers:corsHeaders});
 try{
  const {db,userId}=await requireCustomer(req);
  const {order_id,return_url}=await req.json();
  if(!order_id)throw new Error("order_id is required");
  const {data:order,error}=await db.from("orders").select("id,order_number,total,payment_status").eq("id",order_id).eq("customer_id",userId).single();
  if(error||!order)throw new Error("Pedido não encontrado.");
  if(order.payment_status==="paid")throw new Error("Pedido já está pago.");
  const {data:existing}=await db.from("payments").select("*").eq("order_id",order.id).eq("provider","asaas_checkout").eq("status","pending").order("created_at",{ascending:false}).limit(1).maybeSingle();
  if(existing?.provider_reference){
   return json({ok:true,checkoutId:existing.provider_reference,checkoutUrl:existing.provider_payload?.checkoutLink||("https://sandbox.asaas.com/checkoutSession/show/"+existing.provider_reference),reused:true});
  }
  const base=String(return_url||"").replace(/\/$/,"");
  if(!base.startsWith("https://")&&!base.startsWith("http://localhost"))throw new Error("URL de retorno inválida.");
  const checkout=await asaas("/checkouts",{method:"POST",body:JSON.stringify({
   billingTypes:["CREDIT_CARD"],
   chargeTypes:["DETACHED","INSTALLMENT"],
   minutesToExpire:60,
   externalReference:order.id,
   callback:{
    successUrl:base+"/app/pagamentos?checkout=success",
    cancelUrl:base+"/app/pagamentos?checkout=cancelled",
    expiredUrl:base+"/app/pagamentos?checkout=expired"
   },
   items:[{name:"Sagamente - "+order.order_number,description:"Pagamento do pedido "+order.order_number,quantity:1,value:order.total/100}],
   installment:{maxInstallmentCount:12}
  })});
  if(!checkout?.id)throw new Error("O Asaas não retornou o checkout.");
  const {data:manual}=await db.from("payments").select("id").eq("order_id",order.id).eq("provider","manual").in("status",["pending","awaiting_confirmation"]).order("created_at",{ascending:false}).limit(1).maybeSingle();
  const effectiveCheckoutUrl=checkout.link||("https://sandbox.asaas.com/checkoutSession/show/"+checkout.id);
  const values={customer_id:userId,order_id:order.id,amount:order.total,method:"card",status:"pending",provider:"asaas_checkout",provider_reference:checkout.id,provider_payload:{checkoutId:checkout.id,checkoutLink:effectiveCheckoutUrl,maxInstallmentCount:12}};
  const write=manual?.id?db.from("payments").update(values).eq("id",manual.id):db.from("payments").insert(values);
  const {error:paymentError}=await write;
  if(paymentError)throw paymentError;
  return json({ok:true,checkoutId:checkout.id,checkoutUrl:effectiveCheckoutUrl});
 }catch(error){return json({ok:false,error:error instanceof Error?error.message:"Unknown error"},400)}
});
