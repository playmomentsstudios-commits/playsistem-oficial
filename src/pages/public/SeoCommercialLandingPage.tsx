import { Link, useLocation } from 'react-router-dom'
import { PublicLayout } from '../../layouts/PublicLayout'
import { trackConversion } from '../../lib/analytics'
import data from '../../data/seoCommercialLandings.json'

type LandingOffer={slug:string;name:string;text:string}
type LandingFaq={question:string;answer:string}
type LandingConfig={
 path:string;area:string;title:string;description:string;primaryKeyword:string;
 heading:string;intro:string;benefits:string[];fitTitle:string;fitText:string;
 offers:LandingOffer[];steps:string[];faq:LandingFaq[]
}
const landings=data as Record<string,LandingConfig>

function tracked(landing:string,service?:string){
 trackConversion('service_interest',{
  source:'seo_commercial_landing',
  landing_path:landing,
  ...(service?{service_slug:service}:{action:'custom_quote'})
 })
}
export function SeoCommercialLandingPage(){
 const {pathname}=useLocation()
 const page=landings[pathname]
 if(!page) return <PublicLayout><section className="mx-auto max-w-3xl px-5 py-20 text-center">
  <h1 className="text-2xl font-bold text-white">Solução não encontrada</h1>
  <Link to="/servicos" className="inline-flex min-h-11 items-center mt-5 text-[#DFA269] underline">Ver todas as soluções</Link>
 </section></PublicLayout>

 return <PublicLayout>
  <article className="pb-20">
   <section className="relative isolate overflow-hidden border-b border-white/10">
    <div aria-hidden="true" className="absolute inset-0 -z-10" style={{background:'radial-gradient(ellipse at 80% 12%, rgba(166,90,42,.23), transparent 58%),linear-gradient(120deg,#141416,#0b0b0d 70%)'}}/>
    <div className="mx-auto max-w-6xl px-5 py-12 sm:py-20">
     <nav aria-label="Caminho da página" className="flex flex-wrap gap-2 text-xs text-gray-400">
      <Link to="/" className="hover:text-white">Início</Link><span aria-hidden="true">›</span>
      <Link to="/servicos" className="hover:text-white">Serviços</Link><span aria-hidden="true">›</span><span className="text-[#DFA269]">{page.area}</span>
     </nav>
     <div className="max-w-4xl mt-9">
      <p className="text-xs tracking-[.19em] uppercase font-semibold text-[#DFA269]">Soluções Sagamente · {page.area}</p>
      <h1 className="mt-4 text-3xl sm:text-5xl md:text-[3.6rem] font-bold text-white leading-[1.09] tracking-tight">{page.heading}</h1>
      <p className="mt-6 text-base sm:text-lg text-gray-300 leading-relaxed max-w-3xl">{page.intro}</p>
      <div className="mt-7 flex flex-wrap gap-3">
       <a href="#solucoes" className="inline-flex items-center justify-center min-h-12 px-6 rounded-xl bg-[#A65A2A] text-white font-semibold text-sm hover:bg-[#BD6A36]">Conhecer opções e contratar <span className="ml-2">↓</span></a>
       <Link to="/contato" onClick={()=>tracked(page.path)} className="inline-flex items-center justify-center min-h-12 px-6 rounded-xl border border-white/20 bg-white/5 text-sm font-semibold text-white hover:bg-white/10">Solicitar orçamento personalizado ↗</Link>
      </div>
     </div>
    </div>
   </section>

   <section className="mx-auto max-w-6xl px-5 py-12 sm:py-16" aria-labelledby="vantagens-titulo">
    <p className="text-xs uppercase tracking-widest text-[#DFA269]">Entenda a solução</p>
    <h2 id="vantagens-titulo" className="font-bold text-2xl sm:text-3xl text-white mt-2">O que considerar antes de contratar</h2>
    <div className="grid md:grid-cols-3 gap-4 mt-6">
     {page.benefits.map((benefit,i)=><div key={i} className="rounded-2xl p-5 border border-white/10 bg-[#151518]">
      <span className="text-[#DFA269] text-sm font-bold">0{i+1}</span>
      <p className="text-sm text-gray-200 leading-relaxed mt-3">{benefit}</p>
     </div>)}
    </div>
    <div className="mt-7 border-l-2 border-[#A65A2A] pl-5">
     <h3 className="text-lg font-semibold text-white">{page.fitTitle}</h3>
     <p className="mt-2 text-sm leading-relaxed text-gray-400 max-w-4xl">{page.fitText}</p>
    </div>
   </section>

   <section id="solucoes" className="border-y border-white/10 bg-[#101012] scroll-mt-20">
    <div className="max-w-6xl mx-auto px-5 py-12 sm:py-16">
     <p className="text-xs uppercase tracking-widest text-[#DFA269]">Serviços disponíveis</p>
     <h2 className="text-2xl sm:text-3xl font-bold text-white mt-2">Escolha uma oferta do catálogo</h2>
     <p className="mt-3 max-w-3xl text-sm text-gray-400 leading-relaxed">As opções abaixo correspondem a serviços publicados. Consulte cada página para confirmar entregáveis, condições e valores atualizados.</p>
     <div className="mt-7 grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
      {page.offers.map(offer=><Link to={'/servicos/'+offer.slug} key={offer.slug} onClick={()=>tracked(page.path,offer.slug)}
       className="group flex flex-col min-h-[210px] p-5 rounded-2xl border border-white/10 bg-[#19191b] hover:border-[#A65A2A]/70 hover:-translate-y-1 transition-all">
       <p className="text-xs font-semibold tracking-widest text-[#DFA269] uppercase">Serviço</p>
       <h3 className="mt-3 text-lg font-bold text-white">{offer.name}</h3>
       <p className="mt-2 text-sm text-gray-400 leading-relaxed flex-1">{offer.text}</p>
       <span className="mt-6 text-xs font-semibold text-[#E1AF88] group-hover:text-white">Ver escopo e contratar <span aria-hidden="true">↗</span></span>
      </Link>)}
     </div>
    </div>
   </section>

   <section className="max-w-6xl mx-auto px-5 py-12 sm:py-16">
    <h2 className="text-2xl sm:text-3xl font-bold text-white">Como começar seu projeto</h2>
    <ol className="mt-6 grid md:grid-cols-3 gap-4">
     {page.steps.map((step,i)=><li key={step} className="rounded-2xl bg-[#151518] border border-white/10 p-5">
      <span className="text-2xl font-bold text-[#DFA269]">{i+1}</span>
      <p className="text-sm text-gray-200 leading-relaxed mt-3">{step}</p>
     </li>)}
    </ol>
   </section>

   <section className="max-w-6xl mx-auto px-5 pb-12 sm:pb-16">
    <h2 className="text-2xl sm:text-3xl font-bold text-white">Dúvidas frequentes</h2>
    <div className="mt-5 space-y-3 max-w-4xl">
     {page.faq.map(row=><details key={row.question} className="group rounded-xl border border-white/10 bg-[#151518] p-4 sm:p-5">
      <summary className="text-sm font-semibold text-white cursor-pointer select-none">{row.question}</summary>
      <p className="mt-3 text-sm text-gray-400 leading-relaxed">{row.answer}</p>
     </details>)}
    </div>
   </section>

   <section className="max-w-6xl mx-auto px-5">
    <div className="rounded-3xl border border-[#A65A2A]/30 p-6 sm:p-10 flex flex-col sm:flex-row sm:items-center gap-5" style={{background:'linear-gradient(110deg,rgba(166,90,42,.16),#151518)'}}>
     <div className="flex-1">
      <h2 className="text-2xl font-bold text-white">Sua necessidade não cabe em um pacote pronto?</h2>
      <p className="mt-2 text-sm leading-relaxed text-gray-300">Descreva o objetivo e descubra qual solução atende melhor ao seu projeto, sem compromisso de escolher uma opção antes de conversar.</p>
     </div>
     <Link to="/contato" onClick={()=>tracked(page.path)} className="min-h-12 shrink-0 inline-flex items-center justify-center px-6 rounded-xl bg-[#A65A2A] text-white font-semibold text-sm">Conversar sobre meu projeto ↗</Link>
    </div>
   </section>
  </article>
 </PublicLayout>
}
