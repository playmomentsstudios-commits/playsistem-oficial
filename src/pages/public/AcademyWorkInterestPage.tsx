import {useEffect,useState,type FormEvent} from 'react'
import {Link,useParams,useSearchParams} from 'react-router-dom'
import {BrandImage} from '../../components/BrandImage'
import {supabase} from '../../lib/supabase'

type Format='ebook'|'audiobook'|'combo'
type Work={
 release_code:string;title:string;description:string|null;cover_url:string|null;
 landing_slug:string;ebook_status:string|null;audiobook_status:string|null;
}
const card='rounded-2xl border border-white/[.10] bg-[#17191d] p-4 text-left'
const input='min-h-12 w-full rounded-xl border border-white/15 bg-[#0c0d10] px-4 text-sm text-white outline-none focus:border-[#d68a58]'
export function AcademyWorkInterestPage(){
 const {release=''}=useParams()
 const [query,setQuery]=useSearchParams()
 const [work,setWork]=useState<Work|null>(null)
 const [loading,setLoading]=useState(true)
 const [error,setError]=useState('')
 const [sending,setSending]=useState(false)
 const [done,setDone]=useState(false)
 const [name,setName]=useState('')
 const [phone,setPhone]=useState('')
 const [email,setEmail]=useState('')
 const [consent,setConsent]=useState(false)
 const [website,setWebsite]=useState('')
 const selected=query.get('formato')
 const [format,setFormat]=useState<Format>(selected==='ebook'||selected==='audiobook'||selected==='combo'?selected:'combo')
 useEffect(()=>{
  let active=true
  setLoading(true)
  void (async()=>{
   try{
    const {data,error}=await supabase.rpc('academy_public_works')
    if(error)throw error
    const match=(data||[]).find((row:Work)=>row.release_code===release)
    if(active)setWork(match||null)
   }catch{if(active)setError('Não foi possível consultar esta obra. Tente novamente.')}
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
 function choose(option:Format){setFormat(option);setQuery({formato:option},{replace:true})}
 async function submit(event:FormEvent){
  event.preventDefault()
  if(!work||!consent)return
  try{
   setSending(true);setError('')
   const {error:failure}=await supabase.rpc('academy_submit_work_interest',{
    p_release_code:work.release_code,
    p_requested_format:format,
    p_contact_name:name.trim(),
    p_whatsapp:phone.trim(),
    p_contact_email:email.trim()||null,
    p_contact_consent:consent,
    p_utm_source:new URLSearchParams(window.location.search).get('utm_source')||null,
    p_utm_campaign:new URLSearchParams(window.location.search).get('utm_campaign')||null,
    p_website:website
   })
   if(failure)throw failure
   setDone(true)
  }catch(e){
   const message=e instanceof Error?e.message:'Não foi possível registrar seu interesse.'
   setError(message.includes('22023')||message.includes('invalid')?'Confira os dados e tente novamente.':message)
  }finally{setSending(false)}
 }
 return <main className="min-h-screen bg-[#0b0c10] text-[#f5e8da]">
  <header className="border-b border-white/10 px-5 py-5"><div className="mx-auto flex max-w-5xl items-center justify-between">
   <Link to="/academia" aria-label="Voltar para a Academia Sagamente"><BrandImage variant="dark" alt="Sagamente" className="h-9 w-auto"/></Link>
   <Link to="/academia#obras-digitais" className="text-xs font-semibold text-[#f0b98b]">← Todas as obras</Link>
  </div></header>
  {loading?<div role="status" className="mx-auto max-w-4xl px-5 py-20 text-sm text-gray-400">Carregando sua obra...</div>:
   !work?<div className="mx-auto max-w-4xl px-5 py-20"><h1 className="text-2xl font-bold">Obra indisponível</h1><p role="alert" className="mt-3 text-sm text-gray-400">{error||'Não foi possível localizar esta obra.'}</p><Link to="/academia" className="mt-5 inline-block text-[#e9a77a] underline">Voltar à Academia</Link></div>:
   <div className="mx-auto grid max-w-5xl gap-8 px-5 py-12 md:grid-cols-[.8fr_1.2fr] md:py-20">
    <aside className="space-y-4">
     <p className="text-xs font-bold uppercase tracking-[.19em] text-[#dd9c68]">SAGA NEGRA · Release {work.release_code}</p>
     <h1 className="font-serif text-3xl font-bold leading-tight sm:text-4xl">{work.title}</h1>
     <p className="text-sm leading-7 text-gray-400">{work.description||'Conheça a obra em formato digital.'}</p>
     {work.cover_url&&<img src={work.cover_url} alt={'Capa de '+work.title} className="mx-auto max-h-64 w-auto rounded-xl object-cover"/>}
     <Link to={'/l/'+encodeURIComponent(work.landing_slug)} className="inline-flex min-h-11 items-center text-xs font-semibold text-[#e9a77a] underline">← Voltar à apresentação da obra</Link>
    </aside>
    <section className="rounded-3xl border border-[#ba7446]/25 bg-[#17181b] p-5 sm:p-8">
     {done?<div role="status" className="space-y-5">
      <span className="text-4xl text-[#e5a376]">✓</span>
      <h2 className="font-serif text-3xl font-bold">Recebemos seu interesse!</h2>
      <p className="text-sm leading-7 text-[#ccbeb1]">Você escolheu <strong>{format==='combo'?'o combo e-book + audiobook':format==='ebook'?'o e-book':'o audiobook'}</strong>. Nossa equipe pode entrar em contato pelo WhatsApp informado para apresentar as condições de compra. Nenhum pagamento foi cobrado.</p>
      <Link className="inline-flex min-h-11 items-center rounded-xl bg-[#b86d40] px-5 text-sm font-bold" to="/academia">Explorar outras obras</Link>
     </div>:<>
      <p className="text-xs font-bold uppercase tracking-widest text-[#e5a376]">Quero adquirir</p>
      <h2 className="mt-2 font-serif text-3xl font-bold">Qual formato você prefere?</h2>
      <div className="mt-6 grid gap-2 sm:grid-cols-3" role="group" aria-label="Formato que deseja adquirir">
       {([['ebook','E-book','Ler'],['audiobook','Audiobook','Ouvir'],['combo','Combo','Ler + ouvir']] as const).filter(([key])=>key==='ebook'?ebook:key==='audiobook'?audiobook:ebook&&audiobook).map(([key,label,detail])=>
        <button type="button" aria-pressed={format===key} key={key} className={card+' '+(format===key?'border-[#ed9e63] bg-[#4b3227]':'hover:border-white/30')} onClick={()=>choose(key)}>
         <strong className="block text-sm">{label}</strong><span className="mt-1 block text-xs text-gray-400">{detail}</span>
        </button>)}
      </div>
      <p className="mt-5 text-xs leading-6 text-gray-400">Deixe seu contato e receba as informações para concluir a compra. Você não precisa criar uma conta agora.</p>
      <form className="mt-5 space-y-4" onSubmit={event=>void submit(event)}>
       <label className="block text-xs font-semibold text-gray-300">Seu nome *
        <input className={input+' mt-2'} autoComplete="name" required minLength={2} maxLength={120} value={name} onChange={e=>setName(e.target.value)} placeholder="Como podemos chamar você?"/>
       </label>
       <label className="block text-xs font-semibold text-gray-300">WhatsApp com DDD *
        <input className={input+' mt-2'} type="tel" autoComplete="tel" required minLength={10} maxLength={22} inputMode="tel" value={phone} onChange={e=>setPhone(e.target.value)} placeholder="(62) 99999-9999"/>
       </label>
       <label className="block text-xs font-semibold text-gray-300">E-mail (opcional)
        <input className={input+' mt-2'} type="email" autoComplete="email" maxLength={160} value={email} onChange={e=>setEmail(e.target.value)} placeholder="voce@exemplo.com"/>
       </label>
       <label className="hidden" aria-hidden="true">Deixe este campo vazio
        <input tabIndex={-1} autoComplete="off" value={website} onChange={e=>setWebsite(e.target.value)}/>
       </label>
       <label className="flex items-start gap-3 text-xs leading-6 text-gray-300">
        <input type="checkbox" required checked={consent} onChange={e=>setConsent(e.target.checked)} className="mt-1 h-4 w-4 accent-[#ca7e4c]"/>
        <span>Autorizo a Sagamente a usar meu nome, WhatsApp e e-mail (se informado) para responder a este pedido sobre a obra. Isso não é inscrição em mensagens promocionais.</span>
       </label>
       {error&&<p role="alert" className="rounded-xl border border-red-500/20 bg-red-900/20 px-4 py-3 text-xs text-red-200">{error}</p>}
       <button type="submit" disabled={sending||!consent} className="min-h-12 w-full rounded-xl bg-[#bd6f41] px-5 text-sm font-bold text-white disabled:opacity-45">
        {sending?'Enviando seu interesse...':'Quero receber as condições →'}
       </button>
      </form>
      <p className="mt-3 text-[11px] leading-5 text-gray-500">Seu interesse será encaminhado à equipe comercial. Este formulário não processa pagamentos nem libera o conteúdo completo.</p>
     </>}
    </section>
   </div>}
 </main>
}
