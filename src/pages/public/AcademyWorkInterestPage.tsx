import {useEffect,useState} from 'react'
import {Link,useNavigate,useParams,useSearchParams} from 'react-router-dom'
import {BrandImage} from '../../components/BrandImage'
import {supabase} from '../../lib/supabase'
import {useAuth} from '../../contexts/AuthContext'
import {RegisterPage} from './RegisterPage'
import {authLink} from '../../lib/navigation'
import {academyComboSavings,formatAcademyMoney as money,type AcademyWorkPrice} from '../../lib/academyPricing'
import './academyCheckout.css'

type Format='ebook'|'audiobook'|'combo'
type Work={release_code:string;title:string;description:string|null;cover_url:string|null;landing_slug:string;ebook_status:string|null;audiobook_status:string|null}
type WorkPrice=AcademyWorkPrice
const card='academy-format-option min-w-0 rounded-xl border px-1.5 py-4 text-center transition-colors focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-[#f1b586] sm:px-3'
const checkoutKey=(release:string)=>'sagamente.academy.pending-purchase.'+release
const isSafeCheckout=(value:string)=>{
 try{return new URL(value).protocol==='https:'&&['checkout.infinitepay.com.br','checkout.infinitepay.io','checkout.infinitepay.com'].includes(new URL(value).hostname)}
 catch{return false}
}
export function AcademyWorkInterestPage(){
 const {release=''}=useParams()
 const navigate=useNavigate()
 const {user,isAuthenticated,isLoading}=useAuth()
 const [query,setQuery]=useSearchParams()
 const [work,setWork]=useState<Work|null>(null)
 const [price,setPrice]=useState<WorkPrice|null>(null)
 const [loading,setLoading]=useState(true)
 const [error,setError]=useState('')
 const [sending,setSending]=useState(false)
 const selected=query.get('formato')
 const [format,setFormat]=useState<Format>(selected==='ebook'||selected==='audiobook'||selected==='combo'?selected:'combo')
 useEffect(()=>{
  let active=true
  setLoading(true)
  void (async()=>{
   try{
    const [catalog,prices]=await Promise.all([
     supabase.rpc('academy_public_works'),supabase.rpc('academy_public_work_prices')
    ])
    if(catalog.error)throw catalog.error
    if(prices.error)throw prices.error
    const found=(catalog.data||[]).find((row:Work)=>row.release_code===release)||null
    const offer=(prices.data||[]).find((row:WorkPrice)=>row.release_code===release)||null
    if(active){setWork(found);setPrice(offer)}
   }catch(e){if(active)setError(e instanceof Error?e.message:'Não foi possível consultar as opções desta obra.')}
   finally{if(active)setLoading(false)}
  })()
  return()=>{active=false}
 },[release])
 const ebook=Boolean(work?.ebook_status),audiobook=Boolean(work?.audiobook_status)
 useEffect(()=>{
  if(!work)return
  if(format==='combo'&&(!ebook||!audiobook))setFormat(ebook?'ebook':'audiobook')
  if(format==='ebook'&&!ebook)setFormat(audiobook?'audiobook':'ebook')
  if(format==='audiobook'&&!audiobook)setFormat(ebook?'ebook':'audiobook')
 },[work,ebook,audiobook,format])
 const total=price?(format==='ebook'?price.ebook_cents:format==='audiobook'?price.audiobook_cents:price.combo_cents):0
 const savings=academyComboSavings(price)
 const returnPath='/academia/comprar/'+encodeURIComponent(release)+'?formato='+format
 function choose(option:Format){setFormat(option);setQuery({formato:option},{replace:true});setError('')}
 useEffect(()=>{
  if(!isAuthenticated||!work)return
  try{
   const purchase=window.localStorage.getItem(checkoutKey(work.release_code))
   if(/^[a-f0-9-]{36}$/i.test(purchase||''))navigate('/academia/compra/'+purchase,{replace:true})
  }catch{}
 },[isAuthenticated,work,navigate])
 async function checkout(guest?:{guest_user_id:string;guest_email:string}){
  if(!work||!price||!price.checkout_enabled)throw new Error('O pagamento desta obra ainda não foi ativado.')
  try{
   setSending(true);setError('')
   const {data,error:failure}=await supabase.functions.invoke('academy-infinitepay-checkout',{
    body:{release_code:work.release_code,requested_format:format,...guest}
   })
   if(failure||!data?.ok)throw new Error(data?.error||failure?.message||'Não foi possível gerar o Pix.')
   const url=String(data.checkout_url||''),id=String(data.purchase_id||'')
   if(!isSafeCheckout(url)||!/^[a-f0-9-]{36}$/i.test(id))throw new Error('O checkout não retornou um link seguro.')
   try{window.localStorage.setItem(checkoutKey(work.release_code),id)}catch{}
   window.location.assign(url)
  }catch(e){
   const message=e instanceof Error?e.message:'Falha ao preparar o Pix.'
   setError(message)
   throw e
  }finally{setSending(false)}
 }
 return <main className="min-h-screen bg-[#0b0c10] text-[#f5e8da]">
  <header className="border-b border-white/10 px-5 py-5"><div className="mx-auto flex max-w-5xl items-center justify-between">
   <Link to="/academia" aria-label="Voltar à Academia Sagamente"><BrandImage variant="dark" alt="Sagamente" className="h-9 w-auto"/></Link>
   <Link to="/academia#obras-digitais" className="text-xs font-semibold text-[#f0b98b]">← Todas as obras</Link>
  </div></header>
  {loading||isLoading?<div role="status" className="mx-auto max-w-4xl px-5 py-20 text-sm text-gray-400">Preparando seu pedido...</div>:
   !work?<div className="mx-auto max-w-4xl px-5 py-20"><h1 className="text-2xl font-bold">Obra indisponível</h1><p role="alert" className="mt-3 text-sm text-gray-400">{error||'Não foi possível localizar esta obra.'}</p><Link to="/academia" className="mt-5 inline-block text-[#e9a77a] underline">Voltar à Academia</Link></div>:
   <div className="mx-auto grid max-w-6xl gap-8 px-5 py-12 md:grid-cols-[.85fr_1.15fr] md:py-16">
    <aside className="space-y-4">
     <p className="text-xs font-bold uppercase tracking-[.19em] text-[#dd9c68]">SAGA NEGRA · Release {work.release_code}</p>
     <h1 className="font-serif text-3xl font-bold leading-tight sm:text-4xl">{work.title}</h1>
     {work.cover_url&&<img src={work.cover_url} alt={'Capa de '+work.title} className="max-h-72 w-auto rounded-xl object-cover"/>}
     <Link to={'/l/'+encodeURIComponent(work.landing_slug)} className="inline-flex min-h-11 items-center text-xs font-semibold text-[#e9a77a] underline">← Voltar à apresentação</Link>
    </aside>
    <section className="min-w-0 rounded-3xl border border-[#ba7446]/25 bg-[#17181b] p-4 sm:p-7">
     <p className="text-xs font-bold uppercase tracking-widest text-[#e5a376]">Finalizar aquisição</p>
     <h2 className="mt-2 font-serif text-3xl font-bold">Escolha seu formato</h2>
     <div className="mt-5 grid grid-cols-3 gap-1.5 sm:gap-2" role="group" aria-label="Formato que deseja adquirir">
      {([['ebook','E-book'],['audiobook','Audiobook'],['combo','Combo']] as const)
       .filter(([key])=>key==='ebook'?ebook:key==='audiobook'?audiobook:ebook&&audiobook).map(([key,label])=>
       <button type="button" aria-pressed={format===key} key={key}
        className={card+' '+(key==='combo'?'academy-format-combo '+(format===key?'academy-format-combo-selected':''):format===key?'border-[#ed9e63] bg-[#4b3227]':'border-white/10 bg-[#17191d] hover:border-white/30')}
        onClick={()=>choose(key)}>
        <strong className="block text-[11px] sm:text-sm">{label}{key==='combo'&&format===key&&<span aria-hidden="true" className="ml-1 text-[#b2ffd5]">✓</span>}</strong>
        {price&&<span className={'mt-2 block whitespace-nowrap text-sm font-extrabold tabular-nums sm:text-lg '+(key==='combo'?'academy-combo-price text-[#b2ffd5]':'text-[#f1b586]')}>{money(key==='ebook'?price.ebook_cents:key==='audiobook'?price.audiobook_cents:price.combo_cents)}</span>}
        {key==='combo'&&savings&&<span className="mt-2 inline-block rounded-full bg-[#8cf0b5] px-1.5 py-0.5 text-[10px] font-extrabold text-[#102c1d]" aria-label={savings.percentage+'% de desconto'}>−{savings.percentage}%</span>}
       </button>)}
     </div>
     <div className="mt-4 flex items-center justify-between gap-3 border-t border-white/10 pt-3" aria-live="polite" aria-atomic="true">
      <span className="text-sm text-gray-400">Subtotal</span>
      <strong className="text-lg font-bold tabular-nums text-[#ffc59b]">{price?money(total):'—'}</strong>
     </div>
     {error&&<p role="alert" className="mt-4 rounded-xl border border-red-500/20 bg-red-900/20 px-4 py-3 text-xs text-red-200">{error}</p>}
     {!price?.checkout_enabled?<div className="mt-5 rounded-xl border border-amber-500/20 bg-amber-600/10 p-4 text-xs leading-6 text-amber-200">
      Os pagamentos desta obra estarão disponíveis em breve.
     </div>:isAuthenticated?<div className="mt-6 space-y-3">
      <p className="text-sm text-[#d6c6b8]">Comprando como <strong>{user?.email}</strong>.</p>
      <button type="button" disabled={sending||total<=0} onClick={()=>void checkout().catch(()=>undefined)}
       className="min-h-12 w-full rounded-xl bg-[#b96b3e] px-5 text-sm font-bold text-white disabled:opacity-50">
       {sending?'Gerando seu Pix...':'Efetuar pagamento via Pix →'}
      </button>
     </div>:<div className="mt-6">
      <h3 className="text-lg font-bold">Crie sua conta e pague</h3>
      <p className="mt-2 text-xs">Já tem conta? <Link to={authLink('/login',returnPath)} className="font-bold text-[#e9a87b] underline">Entrar para pagar</Link></p>
      <div className="mt-5 rounded-2xl border border-white/10 bg-[#101114] p-3 sm:p-5">
       <RegisterPage embedded nextOverride={returnPath}
        onPurchaseRegistration={async(result,email)=>await checkout({guest_user_id:result.userId,guest_email:email})}/>
      </div>
     </div>}
    </section>
   </div>}
 </main>
}
