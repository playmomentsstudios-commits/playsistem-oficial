import { asaas, corsHeaders, ensureAsaasCustomer, json, requireCustomer } from "../_shared/asaas.ts";

const digits=(value:unknown)=>String(value||"").replace(/\D/g,"");
const clientIp=(req:Request)=>{
 const forwarded=req.headers.get("x-forwarded-for")?.split(",")[0]?.trim();
 return req.headers.get("cf-connecting-ip")||forwarded||req.headers.get("x-real-ip")||"";
};

Deno.serve(async(req)=>{
 if(req.method==="OPTIONS")return new Response("ok",{headers:corsHeaders});
 try{
  const {db,userId,profile}=await requireCustomer(req);
  const body=await req.json();
  const {order_id,installment_count=1,credit_card}=body;
  if(!order_id)throw new Error("order_id is required");
  const count=Number(installment_count);
  if(!Number.isInteger(count)||count<1||count>12)throw new Error("Parcelamento inválido.");
  if(!credit_card?.holderName||!credit_card?.number||!credit_card?.expiryMonth||!credit_card?.expiryYear||!credit_card?.ccv)throw new Error("Preencha os dados do cartão.");

  const cpfCnpj=digits(profile.document_number),phone=digits(profile.phone),postalCode=digits(profile.postal_code);
  if(![11,14].includes(cpfCnpj.length))throw new Error("Complete o CPF/CNPJ em Meu Perfil.");
  if(!phone)throw new Error("Complete o telefone em Meu Perfil.");
  if(!postalCode||!profile.address_number)throw new Error("Complete o endereço em Meu Perfil.");
  const remoteIp=clientIp(req);
  if(!remoteIp)throw new Error("Não foi possível identificar o IP do comprador.");

  const {data:order,error}=await db.from("orders").select("id,order_number,total,payment_status").eq("id",order_id).eq("customer_id",userId).single();
  if(error||!order)throw new Error("Pedido não encontrado.");
  if(order.payment_status==="paid")throw new Error("Pedido já está pago.");

  const customer=await ensureAsaasCustomer(db,profile);
  const dueDate=new Date().toISOString().slice(0,10);
  const card={holderName:String(credit_card.holderName).trim(),number:digits(credit_card.number),expiryMonth:String(credit_card.expiryMonth).padStart(2,"0"),expiryYear:String(credit_card.expiryYear),ccv:digits(credit_card.ccv)};
  const holder={name:card.holderName,email:profile.email,cpfCnpj,postalCode,addressNumber:String(profile.address_number),addressComplement:profile.address_complement||undefined,phone};

  const payload:any={customer,billingType:"CREDIT_CARD",dueDate,description:"Play Moments - "+order.order_number,externalReference:order.id,creditCard:card,creditCardHolderInfo:holder,remoteIp};
  if(count===1)payload.value=order.total/100;
  else{payload.installmentCount=count;payload.totalValue=order.total/100}

  const charge=await asaas("/payments",{method:"POST",body:JSON.stringify(payload)});
  const paymentValues={customer_id:userId,order_id:order.id,amount:order.total,method:"card",status:"pending",provider:"asaas",provider_reference:charge.id,provider_customer_id:customer,provider_payload:{id:charge.id,status:charge.status,installment:charge.installment||null,installmentCount:count,last4:card.number.slice(-4)}};
  const {data:manual}=await db.from("payments").select("id").eq("order_id",order.id).eq("provider","manual").in("status",["pending","awaiting_confirmation"]).order("created_at",{ascending:false}).limit(1).maybeSingle();
  const write=manual?.id?db.from("payments").update(paymentValues).eq("id",manual.id):db.from("payments").insert(paymentValues);
  const {error:paymentError}=await write;if(paymentError)throw paymentError;
  return json({ok:true,paymentId:charge.id,status:charge.status,installmentCount:count});
 }catch(error){return json({ok:false,error:error instanceof Error?error.message:"Unknown error"},400)}
});
