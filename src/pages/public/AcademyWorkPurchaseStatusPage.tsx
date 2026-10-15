import {useCallback,useEffect,useState} from 'react'
import {Link,useParams} from 'react-router-dom'
import {BrandImage} from '../../components/BrandImage'
import {supabase} from '../../lib/supabase'
import {useAuth} from '../../contexts/AuthContext'

type Status='creating'|'pending'|'paid_waiting_email'|'fulfilled'|'failed'|'expired'|'refunded'
type Receipt={status:Status;release_code:string;requested_format:'ebook'|'audiobook'|'combo';amount_cents:number}
const money=(cents:number)=>new Intl.NumberFormat('pt-BR',{style:'currency',currency:'BRL'}).format(cents/100)
export function AcademyWorkPurchaseStatusPage(){
 const {id=''}=useParams()
 const {isAuthenticated}=useAuth()
 const [receipt,setReceipt]=useState<Receipt|null>(null)
 const [loading,setLoading]=useState(true)
 const [error,setError]=useState('')
 const [checkoutUrl,setCheckoutUrl]=useState('')
 const update=useCallback(async()=>{
  if(!/^[a-f0-9-]{36}$/i.test(id))throw new Error('Pedido inválido.')
  const {data,error:failure}=await supabase.rpc('academy_public_purchase_status',{p_purchase_id:id})
  if(failure)throw failure
  if(!Array.isArray(data)||!data[0])throw new Error('Pedido não encontrado.')
  const value=data[0] as Receipt
  setReceipt(value);setError('')
  if(isAuthenticated&&value.status==='paid_waiting_email'){
   // Safe retry, granted only if Supabase itself says the email is verified.
   const result=await supabase.rpc('academy_finalize_my_paid_works')
   if(!result.error&&Number(result.data)>0){
    const reread=await supabase.rpc('academy_public_purchase_status',{p_purchase_id:id})
    if(!reread.error&&Array.isArray(reread.data)&&reread.data[0])setReceipt(reread.data[0] as Receipt)
   }
  }
  if(isAuthenticated){
   const {data:owned}=await supabase.from('academy_work_purchases')
    .select('provider_checkout_url').eq('id',id).maybeSingle()
   const link=String(owned?.provider_checkout_url||'')
   try{
    const u=new URL(link)
    if(u.protocol==='https:'&&['checkout.infinitepay.com.br','checkout.infinitepay.io','checkout.infinitepay.com'].includes(u.hostname))
     setCheckoutUrl(link)
   }catch{}
  }
  if(value.status==='fulfilled'){
   try{window.localStorage.removeItem('sagamente.academy.pending-purchase.'+value.release_code)}catch{}
  }
 },[id,isAuthenticated])
 useEffect(()=>{
  let mounted=true
  setLoading(true)
  void update().catch(e=>{if(mounted)setError(e instanceof Error?e.message:'Não foi possível consultar o pedido.')})
   .finally(()=>{if(mounted)setLoading(false)})
  return()=>{mounted=false}
 },[update])
 useEffect(()=>{
  if(receipt?.status!=='pending'&&receipt?.status!=='paid_waiting_email'&&receipt?.status!=='creating')return
  let running=false
  const timer=window.setInterval(()=>{
   if(document.visibilityState==='hidden'||running)return
   running=true
   void update().catch(()=>undefined).finally(()=>{running=false})
  },7000)
  return()=>window.clearInterval(timer)
 },[receipt?.status,update])
 const title=receipt?.status==='fulfilled'?'Seu conteúdo já está disponível':
  receipt?.status==='paid_waiting_email'?'Pagamento recebido. Confirme seu e-mail':
  receipt?.status==='pending'?'Aguardando o Pix':
  receipt?.status==='creating'?'Preparando o pagamento...':
  receipt?.status==='failed'?'Não foi possível concluir este pedido':
  receipt?.status==='expired'?'Seu pagamento expirou':
  receipt?.status==='refunded'?'Pagamento reembolsado':'Acompanhe seu pedido'
 return <main className="min-h-screen bg-[#0b0c10] text-[#f5e8da]">
  <header className="border-b border-white/10 px-5 py-5"><div className="mx-auto flex max-w-4xl items-center justify-between">
   <Link to="/academia"><BrandImage variant="dark" alt="Sagamente" className="h-9 w-auto"/></Link>
   <Link to="/academia" className="text-xs font-bold text-[#e9b487]">← Academia</Link>
  </div></header>
  <section className="mx-auto max-w-2xl px-5 py-16">
   {loading?<p role="status" className="text-sm text-gray-400">Conferindo pagamento...</p>:
   error?<div role="alert" className="rounded-2xl border border-red-500/20 bg-red-500/10 p-6 text-sm text-red-200">{error}</div>:
   receipt&&<div className="rounded-3xl border border-[#bd7345]/25 bg-[#151619] p-6 sm:p-9">
    <p className="text-xs font-bold uppercase tracking-[.18em] text-[#e5a274]">SAGA NEGRA · Release {receipt.release_code}</p>
    <h1 className="mt-4 font-serif text-3xl font-bold leading-tight">{title}</h1>
    <p className="mt-4 text-sm leading-7 text-[#c4b8ab]">
     {receipt.status==='fulfilled'?'Pagamento confirmado e sua obra liberada em Minha Academia.':
      receipt.status==='paid_waiting_email'?'A InfinitePay confirmou o pagamento. O material será liberado após a confirmação do e-mail usado no cadastro. Abra a mensagem recebida e confirme sua conta.':
      receipt.status==='pending'?'Assim que a InfinitePay confirmar o pagamento, atualizaremos este pedido automaticamente. Pode levar alguns instantes.':
      receipt.status==='creating'?'Seu checkout está sendo preparado.':
      'Este pedido não está ativo. Volte à obra para iniciar um novo pagamento, caso deseje.'}
    </p>
    <div className="my-6 flex items-center justify-between border-y border-white/10 py-4">
     <span className="text-sm text-gray-400">{receipt.requested_format==='combo'?'Combo e-book + audiobook':receipt.requested_format==='ebook'?'E-book':'Audiobook'}</span>
     <strong className="text-xl tabular-nums">{money(receipt.amount_cents)}</strong>
    </div>
    <div className="flex flex-wrap gap-3">
     {receipt.status==='fulfilled'&&<Link to="/app/academia" className="inline-flex min-h-12 items-center rounded-xl bg-[#b86d40] px-6 text-sm font-bold">Abrir Minha Academia →</Link>}
     {receipt.status==='paid_waiting_email'&&!isAuthenticated&&<Link to="/login?next=%2Fapp%2Facademia" className="inline-flex min-h-12 items-center rounded-xl bg-[#b86d40] px-6 text-sm font-bold">Já confirmei meu e-mail: entrar</Link>}
     {receipt.status==='pending'&&checkoutUrl&&<a href={checkoutUrl} target="_blank" rel="noopener noreferrer" className="inline-flex min-h-12 items-center rounded-xl bg-[#b86d40] px-6 text-sm font-bold">Abrir meu Pix ↗</a>}
     <button onClick={()=>void update().catch(e=>setError(e instanceof Error?e.message:'Falha ao atualizar.'))} className="min-h-12 rounded-xl border border-white/15 px-5 text-sm font-semibold">Atualizar status</button>
    </div>
    <p className="mt-6 break-all text-[11px] text-gray-600">Pedido: {id}</p>
    <p className="mt-2 text-[11px] text-gray-500">Este acompanhamento não confirma pagamentos por captura de tela ou pelo retorno do navegador. A liberação depende da confirmação verificada do provedor.</p>
   </div>}
  </section>
 </main>
}
