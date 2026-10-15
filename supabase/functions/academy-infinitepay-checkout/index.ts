import {createClient} from 'npm:@supabase/supabase-js@2'

const headers={'Access-Control-Allow-Origin':'*','Access-Control-Allow-Headers':'authorization, apikey, x-client-info, content-type','Access-Control-Allow-Methods':'POST,OPTIONS'}
const response=(body:unknown,status=200)=>new Response(JSON.stringify(body),{status,headers:{...headers,'Content-Type':'application/json'}})
const env=(key:string)=>Deno.env.get(key)||''
const db=()=>createClient(env('SUPABASE_URL'),env('SUPABASE_SERVICE_ROLE_KEY'),{auth:{persistSession:false,autoRefreshToken:false}})
const reject=(description:string,status=400)=>response({ok:false,error:description},status)
const provider='https://api.checkout.infinitepay.io/links'
const canonicalSite='https://playsistem-oficial.playmomentsstudios.workers.dev'
const formatNames={ebook:'E-book',audiobook:'Audiobook',combo:'Combo (E-book + Audiobook)'} as const
type Format=keyof typeof formatNames
const validFormat=(v:unknown):v is Format=>typeof v==='string'&&v in formatNames
const emailMatch=(a:string,b:string)=>a.trim().toLowerCase()===b.trim().toLowerCase()
const validCheckoutUrl=(raw:unknown)=>{
 if(typeof raw!=='string')return false
 try{
  const url=new URL(raw)
  return url.protocol==='https:'&&
   ['checkout.infinitepay.com.br','checkout.infinitepay.io','checkout.infinitepay.com'].includes(url.hostname)
 }catch{return false}
}
Deno.serve(async request=>{
 if(request.method==='OPTIONS')return new Response('ok',{headers})
 if(request.method!=='POST')return reject('Método não permitido.',405)
 try{
  const database=db()
  const {data:settings,error:settingsError}=await database.from('academy_infinitepay_settings')
   .select('infinitepay_handle,checkout_enabled').eq('id',true).maybeSingle()
  if(settingsError)throw settingsError
  if(settings?.checkout_enabled!==true)return reject('O checkout Pix está sendo preparado. Tente novamente mais tarde.',503)
  const handle=(env('INFINITEPAY_HANDLE')||settings?.infinitepay_handle||'').replace(/^\$/,'').trim()
  if(!/^[a-zA-Z0-9._-]{3,80}$/.test(handle))return reject('Conta InfinitePay ainda não configurada.',503)
  const payload=await request.json()
  const release=String(payload?.release_code||'').trim()
  const format=payload?.requested_format
  if(!/^[0-9A-Za-z_-]{1,24}$/.test(release)||!validFormat(format))return reject('Obra ou formato inválido.')
  let userId=''
  let userEmail=''
  let verified=false
  const bearer=(request.headers.get('Authorization')||'').replace(/^Bearer\s+/i,'')
  if(bearer){
   const {data}=await database.auth.getUser(bearer)
   if(data.user){
    userId=data.user.id
    userEmail=data.user.email||''
    verified=Boolean(data.user.email_confirmed_at)
   }
  }
  if(!userId){
   const guestId=String(payload?.guest_user_id||'')
   const guestEmail=String(payload?.guest_email||'').trim().toLowerCase()
   if(!/^[0-9a-f-]{36}$/i.test(guestId)||!guestEmail||guestEmail.length>160)
    return reject('Faça seu cadastro para continuar com o Pix.',401)
   const {data:guest,error:guestError}=await database.auth.admin.getUserById(guestId)
   if(guestError||!guest.user||!emailMatch(guest.user.email||'',guestEmail))
    return reject('Conta não localizada. Faça o cadastro novamente.',401)
   if(guest.user.email_confirmed_at)return reject('Sua conta já está ativa. Entre com seu e-mail e senha para pagar.',401)
   // Do not let arbitrary anonymous visitors create charges for old accounts.
   if(Date.now()-Date.parse(guest.user.created_at)>30*60*1000)return reject('Cadastro expirado. Confirme seu e-mail ou entre na sua conta.',401)
   userId=guest.user.id;userEmail=guestEmail
  }
  const {data:profile,error:profileError}=await database.from('profiles')
   .select('role,status,first_name,last_name,email,phone').eq('id',userId).maybeSingle()
  if(profileError||!profile||profile.role!=='customer'||profile.status!=='active')
   return reject('Esta conta não está habilitada para compras.',403)
  const {data:work,error:workError}=await database.from('academy_library_works')
   .select('id,title,release_code,landing_page_id').eq('release_code',release).maybeSingle()
  if(workError||!work)return reject('Obra não encontrada.',404)
  const {data:landing}=await database.from('site_landing_pages')
   .select('status,published_at').eq('id',work.landing_page_id).maybeSingle()
  if(!landing||landing.status!=='published'||(landing.published_at&&Date.parse(landing.published_at)>Date.now()))
   return reject('Esta obra ainda não está disponível.',409)
  const {data:price,error:priceError}=await database.from('academy_work_prices')
   .select('ebook_cents,audiobook_cents,combo_cents,checkout_enabled')
   .eq('work_id',work.id).maybeSingle()
  if(priceError||!price?.checkout_enabled)return reject('O pagamento desta obra ainda não foi ativado.',409)
  const {data:items,error:itemsError}=await database.from('academy_library_items')
   .select('id,format,status').eq('work_id',work.id).in('status',['published','private_beta'])
  if(itemsError)throw itemsError
  const available=new Set((items||[]).map(i=>i.format))
  if((format==='combo'&&(!available.has('ebook')||!available.has('audiobook')))
     ||(format!=='combo'&&!available.has(format)))return reject('O formato escolhido não está disponível.',409)
  const amount=Number(format==='ebook'?price.ebook_cents:format==='audiobook'?price.audiobook_cents:price.combo_cents)
  if(!Number.isSafeInteger(amount)||amount<1||amount>10000000)return reject('Preço inválido.',409)
  const {count,error:countError}=await database.from('academy_work_purchases')
   .select('id',{head:true,count:'exact'}).eq('user_id',userId).gte('created_at',new Date(Date.now()-60*60*1000).toISOString())
  if(countError)throw countError
  if((count||0)>=5)return reject('Limite temporário de tentativas atingido. Aguarde uma hora.',429)
  const id=crypto.randomUUID()
  const {error:insertError}=await database.from('academy_work_purchases').insert({
   id,work_id:work.id,user_id:userId,buyer_email:userEmail,
   requested_format:format,amount_cents:amount,provider_order_nsu:id,status:'creating'
  })
  if(insertError)throw insertError

  let url:string
  try{
   const post=await fetch(provider,{method:'POST',headers:{'Content-Type':'application/json'},
    body:JSON.stringify({
     handle,order_nsu:id,redirect_url:canonicalSite+'/academia/compra/'+id,
     webhook_url:env('SUPABASE_URL')+'/functions/v1/academy-infinitepay-webhook',
     items:[{quantity:1,price:amount,description:work.title+' · '+formatNames[format]}],
     customer:{
      name:[profile.first_name,profile.last_name].filter(Boolean).join(' ')||userEmail,
      email:userEmail,
      ...((profile.phone&&/^[0-9]{10,13}$/.test(String(profile.phone).replace(/[^0-9]/g,'')))?
       {phone_number:(String(profile.phone).replace(/[^0-9]/g,'').startsWith('55')?'+':'+55')+
        String(profile.phone).replace(/[^0-9]/g,'').replace(/^55/,'')}: {})
     }
    })})
   const json=await post.json().catch(()=>({}))
   if(!post.ok)throw new Error(String(json?.message||json?.error||'O provedor de Pix não conseguiu gerar o checkout.'))
   url=String(json?.url||'')
   if(!validCheckoutUrl(url))throw new Error('O provedor não retornou um link de checkout seguro.')
  }catch(e){
   await database.from('academy_work_purchases').update({status:'failed',updated_at:new Date().toISOString()}).eq('id',id).eq('status','creating')
   throw e
  }
  const {error:updateError}=await database.from('academy_work_purchases').update({
   provider_checkout_url:url,status:'pending',updated_at:new Date().toISOString()
  }).eq('id',id).eq('status','creating')
  if(updateError)throw updateError
  // If the payment webhook already marked the purchase paid, never revert it.
  return response({ok:true,purchase_id:id,checkout_url:url,
   total_cents:amount,currency:'BRL',format,requires_email_confirmation:!verified})
 }catch(error){
  const message=error instanceof Error?error.message:'Falha temporária no pagamento.'
  return reject(message,503)
 }
})
