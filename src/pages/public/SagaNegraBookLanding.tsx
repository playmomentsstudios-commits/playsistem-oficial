import type { SiteLandingPage, LandingSection } from '../../services/siteContent'
import { BrandImage } from '../../components/BrandImage'

type Props={page:SiteLandingPage;preview?:boolean}

function findSection(page:SiteLandingPage,type:LandingSection['type']){
 return page.sections.find(s=>s.type===type)
}
const safeLink=(href:string)=>href.startsWith('/')||href.startsWith('mailto:')||href.startsWith('https://')?href:'#oferta'

export function SagaNegraBookLanding({page,preview=false}:Props){
 const benefits=findSection(page,'benefits')?.items||[]
 const themes=findSection(page,'content')?.items||[]
 const offers=findSection(page,'proof')?.items||[]
 const faqs=findSection(page,'faq')?.items||[]
 const primaryHref=safeLink(page.cta_href)
 const primaryLabel=page.cta_label
 return <main id="inicio" className="min-h-screen overflow-hidden bg-[#0a0b0d] text-[#f8eee4] selection:bg-[#BD6A36] selection:text-white">
  {preview&&<div className="sticky top-0 z-50 border-b border-[#E7A06C]/30 bg-[#55351f] px-4 py-2 text-center text-xs font-semibold text-[#fff4e8]">PRÉVIA INTERNA · Esta página está em rascunho e não foi lançada ao público. <a href="/admin/landings" className="ml-2 underline">Voltar ao editor</a></div>}
  <header className="border-b border-white/[.08] bg-[#0e0f10]/90">
   <div className="mx-auto flex max-w-7xl items-center justify-between gap-3 px-5 py-4 sm:px-8">
    <a href="#inicio" aria-label="Início · Sagamente"><BrandImage variant="dark" alt="Sagamente" className="h-8 w-auto sm:h-10"/></a>
    <nav aria-label="Seções da página" className="hidden items-center gap-7 text-xs font-medium text-[#c9beb5] md:flex">
     <a className="hover:text-white" href="#sobre">Sobre a obra</a><a className="hover:text-white" href="#conteudo">Conteúdo</a><a className="hover:text-white" href="#oferta">Formatos</a><a className="hover:text-white" href="#perguntas">Perguntas</a>
    </nav>
    <a href={primaryHref} className="inline-flex min-h-10 items-center justify-center rounded-lg border border-[#C67542] bg-[#AE572A] px-4 text-xs font-bold text-white transition hover:bg-[#C56A37]">{primaryLabel}</a>
   </div>
  </header>
  <section className="relative isolate overflow-hidden border-b border-[#d6a477]/10">
   <div aria-hidden="true" className="pointer-events-none absolute -right-48 -top-40 -z-10 h-[780px] w-[780px] rounded-full bg-[#74381c]/20 blur-[140px]"/>
   <div className="mx-auto grid max-w-7xl items-center gap-12 px-5 pb-16 pt-16 sm:px-8 md:pt-20 lg:grid-cols-[1.05fr_.95fr] lg:gap-20 lg:pb-24">
    <div>
     <p className="mb-5 inline-flex items-center gap-2 rounded-full border border-[#bb713f]/30 bg-[#a75c2d]/10 px-3 py-2 text-[10px] font-bold uppercase tracking-[.2em] text-[#F0AE79]"><span className="h-1.5 w-1.5 rounded-full bg-[#f0a66a]"/> {page.eyebrow||'SAGA NEGRA · RELEASE 00'}</p>
     <h1 className="max-w-3xl font-serif text-[clamp(2.7rem,6.2vw,5.7rem)] font-bold leading-[1.02] tracking-[-.045em] text-[#fff5e7]">{page.headline}</h1>
     {page.subheadline&&<p className="mt-6 max-w-xl text-base leading-8 text-[#c7c1bd] sm:text-lg">{page.subheadline}</p>}
     <div className="mt-8 flex flex-wrap items-center gap-3">
      <a className="inline-flex min-h-12 items-center justify-center rounded-xl bg-[#BF6837] px-6 text-sm font-bold text-[#fff9ef] shadow-lg shadow-black/20 transition hover:bg-[#E18246]" href={primaryHref}>{primaryLabel}<span aria-hidden="true" className="ml-2">↗</span></a>
      <a href="#conteudo" className="inline-flex min-h-12 items-center justify-center rounded-xl border border-white/20 px-6 text-sm font-semibold text-[#e4ddd5] transition hover:bg-white/5">Conhecer os capítulos</a>
     </div>
     <div className="mt-9 flex flex-wrap gap-x-7 gap-y-3 border-t border-white/[.09] pt-6 text-xs font-medium text-[#c8b7a6]">
      <span>✦ 16 capítulos</span><span>✦ História e economia</span><span>✦ E-book + audiobook</span>
     </div>
    </div>
    <div className="relative mx-auto w-full max-w-[470px]">
     <div aria-hidden="true" className="absolute inset-x-12 bottom-4 top-4 rounded-[45%] bg-[#d26d33]/20 blur-[65px]"/>
     <div className="relative mx-auto w-[79%] max-w-[340px] -rotate-[5deg] transform-gpu rounded-r-lg shadow-[28px_26px_40px_rgba(0,0,0,.58)] transition-transform duration-500 hover:rotate-0">
      <div className="absolute -right-3 bottom-2 top-2 w-4 rounded-r-md bg-gradient-to-r from-[#d5c9b2] to-[#625950]"/>
      <img src={page.hero_image_url||'/images/saga-negra-release-00-cover.svg'} alt="Capa de SAGA NEGRA — Entre o Fracasso e a Prosperidade" width="900" height="1200" loading="eager" className="relative aspect-[3/4] w-full rounded-r-md border border-[#b98961]/35 object-cover"/>
     </div>
     <p className="relative mt-8 text-center text-[11px] tracking-widest text-[#a78f7a]">EDIÇÃO DIGITAL · CAPA CONCEITUAL DE PRÉ-LANÇAMENTO</p>
    </div>
   </div>
  </section>
  <section id="sobre" className="border-b border-white/[.06] bg-[#111214]">
   <div className="mx-auto grid max-w-6xl gap-8 px-5 py-16 sm:px-8 lg:grid-cols-[.85fr_1.15fr] lg:gap-16">
    <div><p className="text-xs font-bold uppercase tracking-[.2em] text-[#D69058]">Uma pergunta que atravessa gerações</p><h2 className="mt-3 font-serif text-3xl font-semibold leading-tight sm:text-4xl">Por que produzir riqueza nem sempre significa possuir riqueza?</h2></div>
    <div className="space-y-5 text-sm leading-8 text-[#c4beba] sm:text-base">
     <p>Esta obra percorre a história econômica da população negra sem reduzir trajetórias a derrotas, nem transformar casos de sucesso em fórmulas universais.</p>
     <p>Do patrimônio africano anterior à colonização aos desafios do Pix, do empreendedorismo e da inteligência artificial, cada capítulo aproxima o passado das decisões que moldam o presente.</p>
     <p className="border-l-2 border-[#D88E51] pl-4 font-serif text-lg italic text-[#f0ddca]">O dinheiro deve servir à vida. Não o contrário.</p>
    </div>
   </div>
  </section>
  {benefits.length>0&&<section id="conteudo" className="mx-auto max-w-7xl px-5 py-18 sm:px-8 sm:py-24">
   <div className="mb-10 max-w-3xl"><p className="text-xs font-bold uppercase tracking-[.2em] text-[#D69058]">O que você vai explorar</p><h2 className="mt-3 font-serif text-3xl font-semibold sm:text-5xl">Uma leitura sobre dinheiro que começa antes do primeiro salário.</h2><p className="mt-4 max-w-2xl text-sm leading-7 text-[#aea8a3]">Temas históricos e contemporâneos, abordados com nuance — sem promessas fáceis e sem culpabilizar quem enfrenta condições desiguais.</p></div>
   <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-3">{benefits.map((item,i)=><article key={i} className="rounded-2xl border border-white/[.09] bg-[#151719] p-6 transition hover:border-[#9a623d]/50"><span className="font-serif text-4xl text-[#A8663E]">{String(i+1).padStart(2,'0')}</span><h3 className="mt-4 text-lg font-semibold text-[#f7eade]">{item.title}</h3>{item.description&&<p className="mt-2 text-sm leading-7 text-[#b9b2aa]">{item.description}</p>}</article>)}</div>
  </section>}
  {themes.length>0&&<section className="border-y border-white/[.08] bg-[#111316] px-5 py-16 sm:px-8 sm:py-20">
   <div className="mx-auto max-w-6xl"><p className="text-xs font-bold uppercase tracking-[.2em] text-[#D69058]">O percurso do livro</p><h2 className="mt-3 font-serif text-3xl font-semibold sm:text-4xl">Da história à possibilidade de escolha.</h2>
    <div className="mt-8 grid gap-4 md:grid-cols-2">{themes.map((item,i)=><div key={i} className="flex gap-4 rounded-xl border border-white/[.07] bg-[#181a1c] p-5"><span className="shrink-0 font-serif text-3xl text-[#D18A50]">{String(i+1).padStart(2,'0')}</span><div><h3 className="font-semibold">{item.title}</h3>{item.description&&<p className="mt-2 text-sm leading-6 text-[#aaa49e]">{item.description}</p>}</div></div>)}</div>
   </div>
  </section>}
  <section className="mx-auto max-w-6xl px-5 py-16 sm:px-8 sm:py-24">
   <div className="rounded-[28px] border border-[#BA7347]/25 bg-gradient-to-br from-[#271a15] via-[#1c1919] to-[#131517] p-7 sm:p-12">
    <p className="text-xs font-bold uppercase tracking-[.2em] text-[#D69058]">Trecho da obra</p>
    <blockquote className="mt-5 max-w-4xl font-serif text-2xl leading-relaxed text-[#f6e8d4] sm:text-4xl">“A prosperidade deixa de ser apenas uma demonstração de sucesso. E passa a representar algo mais profundo: a possibilidade de escolher o próprio caminho.”</blockquote>
    <p className="mt-5 text-xs text-[#c9a68c]">Conclusão · SAGA NEGRA — Entre o Fracasso e a Prosperidade</p>
   </div>
  </section>
  <section id="oferta" className="border-y border-white/[.08] bg-[#111214] px-5 py-16 sm:px-8 sm:py-24">
   <div className="mx-auto max-w-6xl"><p className="text-xs font-bold uppercase tracking-[.2em] text-[#D69058]">Escolha como consumir</p><h2 className="mt-3 font-serif text-3xl font-semibold sm:text-5xl">Uma obra. Diferentes maneiras de acessar.</h2>
    <p className="mt-4 max-w-3xl text-sm leading-7 text-[#b8b0aa]">Valores planejados para o lançamento, sujeitos à confirmação. As compras e o acesso na Minha Academia serão habilitados somente após a validação do pagamento e das permissões.</p>
    <div className="mt-9 grid gap-4 md:grid-cols-3">{offers.map((item,i)=><article key={i} className={'relative rounded-2xl border p-6 '+(i===2?'border-[#B56B3F] bg-[#41291d]/40':'border-white/10 bg-[#1a1b1d]')}>
     {i===2&&<span className="absolute -top-3 left-5 rounded-full bg-[#BC6C3B] px-3 py-1 text-[10px] font-bold uppercase tracking-[.08em] text-white">Dois formatos</span>}
     <p className="text-[10px] font-bold uppercase tracking-[.16em] text-[#d9a076]">{i===0?'Para ler':i===1?'Para ouvir':'Pacote essencial'}</p>
     <h3 className="mt-3 text-xl font-semibold">{item.title}</h3>
     <p className="mt-3 text-sm leading-6 text-[#b8aea7]">{item.description}</p>
     <a className="mt-8 inline-flex min-h-11 w-full items-center justify-center rounded-xl border border-[#b97647] bg-[#AC5A2F]/15 px-4 text-sm font-semibold text-[#edb486] transition hover:bg-[#AC5A2F]/30" href={primaryHref}>{primaryLabel} ↗</a>
    </article>)}</div>
    <p className="mt-6 text-xs text-[#8f8984]">Sem podcast no combo essencial. Edição expandida e demais conteúdos serão projetos separados.</p>
   </div>
  </section>
  {faqs.length>0&&<section id="perguntas" className="mx-auto max-w-4xl px-5 py-16 sm:px-8 sm:py-24"><p className="text-xs font-bold uppercase tracking-[.2em] text-[#D69058]">Dúvidas frequentes</p><h2 className="mt-3 font-serif text-3xl font-semibold sm:text-4xl">Antes de começar</h2>
   <div className="mt-8 space-y-3">{faqs.map((item,i)=><details key={i} className="group rounded-xl border border-white/10 bg-[#161719] px-5 py-4"><summary className="flex cursor-pointer list-none justify-between gap-5 text-sm font-semibold">{item.title}<span className="shrink-0 text-xl text-[#D69058] transition group-open:rotate-45">+</span></summary>{item.description&&<p className="mt-4 max-w-2xl text-sm leading-7 text-[#b7afa7]">{item.description}</p>}</details>)}</div>
  </section>}
  <section className="border-t border-white/[.08] bg-[radial-gradient(ellipse_at_top,#46291e_0%,#121315_65%)] px-5 py-16 text-center sm:px-8 sm:py-24">
   <div className="mx-auto max-w-3xl"><p className="text-xs font-bold uppercase tracking-[.2em] text-[#D69058]">SAGA NEGRA · RELEASE 00</p><h2 className="mt-4 font-serif text-3xl font-semibold sm:text-5xl">Entender a história também amplia nossas possibilidades de futuro.</h2>
    <p className="mx-auto mt-4 max-w-2xl text-sm leading-7 text-[#c0b5aa]">Pré-lançamento. Receba as informações sobre a abertura das vendas e os formatos disponíveis.</p>
    <a href={primaryHref} className="mt-7 inline-flex min-h-12 items-center justify-center rounded-xl bg-[#BC6938] px-8 text-sm font-bold text-white hover:bg-[#d87b42]">{primaryLabel} ↗</a>
   </div>
  </section>
  <footer className="border-t border-white/10 px-5 py-6 text-center text-xs text-[#7f7974]">© {new Date().getFullYear()} Sagamente · SAGA NEGRA · Material de pré-lançamento. Nenhuma compra é realizada nesta página nesta fase.</footer>
 </main>
}