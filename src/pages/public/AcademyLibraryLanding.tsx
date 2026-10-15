import {useEffect,useState} from 'react'
import {Link,Navigate} from 'react-router-dom'
import {AcademyWorkHeader,AcademyWorkOffers,workInterestUrl} from '../../components/academy/AcademyWorkSales'
import {supabase} from '../../lib/supabase'
import type {SiteLandingPage} from '../../services/siteContent'

type WorkPresentation={
 release_code:string;title:string;description:string|null;author_name:string|null;
 cover_url:string|null;banner_url:string|null;canonical_slug:string;
 ebook_status:string|null;audiobook_status:string|null;
 sample_text:string|null;sample_audio_url:string|null;
}
const safePublicSample=(raw:string|null|undefined)=>{
 if(!raw||!/^https:\/\//i.test(raw))return ''
 try{
  const parsed=new URL(raw)
  if(!/^https:$/.test(parsed.protocol)||/(^|\.)(drive\.google\.com|googleusercontent\.com)$/.test(parsed.hostname)||parsed.pathname.includes('/academy-library-media'))return ''
  return parsed.toString()
 }catch{return ''}
}

export function AcademyLibraryLanding({page,preview=false}:{page:SiteLandingPage;preview?:boolean}){
 const [detail,setDetail]=useState<WorkPresentation|null>(null)
 const [loading,setLoading]=useState(true)
 useEffect(()=>{
  let mounted=true
  setLoading(true)
  void (async()=>{
   try{
    const {data,error}=await supabase.rpc('academy_public_work_landing',{p_slug:page.slug})
    if(mounted)setDetail(!error&&Array.isArray(data)?data[0]||null:null)
   }catch{if(mounted)setDetail(null)}
   finally{if(mounted)setLoading(false)}
  })()
  return()=>{mounted=false}
 },[page.slug])
 if(!preview&&detail?.canonical_slug&&detail.canonical_slug!==page.slug)
  return <Navigate to={'/l/'+encodeURIComponent(detail.canonical_slug)} replace/>
 const audio=safePublicSample(detail?.sample_audio_url)
 const benefits=page.sections.find(section=>section.type==='benefits')?.items||[]
 const topics=page.sections.find(section=>section.type==='content')?.items||[]
 const faqs=page.sections.find(section=>section.type==='faq')?.items||[]
 const sampleParts=(detail?.sample_text||'').split(/\n\s*\n/).map(x=>x.trim()).filter(Boolean)
 return <main className="min-h-screen bg-[#0c0e10] text-[#f7eee4]">
  {preview&&<p className="border-b border-amber-500/30 bg-[#4e321f] px-4 py-3 text-center text-xs font-bold text-amber-100">PRÉVIA ADMINISTRATIVA · <Link to="/admin/academia" className="underline">Voltar ao painel</Link></p>}
  {detail&&<AcademyWorkHeader release={detail.release_code}/>}
  {loading?<p role="status" className="mx-auto max-w-6xl px-5 py-16 text-sm text-gray-400">Carregando apresentação...</p>:
  !detail?<section className="mx-auto max-w-6xl px-5 py-20"><h1 className="text-2xl font-bold">Apresentação indisponível</h1><p className="mt-3 text-sm text-gray-400">Esta obra não foi publicada ou está temporariamente indisponível.</p></section>:
  <>
   <section className="relative overflow-hidden border-b border-white/10 px-5 py-14 sm:py-20">
    <div className="pointer-events-none absolute inset-0 opacity-30" aria-hidden="true" style={detail.banner_url?{backgroundImage:`linear-gradient(90deg,#0c0e10,#0c0e10b8),url("${detail.banner_url}")`,backgroundPosition:'center',backgroundSize:'cover'}:{background:'radial-gradient(circle at 77% 24%,#a65a2a,transparent 68%)'}}/>
    <div className="relative mx-auto grid max-w-6xl gap-10 md:grid-cols-[1.3fr_.7fr] md:items-center">
     <div>
      <p className="text-xs font-bold uppercase tracking-[.2em] text-[#e4ac7c]">SAGA NEGRA · Obra {detail.release_code}</p>
      <h1 className="mt-4 max-w-3xl font-serif text-4xl font-bold leading-tight sm:text-5xl">{page.headline||detail.title}</h1>
      <p className="mt-5 max-w-2xl text-sm leading-8 text-[#d3c5b7] sm:text-base">{page.subheadline||detail.description||'Conheça esta obra da Academia Sagamente.'}</p>
      {detail.author_name&&<p className="mt-3 text-sm text-[#d5a47e]">Por {detail.author_name}</p>}
      <div className="mt-7 flex flex-wrap gap-3">
       <Link to={workInterestUrl(detail.release_code)} className="inline-flex min-h-12 items-center justify-center rounded-xl bg-[#ae6337] px-6 text-sm font-bold text-white">Quero adquirir →</Link>
       <a href="#amostras" className="inline-flex min-h-12 items-center justify-center rounded-xl border border-white/20 px-6 text-sm font-semibold">Conhecer a prévia</a>
      </div>
      <p className="mt-4 text-xs text-[#afa39c]">A apresentação é gratuita. Escolha seu formato e receba orientações para concluir a compra.</p>
     </div>
     <div className="mx-auto w-full max-w-[310px] overflow-hidden rounded-2xl border border-white/15 bg-gradient-to-br from-[#4b2a25] via-[#9a502f] to-[#1c1d20] shadow-2xl">
      {detail.cover_url?<img src={detail.cover_url} alt={'Capa da obra '+detail.title} className="aspect-[3/4] w-full object-cover"/>:
      <div className="flex aspect-[3/4] flex-col items-center justify-center text-center font-serif text-4xl font-bold text-white"><span>SAGA</span><span>NEGRA</span><span className="mt-6 text-xl text-[#ffd9b7]">Release {detail.release_code}</span></div>}
     </div>
    </div>
   </section>
   <section id="amostras" className="mx-auto max-w-5xl px-5 py-14 sm:py-20">
    <h2 className="font-serif text-3xl font-bold">Sobre a obra</h2>
    <p className="mt-5 whitespace-pre-line text-sm leading-8 text-[#cbbdb2]">{detail.description||page.subheadline||detail.title}</p>
    {(detail.sample_text||audio)&&<div className="mt-8 grid gap-4 md:grid-cols-2">
     {detail.sample_text&&<div className="rounded-2xl border border-white/10 bg-[#16191c] p-6">
      <p className="text-xs font-bold uppercase tracking-widest text-[#dca078]">Amostra do e-book</p>
      <p className="mt-4 whitespace-pre-line font-serif text-base leading-8 text-[#eee0cf]">{sampleParts[0]}</p>
      {sampleParts.length>1&&<details className="group mt-4 border-t border-white/10 pt-4">
       <summary className="cursor-pointer text-xs font-bold text-[#efb78b]">Continuar lendo a amostra <span aria-hidden="true" className="inline-block transition-transform group-open:rotate-180">⌄</span></summary>
       <div className="mt-4 space-y-4 font-serif text-base leading-8 text-[#eee0cf]">{sampleParts.slice(1).map((paragraph,i)=><p key={i}>{paragraph}</p>)}</div>
      </details>}
     </div>}
     {audio&&<div className="rounded-2xl border border-white/10 bg-[#16191c] p-6">
      <p className="text-xs font-bold uppercase tracking-widest text-[#dca078]">Amostra do audiobook</p>
      <audio controls preload="none" className="mt-5 w-full" src={audio}>Seu navegador não suporta áudio.</audio>
      <p className="mt-3 text-xs text-gray-400">Prévia pública. Não inclui o arquivo completo.</p>
     </div>}
    </div>}
   </section>
   {benefits.length>0&&<section id="temas" className="border-y border-white/10 bg-[#141619] px-5 py-16 sm:py-20">
    <div className="mx-auto max-w-6xl">
     <p className="text-xs font-bold uppercase tracking-widest text-[#dba276]">O que você encontrará</p>
     <h2 className="mt-3 max-w-3xl font-serif text-3xl font-semibold sm:text-4xl">{page.sections.find(section=>section.type==='benefits')?.title||'Uma obra para olhar além do óbvio'}</h2>
     <div className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">{benefits.map((item,i)=>
      <article key={i} className="rounded-2xl border border-white/10 bg-[#1b1d20] p-6">
       <span className="font-serif text-3xl text-[#cb8e61]">{String(i+1).padStart(2,'0')}</span>
       <h3 className="mt-3 text-base font-bold text-[#fae9d7]">{item.title}</h3>
       <p className="mt-3 text-sm leading-7 text-[#bcb0a5]">{item.description}</p>
      </article>)}</div>
    </div>
   </section>}
   {topics.length>0&&<section className="mx-auto max-w-6xl px-5 py-16 sm:py-20">
    <h2 className="font-serif text-3xl font-semibold">{page.sections.find(section=>section.type==='content')?.title||'O percurso da obra'}</h2>
    <div className="mt-7 grid gap-3 sm:grid-cols-2">{topics.map((topic,i)=>
     <article key={i} className="flex items-start gap-4 rounded-xl border border-white/10 bg-[#16181b] p-5">
      <span className="font-serif text-2xl text-[#d39970]">{String(i+1).padStart(2,'0')}</span>
      <div><h3 className="font-bold">{topic.title}</h3><p className="mt-2 text-sm leading-6 text-gray-400">{topic.description}</p></div>
     </article>)}</div>
   </section>}
   <AcademyWorkOffers release={detail.release_code} ebook={Boolean(detail.ebook_status)} audiobook={Boolean(detail.audiobook_status)}/>
   {faqs.length>0&&<section className="mx-auto max-w-4xl px-5 py-16 sm:py-20">
    <p className="text-xs font-bold uppercase tracking-widest text-[#cf956b]">Dúvidas frequentes</p>
    <h2 className="mt-3 font-serif text-3xl font-semibold">Antes de escolher</h2>
    <div className="mt-8 space-y-3">{faqs.map((item,i)=><details key={i} className="rounded-xl border border-white/10 bg-[#17191c] p-5">
     <summary className="cursor-pointer text-sm font-bold">{item.title}</summary>
     {item.description&&<p className="mt-3 text-sm leading-7 text-[#bcb2a8]">{item.description}</p>}
    </details>)}</div>
   </section>}
   <section className="mx-auto max-w-4xl px-5 py-16 text-center">
    <h2 className="font-serif text-3xl font-bold">Sua próxima leitura começa aqui</h2>
    <p className="mx-auto mt-4 max-w-xl text-sm leading-7 text-gray-400">Explore a biblioteca da Academia Sagamente e conheça outras obras da coleção.</p>
    <div className="mt-7 flex flex-wrap justify-center gap-3">
     <Link to="/academia" className="inline-flex min-h-12 items-center rounded-xl bg-[#a65a2a] px-6 text-sm font-bold">Ver outras obras</Link>
     <Link to="/app/academia/biblioteca" className="inline-flex min-h-12 items-center rounded-xl border border-white/20 px-6 text-sm font-semibold">Minha biblioteca</Link>
    </div>
    <p className="mt-4 text-xs text-gray-500">Depois da compra confirmada, a equipe orienta a liberação dos formatos na sua conta.</p>
   </section>
  </>}
 </main>
}
