import {useEffect,useState} from 'react'
import {Link} from 'react-router-dom'
import {BrandImage} from '../../components/BrandImage'
import {supabase} from '../../lib/supabase'
import type {SiteLandingPage} from '../../services/siteContent'

type PublicDetail={
 title:string;format:'ebook'|'audiobook';description:string|null;
 author_name:string|null;cover_url:string|null;sample_text:string|null;sample_audio_url:string|null;
}
export function AcademyLibraryLanding({page,preview=false}:{page:SiteLandingPage;preview?:boolean}){
 const [detail,setDetail]=useState<PublicDetail|null>(null)
 const [loading,setLoading]=useState(true)
 useEffect(()=>{
  let mounted=true
  setLoading(true)
  void supabase.rpc('academy_public_library_landing',{p_slug:page.slug}).then(({data,error})=>{
   if(mounted)setDetail(!error&&Array.isArray(data)?data[0]||null:null)
  }).finally(()=>{if(mounted)setLoading(false)})
  return ()=>{mounted=false}
 },[page.slug])
 const format=detail?.format==='audiobook'?'Audiobook':'E-book'
 const audio=detail?.sample_audio_url||''
 const playAudio=/^https:\/\//i.test(audio)&&!/(drive\.google\.com|googleusercontent\.com|\/academy-library-media)/i.test(audio)
 return <main className="min-h-screen bg-[#0d0f11] text-[#f6f0e8]">
  {preview&&<p className="bg-amber-900 px-4 py-3 text-center text-xs font-bold text-amber-100">PRÉVIA ADMINISTRATIVA · Página não publicada. <Link to="/admin/academia" className="underline">Voltar</Link></p>}
  <header className="border-b border-white/10 px-5 py-5">
   <div className="mx-auto flex max-w-6xl items-center justify-between gap-3">
    <Link to="/"><BrandImage variant="dark" alt="Sagamente" className="h-8 w-auto"/></Link>
    <Link to="/academia" className="text-xs font-semibold text-[#E4B185]">Conhecer Academia →</Link>
   </div>
  </header>
  {loading?<p role="status" className="mx-auto max-w-6xl px-5 py-16 text-sm text-gray-400">Carregando apresentação...</p>:
   !detail?<section className="mx-auto max-w-6xl px-5 py-20"><h1 className="text-2xl font-bold">Apresentação indisponível</h1><p className="mt-3 text-gray-400">Este conteúdo ainda não está publicado ou não foi encontrado.</p></section>:
   <>
    <section className="relative overflow-hidden border-b border-white/10 px-5 py-14 sm:py-20">
     <div className="pointer-events-none absolute inset-0 opacity-25" aria-hidden="true" style={page.hero_image_url?{backgroundImage:`linear-gradient(90deg,#0d0f11,#0d0f11ba),url("${page.hero_image_url}")`,backgroundPosition:'center',backgroundSize:'cover'}:{background:'radial-gradient(circle at 80% 10%,#9c5528,transparent 70%)'}}/>
     <div className="relative mx-auto grid max-w-6xl gap-9 md:grid-cols-[1.2fr_.8fr] md:items-center">
      <div>
       <p className="text-xs font-bold uppercase tracking-[.22em] text-[#E2A977]">Academia Sagamente · {format}</p>
       <h1 className="mt-4 text-4xl font-extrabold leading-tight sm:text-5xl">{page.headline||detail.title}</h1>
       <p className="mt-5 max-w-xl text-sm leading-7 text-gray-300 sm:text-base">{page.subheadline||detail.description||'Conheça este conteúdo da biblioteca digital Sagamente.'}</p>
       {detail.author_name&&<p className="mt-3 text-xs text-gray-400">Por {detail.author_name}</p>}
       <div className="mt-7 flex flex-wrap gap-3">
        <Link to="/academia" className="inline-flex min-h-12 items-center justify-center rounded-xl bg-[#A65A2A] px-6 text-sm font-bold">Conhecer a Academia</Link>
        <Link to="/cadastro?next=%2Fapp%2Facademia" className="inline-flex min-h-12 items-center justify-center rounded-xl border border-white/20 px-6 text-sm font-semibold">Criar minha conta</Link>
       </div>
       <p className="mt-4 text-[11px] leading-5 text-gray-400">A criação de conta é gratuita. O acesso ao conteúdo completo depende de liberação.</p>
      </div>
      <div className="mx-auto w-full max-w-[350px] overflow-hidden rounded-2xl border border-white/10 bg-[#18191c] shadow-xl">
       {detail.cover_url?<img src={detail.cover_url} alt={'Capa de '+detail.title} className="aspect-[4/5] w-full object-cover"/>:
        <div className="flex aspect-[4/5] items-center justify-center text-7xl text-[#D28C5A]">{format==='E-book'?'▤':'♫'}</div>}
      </div>
     </div>
    </section>
    <section className="mx-auto max-w-5xl px-5 py-16">
     <h2 className="text-2xl font-bold">Sobre a obra</h2>
     <p className="mt-4 whitespace-pre-line text-sm leading-8 text-gray-300">{detail.description||page.subheadline||'Conteúdo digital da Academia Sagamente.'}</p>
     {detail.format==='ebook'&&detail.sample_text&&<div className="mt-8 rounded-2xl border border-[#E2A977]/20 bg-[#181a1d] p-6">
       <h3 className="text-lg font-bold text-[#E2A977]">Uma amostra da leitura</h3>
       <p className="mt-4 whitespace-pre-line font-serif text-base leading-8 text-gray-200">{detail.sample_text}</p>
       <p className="mt-4 text-[11px] text-gray-500">Trecho público de apresentação. O livro completo está disponível apenas a usuários com acesso.</p>
      </div>}
     {detail.format==='audiobook'&&playAudio&&<div className="mt-8 rounded-2xl border border-[#E2A977]/20 bg-[#181a1d] p-6">
       <h3 className="text-lg font-bold text-[#E2A977]">Escute uma amostra</h3>
       <audio controls preload="none" className="mt-5 w-full" src={audio}>Seu navegador não suporta áudio.</audio>
       <p className="mt-4 text-[11px] text-gray-500">Somente a demonstração pública; o arquivo completo permanece protegido no Drive.</p>
      </div>}
    </section>
    <section className="border-t border-white/10 bg-[#131517] px-5 py-16 text-center">
     <h2 className="text-2xl font-bold">Continue sua jornada na Sagamente</h2>
     <p className="mx-auto mt-3 max-w-lg text-sm leading-7 text-gray-400">Explore nossos livros, áudios, cursos e treinamentos. Solicite o acesso a conteúdos exclusivos.</p>
     <Link to="/academia" className="mt-6 inline-flex min-h-12 items-center rounded-xl bg-[#A65A2A] px-7 text-sm font-bold">Explorar conteúdos →</Link>
    </section>
   </>}
 </main>
}
