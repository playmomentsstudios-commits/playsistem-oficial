import {createClient} from 'npm:@supabase/supabase-js@2'
const headers={'Content-Type':'application/json'}
const json=(payload:unknown,status=200)=>new Response(JSON.stringify(payload),{status,headers})
const env=(key:string)=>Deno.env.get(key)||''
const db=()=>createClient(env('SUPABASE_URL'),env('SUPABASE_SERVICE_ROLE_KEY'),{auth:{persistSession:false,autoRefreshToken:false}})

// InfinitePay's public checkout webhook does not document a signing secret.
// Never accept the incoming webhook or browser redirect as proof of payment.
// Query InfinitePay's payment_check API server-to-server using all identifiers.
Deno.serve(async request=>{
 if(request.method!=='POST')return json({success:false,message:'Method not allowed'},405)
 try{
  const payload=await request.json()
  const orderNsu=String(payload?.order_nsu||'')
  const slug=String(payload?.invoice_slug||payload?.slug||'')
  const transactionNsu=String(payload?.transaction_nsu||'')
  if(!/^[0-9a-f-]{36}$/i.test(orderNsu)||slug.length<3||slug.length>180||
    transactionNsu.length<3||transactionNsu.length>180)return json({success:false,message:'Invalid checkout event'},400)
  const database=db()
  const {data:order,error:lookupError}=await database.from('academy_work_purchases')
   .select('id,status,amount_cents,provider_order_nsu,provider_transaction_nsu,provider_invoice_slug')
   .eq('provider_order_nsu',orderNsu).maybeSingle()
  if(lookupError)throw lookupError
  if(!order)return json({success:false,message:'Order not found'},400)
  if(order.provider_transaction_nsu&&order.provider_transaction_nsu!==transactionNsu)
   return json({success:false,message:'Transaction conflict'},409)
  if(order.provider_invoice_slug&&order.provider_invoice_slug!==slug)
   return json({success:false,message:'Invoice conflict'},409)
  const handle=env('INFINITEPAY_HANDLE').replace(/^\$/,'').trim()
  if(!handle)throw new Error('InfinitePay configuration missing.')
  const check=await fetch('https://api.checkout.infinitepay.io/payment_check',{
   method:'POST',headers:{'Content-Type':'application/json'},
   body:JSON.stringify({handle,order_nsu:orderNsu,transaction_nsu:transactionNsu,slug})
  })
  if(!check.ok)throw new Error('Provider verification failed.')
  const verified=await check.json()
  if(verified?.success!==true||verified?.paid!==true)
   return json({success:false,message:'Payment not confirmed'},400)
  // All prices are stored as integer BRL cents before the checkout was created.
  const amount=Number(verified.amount)
  if(!Number.isSafeInteger(amount)||amount!==order.amount_cents)
   return json({success:false,message:'Verified amount mismatch'},409)
  const format=String(verified.capture_method||'')
  if(!['pix','credit_card','credit_card_wallet'].includes(format))
   return json({success:false,message:'Unknown payment method'},409)
  if(order.status==='fulfilled')return json({success:true,message:null,duplicate:true})
  if(!['creating','pending','paid_waiting_email'].includes(order.status))
   return json({success:false,message:'Order not payable'},409)
  // A unique NSU protects against applying the same provider transaction to 2 users.
  const {error:paymentError}=await database.from('academy_work_purchases').update({
   status:'paid_waiting_email',paid_at:new Date().toISOString(),
   provider_transaction_nsu:transactionNsu,provider_invoice_slug:slug,
   provider_capture_method:format,updated_at:new Date().toISOString()
  }).eq('id',order.id).in('status',['creating','pending','paid_waiting_email'])
  if(paymentError)throw paymentError
  const {data:fulfillment,error:grantError}=await database.rpc('academy_fulfill_verified_purchase',{p_purchase_id:order.id})
  if(grantError)throw grantError
  return json({success:true,message:null,fulfillment})
 }catch(e){
  console.error('[academy-infinitepay-webhook] payment verification or fulfillment failed',e instanceof Error?e.message:'unknown')
  return json({success:false,message:'Payment reconciliation unavailable'},400)
 }
})
