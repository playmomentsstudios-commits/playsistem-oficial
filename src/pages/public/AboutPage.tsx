import { useEffect,useMemo,useState } from 'react'
import { PublicLayout } from '../../layouts/PublicLayout'
import { siteContentApi,type PortfolioCategory,type PortfolioItem,type SiteProfile } from '../../services/siteContent'

export function AboutPage(){
  const [profile,setProfile]=useState<SiteProfile|null>(null)
  const [categories,setCategories]=useState<PortfolioCategory[]>([])
  const [items,setItems]=useState<PortfolioItem[]>([])
  const [filter,setFilter]=useState('todos')

  useEffect(()=>{Promise.all([siteContentApi.profile(),siteContentApi.portfolioCategories(),siteContentApi.portfolioItems()]).then(([p,c,i])=>{setProfile(p);setCategories(c);setItems(i)})},[])
  const filtered=useMemo(()=>filter==='todos'?items:items.filter(item=>item.category?.slug===filter),[items,filter])

  return <PublicLayout>
    <div className="mx-auto px-4 py-8 sm:py-12" style={{maxWidth:1100}}>
      <section className="grid lg:grid-cols-[340px_1fr] gap-8 lg:gap-12 items-start">
        <div className="rounded-3xl overflow-hidden bg-[#141416] border border-white/10 min-h-[360px] flex items-center justify-center">
          {profile?.photo_url?<img src={profile.photo_url} alt={profile.display_name} className="w-full h-full object-cover"/>:<div className="text-center p-8"><div className="w-24 h-24 rounded-full bg-[#E30613]/15 text-[#E30613] mx-auto flex items-center justify-center text-3xl font-bold">{profile?.display_name?.charAt(0)||'P'}</div><p className="text-xs text-gray-600 mt-4">Foto profissional</p></div>}
        </div>
        <div>
          <p className="text-xs uppercase tracking-[0.2em] text-[#E30613] font-semibold">{profile?.eyebrow||'Quem Somos'}</p>
          <h1 className="text-3xl sm:text-5xl font-bold mt-3">{profile?.display_name||'Play Moments'}</h1>
          <p className="text-base sm:text-lg text-gray-400 mt-3">{profile?.headline}</p>
          <p className="text-gray-300 leading-7 mt-6">{profile?.intro}</p>
          <div className="mt-8 grid grid-cols-2 sm:grid-cols-4 gap-3">
            <div className="p-4 rounded-2xl bg-white/[0.035] border border-white/8"><b className="text-2xl text-[#E30613]">{profile?.projects_delivered_label}</b><p className="text-[11px] text-gray-500 mt-1">Projetos entregues</p></div>
            <div className="p-4 rounded-2xl bg-white/[0.035] border border-white/8"><b className="text-2xl text-[#E30613]">{profile?.clients_served_label}</b><p className="text-[11px] text-gray-500 mt-1">Clientes atendidos</p></div>
            <div className="p-4 rounded-2xl bg-white/[0.035] border border-white/8"><b className="text-2xl text-[#E30613]">Desde {profile?.market_since}</b><p className="text-[11px] text-gray-500 mt-1">No mercado</p></div>
            <div className="p-4 rounded-2xl bg-white/[0.035] border border-white/8"><b className="text-2xl text-[#E30613]">{profile?.satisfaction_label}</b><p className="text-[11px] text-gray-500 mt-1">Satisfação</p></div>
          </div>
        </div>
      </section>

      <section className="grid lg:grid-cols-2 gap-5 mt-12">
        <div className="p-5 sm:p-6 rounded-2xl bg-[#141416] border border-white/8"><p className="text-xs uppercase tracking-wider text-[#E30613]">História</p><p className="text-sm sm:text-base text-gray-300 leading-7 mt-3 whitespace-pre-line">{profile?.story}</p></div>
        <div className="p-5 sm:p-6 rounded-2xl bg-[#141416] border border-white/8"><p className="text-xs uppercase tracking-wider text-[#E30613]">Objetivo</p><p className="text-sm sm:text-base text-gray-300 leading-7 mt-3 whitespace-pre-line">{profile?.objective}</p></div>
      </section>

      {!!profile?.skills?.length&&<section className="mt-10"><h2 className="text-xl font-bold">Áreas de atuação</h2><div className="flex flex-wrap gap-2 mt-4">{profile.skills.map(skill=><span key={skill} className="px-3 py-2 rounded-full text-xs bg-white/[0.05] border border-white/8 text-gray-300">{skill}</span>)}</div></section>}

      {!!profile?.experience?.length&&<section className="mt-12"><p className="text-xs uppercase tracking-wider text-[#E30613]">Currículo</p><h2 className="text-2xl font-bold mt-2">Experiência profissional</h2><div className="grid md:grid-cols-2 gap-3 mt-5">{profile.experience.map((exp,index)=><div key={index} className="p-4 rounded-2xl bg-[#141416] border border-white/8"><h3 className="font-semibold">{exp.title}</h3><p className="text-xs text-[#E30613] mt-1">{exp.role}</p><p className="text-xs text-gray-500 leading-5 mt-3">{exp.description}</p></div>)}</div>{profile.resume_url&&<a href={profile.resume_url} target="_blank" rel="noreferrer" className="inline-flex mt-4 px-4 py-3 rounded-xl bg-white/[0.06] text-sm font-semibold">Abrir currículo completo ↗</a>}</section>}

      <section id="portfolio" className="mt-16">
        <p className="text-xs uppercase tracking-wider text-[#E30613]">Portfólio</p>
        <h2 className="text-3xl font-bold mt-2">Projetos e trabalhos</h2>
        <div className="flex flex-wrap gap-2 mt-5">
          <button onClick={()=>setFilter('todos')} className={'px-3 py-2 rounded-full text-xs '+(filter==='todos'?'bg-[#E30613] text-white':'bg-white/[0.05] text-gray-400')}>Todos</button>
          {categories.map(cat=><button key={cat.id} onClick={()=>setFilter(cat.slug)} className={'px-3 py-2 rounded-full text-xs '+(filter===cat.slug?'bg-[#E30613] text-white':'bg-white/[0.05] text-gray-400')}>{cat.name}</button>)}
        </div>
        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4 mt-6">
          {filtered.map(item=><article key={item.id} className="overflow-hidden rounded-2xl bg-[#141416] border border-white/8">
            <div className="aspect-[16/10] bg-white/[0.035] flex items-center justify-center overflow-hidden">{item.cover_url?<img src={item.cover_url} alt={item.title} className="w-full h-full object-cover"/>:<span className="text-4xl opacity-40">◆</span>}</div>
            <div className="p-4"><p className="text-[10px] uppercase tracking-wide text-[#E30613]">{item.category?.name||'Projeto'}</p><h3 className="font-semibold mt-1">{item.title}</h3><p className="text-xs text-gray-500 mt-1">{item.client}</p><p className="text-xs text-gray-400 leading-5 mt-3">{item.short_description}</p>{item.project_url&&<a href={item.project_url} target="_blank" rel="noreferrer" className="inline-flex mt-3 text-xs text-[#E30613] font-semibold">Ver projeto ↗</a>}</div>
          </article>)}
        </div>
      </section>
    </div>
  </PublicLayout>
}
