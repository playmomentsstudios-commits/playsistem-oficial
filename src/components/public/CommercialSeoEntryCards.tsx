import { Link } from 'react-router-dom'
import landingData from '../../data/seoCommercialLandings.json'
import { trackConversion } from '../../lib/analytics'

type Area='design'|'tech'|'studio'
const paths:Record<Area,string>={
 design:'/solucoes/identidade-visual',
 tech:'/solucoes/criacao-de-sites',
 studio:'/solucoes/edicao-de-videos',
}
const areaNames:Record<Area,string>={
 design:'Identidade visual',
 tech:'Criação de sites',
 studio:'Edição de vídeos',
}

export function CommercialSeoEntryCards({area}:{area?:Area}){
 const names=area?[area]:['design','tech','studio'] as Area[]
 return <section className="px-4 py-9 sm:py-12 border-b border-white/10" aria-label="Soluções em destaque para contratar">
  <div className="mx-auto max-w-[1100px]">
   <div className="flex flex-wrap items-end justify-between gap-4">
    <div>
     <p className="uppercase text-[11px] font-semibold tracking-[.16em] text-[#DFA269]">Procurando contratar?</p>
     <h2 className="font-bold mt-2 text-2xl sm:text-3xl text-white">{area?'Uma solução para seu projeto':'Serviços mais procurados'}</h2>
     <p className="mt-2 text-sm text-gray-400">Compare opções e veja os serviços publicados antes de solicitar orçamento.</p>
    </div>
   </div>
   <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-3 mt-6">
    {names.map(key=>{
     const path=paths[key]
     const item=(landingData as Record<string,{intro:string}>)[path]
     return <Link key={path} to={path} onClick={()=>trackConversion('service_interest',{source:'seo_internal_link',landing_path:path})}
      className="group rounded-2xl bg-[#151518] border border-white/10 p-5 hover:border-[#A65A2A]/60 hover:bg-[#1c1918] transition-colors">
      <h3 className="font-bold text-white">{areaNames[key]}</h3>
      <p className="text-sm text-gray-400 mt-2 leading-relaxed line-clamp-3">{item.intro}</p>
      <span className="text-xs font-semibold text-[#DFA269] mt-4 inline-flex min-h-8 items-center">Explorar opções e preços ↗</span>
     </Link>
    })}
   </div>
  </div>
 </section>
}
