import {useEffect,useState} from 'react'
import {Link,Navigate} from 'react-router-dom'
import {BrandImage} from '../../components/BrandImage'
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
 const formats=[
  ...(detail?.ebook_status?[{name:'E-book',detail:'PDF · leitura digital',available:detail.ebook_status==='published',icon:'▤'}]:[]),
  ...(detail?.audiobook_status?[{name:'Audiobook',detail:'MP3 · escute no seu ritmo',available:detail.audiobook_status==='published',icon:'♫'}]:[]),
 ]
 const audio=safePublicSample(detail?.sample_audio_url)
 const contact='mailto:contatosagamente@gmail.com?subject='+encodeURIComponent('Interesse na obra SAGA NEGRA · Release '+(detail?.release_code||''))+
  '&body='+encodeURIComponent('Olá! Quero saber como obter acesso ao e-book e/ou audiobook desta obra na Academia Sagamente.')
 return <main className="min-h-screen bg-[#0c0e10] text-[#f7eee4]">
  {preview&&<p className="border-b border-amber-500/30 bg-[#4e321f] px-4 py-3 text-center text-xs font-bold text-amber-100">PRÉVIA ADMINISTRATIVA · <Link to="/admin/academia" className="underline">Voltar ao painel</Link></p>}
  <header className="border-b border-white/10 bg-[#111215]/95 px-5 py-5">
   <div className="mx-auto flex max-w-6xl items-center justify-between gap-4">
    <Link to="/"><BrandImage variant="dark" alt="Sagamente" className="h-9 w-auto"/></Link>
    <nav className="flex gap-4 text-xs font-semibold text-[#dcab86]"><Link to="/academia">Todas as obras</Link><a href="#formatos">Formatos</a></nav>
   </div>
  </header>
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
       <a href="#amostras" className="inline-flex min-h-12 items-center justify-center rounded-xl bg-[#ae6337] px-6 text-sm font-bold text-white">Conhecer a obra</a>
       <a href={contact} className="inline-flex min-h-12 items-center justify-center rounded-xl border border-white/20 px-6 text-sm font-semibold">Solicitar acesso ↗</a>
      </div>
      <p className="mt-4 text-xs text-[#afa39c]">Apresentação pública gratuita. Para abrir os arquivos completos é necessária uma liberação na Academia.</p>
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
      <p className="mt-4 whitespace-pre-line font-serif text-base leading-8 text-[#eee0cf]">{detail.sample_text}</p>
     </div>}
     {audio&&<div className="rounded-2xl border border-white/10 bg-[#16191c] p-6">
      <p className="text-xs font-bold uppercase tracking-widest text-[#dca078]">Amostra do audiobook</p>
      <audio controls preload="none" className="mt-5 w-full" src={audio}>Seu navegador não suporta áudio.</audio>
      <p className="mt-3 text-xs text-gray-400">Prévia pública. Não inclui o arquivo completo.</p>
     </div>}
    </div>}
   </section>
   <section id="formatos" className="border-y border-white/10 bg-[#151719] px-5 py-14 sm:py-20">
    <div className="mx-auto max-w-5xl">
     <h2 className="font-serif text-3xl font-bold">Escolha como continuar</h2>
     <p className="mt-3 max-w-2xl text-sm leading-7 text-gray-400">A mesma obra em dois formatos. Consulte a disponibilidade antes de solicitar sua liberação. Não há pagamento ou acesso automático nesta página.</p>
     <div className="mt-7 grid gap-4 sm:grid-cols-2">{formats.map(format=><article key={format.name} className="rounded-2xl border border-white/10 bg-[#1e2023] p-6">
      <span className="text-3xl text-[#e2a574]">{format.icon}</span>
      <h3 className="mt-4 text-xl font-bold">{format.name}</h3>
      <p className="mt-2 text-sm text-gray-400">{format.detail}</p>
      <p className="mt-3 text-xs text-[#e8af7b]">{format.available?'Disponível mediante liberação':'Pré-lançamento / acesso beta'}</p>
      <a href={contact} className="mt-5 inline-flex min-h-11 items-center justify-center rounded-xl border border-[#a65a2a] px-5 text-xs font-bold text-[#f5bb8b]">Consultar disponibilidade ↗</a>
     </article>)}</div>
     {formats.length===2&&<p className="mt-5 rounded-xl border border-[#a65a2a]/25 bg-[#a65a2a]/10 p-4 text-sm text-gray-300">Você também pode solicitar os dois formatos juntos. O acesso é concedido individualmente à conta cadastrada.</p>}
    </div>
   </section>
   <section className="mx-auto max-w-4xl px-5 py-16 text-center">
    <h2 className="font-serif text-3xl font-bold">Sua próxima leitura começa aqui</h2>
    <p className="mx-auto mt-4 max-w-xl text-sm leading-7 text-gray-400">Explore a biblioteca da Academia Sagamente e conheça outras obras da coleção.</p>
    <div className="mt-7 flex flex-wrap justify-center gap-3">
     <Link to="/academia" className="inline-flex min-h-12 items-center rounded-xl bg-[#a65a2a] px-6 text-sm font-bold">Ver outras obras</Link>
     <Link to="/app/academia/biblioteca" className="inline-flex min-h-12 items-center rounded-xl border border-white/20 px-6 text-sm font-semibold">Minha biblioteca</Link>
    </div>
    <p className="mt-4 text-xs text-gray-500">A criação de conta é gratuita; o acesso integral depende de liberação.</p>
   </section>
  </>}
 </main>
}
