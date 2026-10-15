// Private checkout generator + provider-verified asynchronous Pix webhook.
// A QR displays the official InfinitePay checkout URL, not a fake Pix BR Code.
import {createClient} from "npm:@supabase/supabase-js@2";
import QRCode from "npm:qrcode@1.5.4";
const cors={
 "Access-Control-Allow-Origin":"*",
 "Access-Control-Allow-Headers":"authorization, apikey, content-type, x-client-info",
 "Access-Control-Allow-Methods":"POST,OPTIONS",
};
const json=(body:unknown,status=200)=>new Response(JSON.stringify(body),{status,headers:{...cors,"Content-Type":"application/json"}});
function db(){
 const url=Deno.env.get("SUPABASE_URL"),key=Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
 if(!url||!key)throw new Error("Serviço Supabase não configurado");
 return createClient(url,key,{auth:{autoRefreshToken:false,persistSession:false}});
}
const uuid=/^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/i;
async function settings(client:ReturnType<typeof db>){
 const {data,error}=await client.from("academy_payment_settings").select("infinitepay_handle,infinitepay_enabled").eq("id",true).single();
 if(error||!data?.infinitepay_enabled||!data.infinitepay_handle)throw new Error("Configure sua InfiniteTag na Gestão da Academia antes do Pix.");
 return String(data.infinitepay_handle);
}
async function verifyPayment(handle:string,sale:{id:string;amount_cents:number},body:Record<string,unknown>){
 const transaction=String(body.transaction_nsu||"");
 const slug=String(body.invoice_slug||body.slug||"");
 if(!transaction||!slug||transaction.length>150||slug.length>150)return {ok:false,error:"Dados de cobrança incompletos"};
 const response=await fetch("https://api.checkout.infinitepay.io/payment_check",{
  method:"POST",headers:{"Content-Type":"application/json"},
  body:JSON.stringify({handle,order_nsu:sale.id,transaction_nsu:transaction,slug}),
  signal:AbortSignal.timeout(15000)
 });
 if(!response.ok)return {ok:false,error:"Verificação InfinitePay indisponível"};
 const result=await response.json();
 // Always compare the ORIGINAL charge amount, not paid_amount (possible fee).
 const match=result?.success===true&&result?.paid===true&&result?.capture_method==="pix"
  &&Number(result?.amount)===Number(sale.amount_cents);
 return {ok:match,error:match?null:"Pagamento não confirmado como Pix neste valor.",slug,transaction};
}
Deno.serve(async req=>{
 if(req.method==="OPTIONS")return new Response(null,{headers:cors});
 if(req.method!=="POST")return json({ok:false,error:"Method not allowed"},405);
 try{
  const client=db();
  if(new URL(req.url).searchParams.get("webhook")==="1"){
   // This public callback NEVER trusts a webhook as payment proof.
   const body=await req.json() as Record<string,unknown>;
   const saleId=String(body.order_nsu||"");
   if(!uuid.test(saleId))return json({success:false,message:"Invalid order"},400);
   const {data:sale,error:saleError}=await client.from("academy_work_sales")
    .select("id,amount_cents,payment_method,status,transaction_nsu,provider_slug")
    .eq("id",saleId).maybeSingle();
   if(saleError||!sale||sale.payment_method!=="infinitepay_pix")return json({success:false,message:"Order not found"},400);
   if(sale.status==="completed"&&sale.transaction_nsu===String(body.transaction_nsu||"")
    &&sale.provider_slug===String(body.invoice_slug||""))return json({success:true,message:null});
   if(sale.status!=="pending")return json({success:false,message:"Order already closed"},400);
   if(String(body.capture_method||"")!=="pix"||Number(body.amount)!==Number(sale.amount_cents))return json({success:false,message:"Wrong method or amount"},400);
   const handle=await settings(client);
   const verified=await verifyPayment(handle,sale,body);
   if(!verified.ok)return json({success:false,message:verified.error},400);
   const receipt=String(body.receipt_url||"");
   const receiptUrl=receipt.startsWith("https://")?receipt:null;
   const {data,error}=await client.rpc("academy_complete_verified_infinitepay_sale",{
    p_sale_id:sale.id,p_invoice_slug:verified.slug,p_transaction_nsu:verified.transaction,
    p_amount_cents:sale.amount_cents,p_receipt_url:receiptUrl
   });
   if(error||data!==true)return json({success:false,message:"Unable to complete verified sale"},400);
   return json({success:true,message:null});
  }
  const token=(req.headers.get("Authorization")||"").replace(/^Bearer\s+/i,"");
  if(!token)return json({ok:false,error:"Entre no painel administrativo"},401);
  const {data:identity,error:identityError}=await client.auth.getUser(token);
  if(identityError||!identity.user)return json({ok:false,error:"Não autorizado"},401);
  const {data:profile}=await client.from("profiles").select("role,status").eq("id",identity.user.id).single();
  if(!profile||profile.role!=="admin"||profile.status!=="active")return json({ok:false,error:"Somente administrador"},403);
  const body=await req.json();
  const saleId=String(body.sale_id||"");
  if(!uuid.test(saleId))return json({ok:false,error:"Cobrança inválida"},400);
  const {data:sale,error:saleError}=await client.from("academy_work_sales")
   .select("id,work_id,customer_id,format,payment_method,amount_cents,status,payment_url,work:academy_library_works(title,release_code)")
   .eq("id",saleId).single();
  if(saleError||!sale||sale.payment_method!=="infinitepay_pix")return json({ok:false,error:"Cobrança não encontrada"},404);
  if(sale.status==="completed")return json({ok:true,status:"completed"});
  if(sale.status!=="pending")return json({ok:false,error:"Cobrança já encerrada"},409);
  const handle=await settings(client);
  if(sale.payment_url){
   const qr=await QRCode.toDataURL(sale.payment_url,{errorCorrectionLevel:"M",margin:2,width:340});
   return json({ok:true,status:"pending",checkout_url:sale.payment_url,qr_data_url:qr,reused:true});
  }
  const work=Array.isArray(sale.work)?sale.work[0]:sale.work;
  const label=sale.format==="combo"?"Combo e-book + audiobook":sale.format==="ebook"?"E-book":"Audiobook";
  const base=Deno.env.get("SUPABASE_URL")?.replace(/\/$/,"")||"";
  const payload={
   handle,
   order_nsu:sale.id,
   redirect_url:"https://playsistem-oficial.playmomentsstudios.workers.dev/academia",
   webhook_url:base+"/functions/v1/academy-infinitepay?webhook=1",
   items:[{quantity:1,price:sale.amount_cents,description:(work?.title||"SAGA NEGRA")+" · "+label}],
  };
  const response=await fetch("https://api.checkout.infinitepay.io/links",{
   method:"POST",headers:{"Content-Type":"application/json"},
   body:JSON.stringify(payload),signal:AbortSignal.timeout(15000)
  });
  const checkout=await response.json().catch(()=>null);
  const paymentUrl=String(checkout?.url||"");
  let parsed:URL|null=null;try{parsed=new URL(paymentUrl)}catch{}
  if(!response.ok||!parsed||parsed.protocol!=="https:"||parsed.hostname!=="checkout.infinitepay.com.br")
   throw new Error("A InfinitePay não retornou um checkout oficial válido.");
  const {error:saveError}=await client.from("academy_work_sales").update({payment_url:paymentUrl,updated_at:new Date().toISOString()})
    .eq("id",sale.id).eq("status","pending").is("payment_url",null);
  if(saveError)throw saveError;
  const qr=await QRCode.toDataURL(paymentUrl,{errorCorrectionLevel:"M",margin:2,width:340});
  return json({ok:true,status:"pending",checkout_url:paymentUrl,qr_data_url:qr,reused:false});
 }catch(e){
  console.error("Academy InfinitePay error",e instanceof Error?e.message:"Unexpected error");
  return json({ok:false,error:e instanceof Error?e.message:"Ocorreu um erro na cobrança"},400);
 }
});
