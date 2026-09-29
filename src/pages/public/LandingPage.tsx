import { useEffect,useState } from 'react'
import { Link,useParams } from 'react-router-dom'
import { siteContentApi,type SiteLandingPage,type LandingSection } from '../../services/siteContent'
import { useSeo } from '../../lib/seo'
import logoUrl from '../../assets/logo-play-moments.png'

function Section({section,ctaHref,ctaLabel}:{section:LandingSection;ctaHref:string;ctaLabel:string}){
 if(section.type==='cta')return <section className="px-5 py-16 sm:py-24"><div className="max-w-4xl mx-auto rounded-3xl border border-[#E30613]/25 bg-gradient-to-br from-[#E30613]/15 to-[#141416] p-7 sm:p-12 text-center"><h2 className="text-3xl sm:text-4xl font-extrabold">{section.title}</h2>{section.text&&<p className="text-gray-300 mt-4 max-w-2xl mx-auto">{section.text}</p>}<a href={ctaHref} className="mt-7 min-h-12 px-7 rounded-xl bg-[#E30613] text-white font-bold inline-flex items-center justify-center">{ctaLabel}</a></div></section>
 const isProof=section.type==='proof',isFaq=section.type==='faq'
 return <section className="px-5 py-12 sm:py-16 border-t border-white/[.05]"><div className="max-w-5xl mx-auto">{section.title&&<h2 className="text-2xl sm:text-3xl font-bold text-center">{section.title}</h2>}{section.text&&<p className="text-gray-400 leading-7 mt-3 max-w-3xl mx-auto text-center">{section.text}</p>}{section.items&&<div className={(isFaq?'max-w-3xl mx-auto ':'grid sm:grid-cols-2 '+(isProof?'lg:grid-cols-3 ':'lg:grid-cols-3 '))+'gap-4 mt-7'}>{section.items.map((item,i)=>isFaq?<details key={i} className="group rounded-2xl bg-[#141416] border border-white/10 p-5 mb-3"><summary className="font-semibold cursor-pointer list-none flex justify-between gap-3">{item.title}<span className="text-[#E30613] group-open:rotate-45 transition-transform">＋</span></summary>{item.description&&<p className="text-sm text-gray-400 leading-6 mt-3">{item.description}</p>}</details>:<div key={i} className={'p-5 rounded-2xl border '+(isProof?'bg-[#E30613]/[.045] border-[#E30613]/15':'bg-[#141416] border-white/10')}><div className={isProof?'text-[#E30613] text-lg':'text-[#E30613] text-sm'}>{isProof?'★':'✓'}</div><h3 className="font-semibold mt-2">{item.title}</h3>{item.description&&<p className="text-sm text-gray-400 leading-6 mt-2">{item.description}</p>}</div>)}</div>}</div></section>
}

export function LandingPage(){
 const {slug=''}=useParams(),[page,setPage]=useState<SiteLandingPage|null>(null),[loading,setLoading]=useState(true)
 useEffect(()=>{let active=true;siteContentApi.landingPage(slug).then(p=>{if(active)setPage(p)}).catch(()=>setPage(null)).finally(()=>setLoading(false));return()=>{active=false}},[slug])
 useSeo({title:page?.seo_title||page?.title||'Campanha',description:page?.seo_description||page?.subheadline||'Conheça esta solução da Play Moments.',image:page?.hero_image_url,canonicalPath:'/l/'+slug,canonicalUrl:page?.canonical_url,noindex:Boolean(page?.noindex)||(!loading&&!page)})
 if(loading)return <main className="min-h-screen bg-[#0a0a0b] text-white flex items-center justify-center text-gray-400">Carregando...</main>
 if(!page)return <main className="min-h-screen bg-[#0a0a0b] text-white flex flex-col items-center justify-center px-5 text-center"><h1 className="text-3xl font-bold">Página não encontrada</h1><p className="text-gray-400 mt-3">Esta campanha pode ter sido encerrada ou o endereço está incorreto.</p><Link to="/" className="mt-6 px-5 py-3 rounded-xl bg-[#E30613] font-semibold">Voltar para a Play Moments</Link></main>
 return <main className="min-h-screen bg-[#0a0a0b] text-[#f0f0f2]">
  <header className="h-16 px-5 border-b border-white/[.06] flex items-center"><div className="max-w-6xl mx-auto w-full flex items-center justify-between gap-4"><img src={logoUrl} alt="Play Moments" className="h-9 w-auto"/><a href={page.cta_href} className="min-h-10 px-4 rounded-xl bg-[#E30613] text-white text-xs font-bold inline-flex items-center">{page.cta_label}</a></div></header>
  <article>
   <section className="px-5 py-14 sm:py-24"><div className="max-w-6xl mx-auto grid lg:grid-cols-2 gap-10 lg:gap-14 items-center">
    <div><p className="text-xs uppercase tracking-[.2em] font-bold text-[#E30613]">{page.eyebrow||'Play Moments'}</p><h1 className="text-4xl sm:text-6xl font-extrabold leading-[1.03] mt-4">{page.headline}</h1>{page.subheadline&&<p className="text-lg text-gray-400 mt-5 leading-8">{page.subheadline}</p>}<div className="flex flex-wrap gap-3 mt-7"><a href={page.cta_href} className="min-h-12 px-6 rounded-xl bg-[#E30613] text-white font-bold inline-flex items-center justify-center shadow-lg shadow-red-950/20">{page.cta_label}</a>{page.secondary_cta_label&&page.secondary_cta_href&&<a href={page.secondary_cta_href} className="min-h-12 px-6 rounded-xl border border-white/15 text-gray-200 font-semibold inline-flex items-center justify-center">{page.secondary_cta_label}</a>}</div><p className="text-[11px] text-gray-600 mt-4">Atendimento Play Moments · informações claras antes da contratação.</p></div>
    {page.hero_image_url&&<div className="rounded-3xl overflow-hidden border border-white/10 bg-[#141416] shadow-2xl"><img src={page.hero_image_url} alt="" className="w-full aspect-[4/3] object-cover"/></div>}
   </div></section>
   {page.sections.map((section,index)=><Section key={index} section={section} ctaHref={page.cta_href} ctaLabel={page.cta_label}/>)}
  </article>
  <footer className="px-5 py-8 border-t border-white/[.06] text-center text-xs text-gray-600">© {new Date().getFullYear()} Play Moments · Tecnologia, criação e digital.</footer>
 </main>
}