import { useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { PublicLayout } from '../../layouts/PublicLayout'
import { useSeo } from '../../lib/seo'
import { siteContentApi, type PortfolioCategory, type PortfolioItem, type SiteProfile } from '../../services/siteContent'

const AREAS = [
  { number:'01', name:'Design', discipline:'Identidade & direção visual', description:'Marcas, identidades, sistemas gráficos e experiências pensadas para comunicar com clareza e personalidade.', href:'/design', accent:'#C48A3A' },
  { number:'02', name:'Tech', discipline:'Produtos & experiências digitais', description:'Sites, plataformas, sistemas e integrações que organizam processos e aproximam pessoas e negócios.', href:'/tech', accent:'#72B596' },
  { number:'03', name:'Studio', discipline:'Imagem, som & movimento', description:'Audiovisual, edição, produção musical e experiências criativas que dão forma às histórias.', href:'/studio', accent:'#DFA269' },
  { number:'04', name:'Comunicação', discipline:'Estratégia & conteúdo', description:'Campanhas, conteúdo e comunicação institucional conectados ao contexto, ao público e aos objetivos de cada projeto.', href:'/servicos', accent:'#AEBEAF' },
  { number:'05', name:'Academia', discipline:'Educação & transformação digital', description:'Cursos e percursos de aprendizagem que tornam conhecimentos criativos e tecnológicos mais acessíveis.', href:'/academia', accent:'#C48A3A' },
] as const

const ETAPAS = [
  { number:'01', title:'Entender', description:'Ouvimos o desafio, o território, o público e o que realmente precisa mudar.' },
  { number:'02', title:'Conectar', description:'Reunimos estratégia, criação e tecnologia em uma direção clara.' },
  { number:'03', title:'Construir', description:'Transformamos a proposta em entregas visuais, digitais ou audiovisuais.' },
  { number:'04', title:'Evoluir', description:'Testamos, refinamos e organizamos o que foi produzido para continuar funcionando.' },
] as const

const SEO_DESCRIPTION='Conheça a SAGAMENTE: empresa brasileira de soluções criativas e tecnológicas em design, desenvolvimento digital, comunicação, audiovisual e educação.'
const ORG_SCHEMA = {
  '@context':'https://schema.org',
  '@type':'Organization',
  name:'SAGAMENTE',
  description:SEO_DESCRIPTION,
  address:{'@type':'PostalAddress',addressLocality:'Cavalcante',addressRegion:'GO',addressCountry:'BR'},
}

export function AboutPage(){
  const [profile,setProfile]=useState<SiteProfile|null>(null)
  const [categories,setCategories]=useState<PortfolioCategory[]>([])
  const [items,setItems]=useState<PortfolioItem[]>([])
  const [filter,setFilter]=useState('todos')

  useSeo({
    title:'Quem Somos — SAGAMENTE',
    description:SEO_DESCRIPTION,
    canonicalPath:'/quem-somos',
    jsonLd:ORG_SCHEMA,
  })

  useEffect(()=>{
    let alive=true
    void Promise.allSettled([
      siteContentApi.profile(),
      siteContentApi.portfolioCategories(),
      siteContentApi.portfolioItems(),
    ]).then(([p,c,i])=>{
      if(!alive)return
      if(p.status==='fulfilled')setProfile(p.value)
      if(c.status==='fulfilled')setCategories(c.value)
      if(i.status==='fulfilled')setItems(i.value)
    })
    return()=>{alive=false}
  },[])

  const portfolioCategories=useMemo(
    ()=>categories.filter(category=>items.some(item=>item.category?.slug===category.slug)),
    [categories,items],
  )
  const filtered=useMemo(
    ()=>filter==='todos'?items:items.filter(item=>item.category?.slug===filter),
    [items,filter],
  )

  return <PublicLayout>
    <div className="overflow-hidden text-[#F0F0F2]">

      {/* Institucional, antes do perfil pessoal */}
      <section className="relative isolate overflow-hidden border-b border-white/[0.07]">
        <div aria-hidden="true" className="pointer-events-none absolute inset-0" style={{
          background:'radial-gradient(ellipse 56% 72% at 94% 15%,rgba(46,93,70,.14),transparent 73%),radial-gradient(ellipse 54% 50% at 15% 85%,rgba(166,90,42,.12),transparent 72%)',
        }}/>
        <div className="relative mx-auto max-w-[1200px] px-5 sm:px-8 lg:px-10 pt-14 sm:pt-20 lg:pt-24 pb-20 lg:pb-28">
          <div className="flex items-center gap-3 mb-9 lg:mb-12">
            <span className="h-px w-9 bg-[#DFA269]"/>
            <p className="text-[10px] sm:text-xs tracking-[.22em] uppercase font-semibold text-[#DFA269]">A empresa · Quem somos</p>
          </div>
          <div className="grid lg:grid-cols-[minmax(0,1.13fr)_minmax(350px,.87fr)] gap-12 lg:gap-16 items-center">
            <div>
              <h1 className="max-w-[770px] text-[clamp(2.85rem,6.8vw,5.7rem)] leading-[1.04] tracking-[-.058em] font-extrabold">
                Criatividade que <span className="text-[#DFA269]">conecta.</span><br/>
                Tecnologia que <span className="text-[#92AF9E]">transforma.</span>
              </h1>
              <p className="mt-7 max-w-[600px] text-[16px] sm:text-[18px] leading-[1.75] text-[#B5B4BC]">
                A <strong className="font-semibold text-white">SAGAMENTE</strong> é uma empresa brasileira de soluções criativas e tecnológicas. Unimos design, desenvolvimento digital, comunicação, audiovisual e educação para tirar boas ideias do papel e colocá-las no mundo.
              </p>
              <div className="mt-9 flex flex-col sm:flex-row gap-3">
                <Link to="/servicos" className="inline-flex min-h-12 items-center justify-center gap-4 rounded-xl bg-[#A65A2A] hover:bg-[#81431E] px-6 py-3 font-semibold text-sm text-white">
                  Conhecer nossas soluções <span aria-hidden="true">↗</span>
                </Link>
                <Link to="/contato" className="inline-flex min-h-12 items-center justify-center rounded-xl border border-white/[0.16] hover:border-[#DFA269]/60 hover:bg-white/[0.04] px-6 py-3 font-semibold text-sm text-[#F0F0F2]">
                  Conversar com a gente
                </Link>
              </div>
            </div>

            <div className="relative">
              <div aria-hidden="true" className="absolute -inset-4 rounded-[2rem] border border-white/[0.025]"/>
              <div className="relative overflow-hidden rounded-[26px] border border-white/[0.11] bg-[#141817] p-7 sm:p-9 min-h-[385px] flex flex-col justify-between">
                <div aria-hidden="true" className="pointer-events-none absolute -right-24 -top-28 w-[330px] h-[330px] rounded-full bg-[#2E5D46]/[0.16] blur-[75px]"/>
                <div className="flex items-start justify-between gap-4 relative">
                  <span className="text-[10px] tracking-[.23em] uppercase font-semibold text-[#B4B0A9]">Nossa essência</span>
                  <span className="text-[10px] tracking-[.13em] text-[#7C827E]">SAGAMENTE / BR</span>
                </div>
                <div className="relative mx-auto py-7">
                  <img src="/sagamente-mark.svg" alt="" className="h-36 sm:h-40 w-auto mx-auto opacity-95 drop-shadow-[0_16px_35px_rgba(0,0,0,.35)]"/>
                </div>
                <div className="grid grid-cols-2 gap-0 border-t border-white/[0.13] relative">
                  <div className="pt-5 pr-4 border-r border-white/[0.12]">
                    <span className="block text-lg sm:text-xl font-extrabold tracking-[-.025em] text-[#E5A477]">SAGA</span>
                    <p className="text-xs sm:text-[13px] text-[#A8A9A6] leading-relaxed mt-2">História, identidade, jornada e raízes.</p>
                  </div>
                  <div className="pt-5 pl-4">
                    <span className="block text-lg sm:text-xl font-extrabold tracking-[-.025em] text-[#A3BEAD]">MENTE</span>
                    <p className="text-xs sm:text-[13px] text-[#A8A9A6] leading-relaxed mt-2">Ideias, inteligência, criação e futuro.</p>
                  </div>
                </div>
              </div>
            </div>
          </div>
          <div className="mt-14 lg:mt-20 flex flex-wrap items-center justify-between gap-4 border-t border-white/[0.07] pt-5">
            <span className="text-[11px] text-[#8F9292] tracking-[.1em]">CAVALCANTE · GOIÁS · BRASIL</span>
            <span className="text-[11px] text-[#8F9292] tracking-[.1em]">DESIGN · TECNOLOGIA · COMUNICAÇÃO</span>
          </div>
        </div>
      </section>

      {/* Posicionamento e frentes de negócio */}
      <section id="atuacao" className="mx-auto max-w-[1200px] px-5 sm:px-8 lg:px-10 py-20 sm:py-24 lg:py-28">
        <div className="grid lg:grid-cols-[.74fr_1.26fr] gap-5 lg:gap-14 items-start mb-10 lg:mb-16">
          <div>
            <p className="text-xs tracking-[.2em] uppercase font-semibold text-[#DFA269]">O que fazemos</p>
            <h2 className="mt-3 text-3xl sm:text-4xl lg:text-5xl font-bold tracking-[-.04em]">Uma marca.<br/><span className="text-[#DFA269]">Várias possibilidades.</span></h2>
          </div>
          <p className="max-w-xl text-base sm:text-lg leading-[1.75] text-[#AFAEB7] lg:pt-9">
            Não somos apenas uma agência, um estúdio ou uma empresa de software. Somos uma operação integrada: cada área tem sua especialidade, e todas trabalham com a mesma direção — construir soluções relevantes para pessoas, negócios, instituições e projetos culturais.
          </p>
        </div>
        <div className="grid md:grid-cols-2 gap-4">
          {AREAS.map((area,index)=><Link
            key={area.number}
            to={area.href}
            className={'group relative min-h-[236px] rounded-2xl border border-white/[0.09] bg-[#141416] hover:bg-[#1B1B1E] hover:border-white/[0.22] transition-colors overflow-hidden p-6 sm:p-8 flex flex-col justify-between '+(index===4?'md:col-span-2':'')}
          >
            <div className="flex justify-between items-start gap-4">
              <span className="text-xs font-semibold tracking-[.1em]" style={{color:area.accent}}>{area.number} / SAGAMENTE</span>
              <span aria-hidden="true" className="text-xl text-white/40 group-hover:text-[#DFA269] transition-colors">↗</span>
            </div>
            <div className="mt-9">
              <h3 className="text-[28px] sm:text-[32px] font-bold leading-none tracking-[-.035em]">{area.name}</h3>
              <p className="mt-2 text-xs sm:text-sm font-medium" style={{color:area.accent}}>{area.discipline}</p>
              <p className="mt-4 max-w-[550px] text-[14px] leading-[1.7] text-[#A9A8B2]">{area.description}</p>
            </div>
            <div aria-hidden="true" className="absolute -right-12 -bottom-20 w-52 h-52 rounded-full blur-[70px] pointer-events-none opacity-[.12]" style={{background:area.accent}}/>
          </Link>)}
        </div>
      </section>

      {/* Respiro editorial: manifesto da marca */}
      <section className="bg-[#E7E1D7] text-[#191A18]">
        <div className="mx-auto max-w-[1200px] px-5 sm:px-8 lg:px-10 py-20 sm:py-24 lg:py-28">
          <p className="text-xs uppercase tracking-[.2em] font-bold text-[#81502E]">Nossa visão</p>
          <div className="mt-7 grid lg:grid-cols-[1.13fr_.87fr] gap-9 lg:gap-20 items-end">
            <h2 className="text-[clamp(2.4rem,5.2vw,4.75rem)] font-extrabold tracking-[-.06em] leading-[1.1]">
              A melhor solução nasce do encontro entre <span className="text-[#965226]">sensibilidade</span> e <span className="text-[#2E5D46]">inteligência.</span>
            </h2>
            <div className="lg:pb-2">
              <p className="text-[16px] leading-[1.85] text-[#444641]">
                Acreditamos na criatividade com propósito, no respeito às origens e na tecnologia que faz sentido para quem a utiliza. Cada projeto começa com escuta e ganha forma com método, repertório e responsabilidade.
              </p>
              <div className="mt-7 flex flex-wrap gap-2">
                {['Escuta','Identidade','Clareza','Colaboração','Execução'].map(item=><span key={item} className="rounded-full border border-[#A39A8B]/45 px-3.5 py-2 text-xs font-semibold text-[#5C5147]">{item}</span>)}
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Método de trabalho */}
      <section className="mx-auto max-w-[1200px] px-5 sm:px-8 lg:px-10 py-20 sm:py-24 lg:py-28">
        <div className="flex flex-col sm:flex-row sm:items-end sm:justify-between gap-5">
          <div>
            <p className="text-xs uppercase tracking-[.2em] font-semibold text-[#DFA269]">Nosso processo</p>
            <h2 className="mt-3 text-3xl sm:text-4xl lg:text-5xl font-bold tracking-[-.04em]">Do desafio à entrega.</h2>
          </div>
          <p className="max-w-md text-sm sm:text-base leading-[1.7] text-[#9F9EA7]">Uma forma de trabalhar que combina direção criativa, organização técnica e acompanhamento próximo.</p>
        </div>
        <div className="mt-10 grid sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {ETAPAS.map(etapa=><div key={etapa.number} className="relative min-h-[210px] border-t-2 border-[#A65A2A]/[.8] bg-[#151517] p-6">
            <span className="text-xs tracking-widest font-bold text-[#DFA269]">{etapa.number} / 04</span>
            <h3 className="mt-9 text-xl font-bold">{etapa.title}</h3>
            <p className="mt-3 text-sm leading-relaxed text-[#A8A7B0]">{etapa.description}</p>
          </div>)}
        </div>
      </section>

      {/* História do fundador: contribuição à marca, não currículo */}
      <section className="border-y border-white/[0.07] bg-[#101112]">
        <div className="mx-auto max-w-[1200px] px-5 sm:px-8 lg:px-10 py-20 sm:py-24 lg:py-28">
          <div className="grid lg:grid-cols-[minmax(280px,.82fr)_minmax(0,1.18fr)] items-center gap-9 lg:gap-16">
            <div className="relative">
              <div className="relative overflow-hidden rounded-[22px] aspect-[4/4.5] max-h-[530px] bg-[#222] border border-white/[0.1]">
                <img src={profile?.photo_url||'/profile/felipe-costa.webp'} alt={'Retrato de '+(profile?.display_name||'Felipe Costa')} className="w-full h-full object-cover object-top" loading="lazy" decoding="async"/>
                <div aria-hidden="true" className="absolute inset-x-0 bottom-0 h-32 bg-gradient-to-t from-black/60 to-transparent"/>
                <p className="absolute bottom-5 left-6 text-[10px] tracking-[.19em] uppercase font-semibold text-white/85">Pessoas por trás das ideias</p>
              </div>
              <div aria-hidden="true" className="absolute -bottom-3 -right-3 h-24 w-24 border-b-2 border-r-2 border-[#A65A2A]/80 rounded-br-[28px]"/>
            </div>
            <div>
              <p className="text-xs uppercase tracking-[.2em] font-semibold text-[#DFA269]">De onde viemos</p>
              <h2 className="mt-4 text-[clamp(2rem,4.1vw,3.8rem)] font-extrabold tracking-[-.045em] leading-[1.15]">
                Raízes que inspiram.<br/>Experiência que constrói.
              </h2>
              <p className="mt-7 text-[15px] sm:text-base leading-[1.85] text-[#C6C5CB]">
                A SAGAMENTE nasce da trajetória de <strong className="font-semibold text-white">{profile?.display_name||'Felipe Costa'}</strong>, profissional criativo, negro e quilombola Kalunga, com raízes em Cavalcante, Goiás. Uma vivência que conecta identidade cultural, comunicação e conhecimento técnico.
              </p>
              <p className="mt-4 text-[15px] sm:text-base leading-[1.85] text-[#AFAEB8]">
                {profile?.story||'Uma trajetória profissional construída entre design, comunicação, audiovisual e tecnologia, reunindo diferentes repertórios e formas de realizar projetos.'}
              </p>
              <p className="mt-4 text-[15px] sm:text-base leading-[1.85] text-[#AFAEB8]">
                Essa origem orienta nosso olhar, sem limitar nossa atuação: criamos para empresas, organizações, iniciativas culturais e pessoas com desafios de diferentes escalas.
              </p>
              {profile && profile.market_since>1900 && <div className="mt-8 inline-flex items-center gap-4 border-l-2 border-[#A65A2A] pl-5">
                <span className="text-3xl sm:text-4xl font-extrabold text-[#DFA269]">{profile.market_since}</span>
                <span className="text-xs sm:text-sm leading-relaxed text-[#9F9EA7]">Início da trajetória<br/>profissional do fundador</span>
              </div>}
            </div>
          </div>
        </div>
      </section>

      {/* Só mostrar projetos quando existem trabalhos cadastrados e publicados */}
      {items.length>0&&<section id="portfolio" className="mx-auto max-w-[1200px] px-5 sm:px-8 lg:px-10 py-20 sm:py-24 lg:py-28 scroll-mt-24">
        <div className="flex flex-wrap items-end justify-between gap-6">
          <div>
            <p className="text-xs uppercase tracking-[.2em] font-semibold text-[#DFA269]">Projetos selecionados</p>
            <h2 className="mt-3 text-3xl sm:text-4xl font-bold tracking-[-.04em]">Ideias que ganharam forma.</h2>
          </div>
          <Link to="/contato" className="inline-flex min-h-11 items-center text-sm font-semibold text-[#DFA269] hover:text-white">Vamos criar algo juntos ↗</Link>
        </div>
        {portfolioCategories.length>0&&<div className="mt-7 flex gap-2 overflow-x-auto pb-3" aria-label="Filtrar projetos">
          <button type="button" onClick={()=>setFilter('todos')} aria-pressed={filter==='todos'} className={'shrink-0 rounded-full px-4 min-h-10 text-xs font-semibold transition-colors '+(filter==='todos'?'bg-[#A65A2A] text-white':'bg-white/[0.06] text-[#B3B2BC] hover:bg-white/[0.12]')}>Todos</button>
          {portfolioCategories.map(category=><button key={category.id} type="button" onClick={()=>setFilter(category.slug)} aria-pressed={filter===category.slug} className={'shrink-0 rounded-full px-4 min-h-10 text-xs font-semibold transition-colors '+(filter===category.slug?'bg-[#A65A2A] text-white':'bg-white/[0.06] text-[#B3B2BC] hover:bg-white/[0.12]')}>{category.name}</button>)}
        </div>}
        <div className="mt-6 grid sm:grid-cols-2 lg:grid-cols-3 gap-5">
          {filtered.map(item=><article key={item.id} className="overflow-hidden rounded-2xl border border-white/[0.09] bg-[#151517]">
            <div className="aspect-[16/10] overflow-hidden bg-[#202120]">
              {item.cover_url?<img src={item.cover_url} alt={item.title} className="h-full w-full object-cover" loading="lazy" decoding="async"/>:<div className="h-full w-full flex items-center justify-center"><img src="/sagamente-mark.svg" alt="" className="w-16 opacity-30"/></div>}
            </div>
            <div className="p-5">
              <p className="text-[11px] uppercase tracking-[.14em] font-semibold text-[#DFA269]">{item.category?.name||'Projeto'}</p>
              <h3 className="mt-2 text-lg font-bold leading-snug">{item.title}</h3>
              {item.client&&<p className="mt-1 text-xs text-[#85858F]">{item.client}</p>}
              {item.short_description&&<p className="mt-3 text-sm leading-relaxed text-[#B0AFB8]">{item.short_description}</p>}
              {item.project_url&&<a href={item.project_url} target="_blank" rel="noopener noreferrer" className="mt-5 inline-flex text-sm font-semibold text-[#DFA269] hover:text-white">Conhecer projeto ↗</a>}
            </div>
          </article>)}
        </div>
      </section>}

      {/* Direcionamento comercial sem portfólio vazio */}
      <section id={items.length===0?'portfolio':undefined} className="scroll-mt-24">
        <div className="mx-auto max-w-[1200px] px-5 sm:px-8 lg:px-10 pb-16 sm:pb-24">
          <div className="relative overflow-hidden rounded-[24px] sm:rounded-[30px] border border-[#647D6B]/[.35] bg-[#18231D] p-8 sm:p-12 lg:p-16">
            <div aria-hidden="true" className="absolute top-[-140px] right-[-100px] h-[420px] w-[420px] rounded-full bg-[#2E5D46]/[.22] blur-[100px] pointer-events-none"/>
            <div className="relative flex flex-col lg:flex-row lg:items-end lg:justify-between gap-9">
              <div>
                <p className="text-xs uppercase tracking-[.2em] font-semibold text-[#A9C6B3]">O próximo passo</p>
                <h2 className="mt-4 text-3xl sm:text-4xl lg:text-5xl font-extrabold tracking-[-.045em] leading-[1.12]">Tem uma ideia, um desafio<br className="hidden sm:block"/> ou um projeto?</h2>
                <p className="mt-5 max-w-xl text-base leading-relaxed text-[#B2C0B6]">Conte o que você precisa. A gente ajuda a encontrar o melhor caminho entre estratégia, criação e tecnologia.</p>
              </div>
              <Link to="/contato" className="shrink-0 inline-flex min-h-[54px] items-center justify-center gap-5 rounded-xl bg-[#E7E1D7] hover:bg-white text-[#1A1A1A] px-7 py-4 font-bold text-sm">
                Fale com a SAGAMENTE <span aria-hidden="true">↗</span>
              </Link>
            </div>
          </div>
        </div>
      </section>
    </div>
  </PublicLayout>
}
