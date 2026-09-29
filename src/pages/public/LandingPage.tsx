import { useEffect,useState } from 'react'
import { Link,useParams } from 'react-router-dom'
import { PublicLayout } from '../../layouts/PublicLayout'
import { siteContentApi,type SiteLandingPage } from '../../services/siteContent'
import { useSeo } from '../../lib/seo'

export function LandingPage(){
 const {slug=''}=useParams(),[page,setPage]=useState<SiteLandingPage|null>(null),[loading,setLoading]=useState(true)
 useEffect(()=>{let active=true;siteContentApi.landingPage(slug).then(p=>{if(active)setPage(p)}).catch(()=>setPage(null)).finally(()=>setLoading(false));return()=>{active=false}},[slug])
 useSeo({title:page?.seo_title||page?.title||'Campanha',description:page?.seo_description||page?.subheadline||'Conheça esta solução da Play Moments.',image:page?.hero_image_url,canonicalPath:'/l/'+slug,canonicalUrl:page?.canonical_url,noindex:Boolean(page?.noindex)||(!loading&&!page)})
 if(loading)return <PublicLayout><div className="min-h-[55vh] flex items-center justify-center text-gray-400">Carregando...</div></PublicLayout>
 if(!page)return <PublicLayout><div className="min-h-[55vh] flex flex-col items-center justify-center px-5 text-center"><h1 className="text-3xl font-bold">Página não encontrada</h1><p className="text-gray-400 mt-3">Esta campanha pode ter sido encerrada ou o endereço está incorreto.</p><Link to="/" className="mt-6 px-5 py-3 rounded-xl bg-[#E30613] font-semibold">Voltar para a Play Moments</Link></div></PublicLayout>
 return <PublicLayout>
  <article>
   <section className="px-5 py-14 sm:py-20"><div className="max-w-6xl mx-auto grid lg:grid-cols-2 gap-10 items-center">
    <div><p className="text-xs uppercase tracking-[.2em] font-bold text-[#E30613]">{page.eyebrow||'Play Moments'}</p><h1 className="text-4xl sm:text-6xl font-extrabold leading-[1.05] mt-4">{page.headline}</h1>{page.subheadline&&<p className="text-lg text-gray-400 mt-5 leading-8">{page.subheadline}</p>}<div className="flex flex-wrap gap-3 mt-7"><a href={page.cta_href} className="min-h-12 px-6 rounded-xl bg-[#E30613] text-white font-bold inline-flex items-center justify-center">{page.cta_label}</a>{page.secondary_cta_label&&page.secondary_cta_href&&<a href={page.secondary_cta_href} className="min-h-12 px-6 rounded-xl border border-white/15 text-gray-200 font-semibold inline-flex items-center justify-center">{page.secondary_cta_label}</a>}</div></div>
    {page.hero_image_url&&<div className="rounded-3xl overflow-hidden border border-white/10 bg-[#141416]"><img src={page.hero_image_url} alt="" className="w-full aspect-[4/3] object-cover"/></div>}
   </div></section>
   {page.sections.map((section,index)=><section key={index} className="px-5 py-10 sm:py-14 border-t border-white/[.05]"><div className="max-w-5xl mx-auto">{section.title&&<h2 className="text-2xl sm:text-3xl font-bold">{section.title}</h2>}{section.text&&<p className="text-gray-400 leading-7 mt-3 max-w-3xl">{section.text}</p>}{section.items&&<div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4 mt-6">{section.items.map((item,i)=><div key={i} className="p-5 rounded-2xl bg-[#141416] border border-white/10"><h3 className="font-semibold">{item.title}</h3>{item.description&&<p className="text-sm text-gray-400 leading-6 mt-2">{item.description}</p>}</div>)}</div>}</div></section>)}
  </article>
 </PublicLayout>
}
