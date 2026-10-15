import type { SiteLandingPage, LandingSection } from '../../services/siteContent'
import {AcademyWorkHeader,AcademyWorkOffers,workInterestUrl} from '../../components/academy/AcademyWorkSales'

type Props={page:SiteLandingPage;preview?:boolean}

function findSection(page:SiteLandingPage,type:LandingSection['type']){
 return page.sections.find(s=>s.type===type)
}

export function SagaNegraBookLanding({page,preview=false}:Props){
 const benefits=findSection(page,'benefits')?.items||[]
 const themes=findSection(page,'content')?.items||[]
 const faqs=findSection(page,'faq')?.items||[]
 const primaryHref=workInterestUrl('00')
 const primaryLabel='Quero adquirir'
 return <main id="inicio" className="min-h-screen overflow-hidden bg-[#0a0b0d] text-[#f8eee4] selection:bg-[#BD6A36] selection:text-white">
  {preview&&<div className="sticky top-0 z-50 border-b border-[#E7A06C]/30 bg-[#55351f] px-4 py-2 text-center text-xs font-semibold text-[#fff4e8]">PRÉVIA INTERNA · Esta página está em rascunho e não foi lançada ao público. <a href="/admin/landings" className="ml-2 underline">Voltar ao editor</a></div>}
  <AcademyWorkHeader release="00"/>
  <section className="relative isolate overflow-hidden border-b border-[#d6a477]/10">
   <div aria-hidden="true" className="pointer-events-none absolute -right-48 -top-40 -z-10 h-[780px] w-[780px] rounded-full bg-[#74381c]/20 blur-[140px]"/>
   <div className="mx-auto grid max-w-7xl items-center gap-12 px-5 pb-16 pt-16 sm:px-8 md:pt-20 lg:grid-cols-[1.05fr_.95fr] lg:gap-20 lg:pb-24">
    <div>
     <p className="mb-5 inline-flex items-center gap-2 rounded-full border border-[#bb713f]/30 bg-[#a75c2d]/10 px-3 py-2 text-[10px] font-bold uppercase tracking-[.2em] text-[#F0AE79]"><span className="h-1.5 w-1.5 rounded-full bg-[#f0a66a]"/> {page.eyebrow||'SAGA NEGRA · RELEASE 00'}</p>
     <h1 className="max-w-3xl font-serif text-[clamp(2.7rem,6.2vw,5.7rem)] font-bold leading-[1.02] tracking-[-.045em] text-[#fff5e7]">{page.headline}</h1>
     {page.subheadline&&<p className="mt-6 max-w-xl text-base leading-8 text-[#c7c1bd] sm:text-lg">{page.subheadline}</p>}
     <div className="mt-8 flex flex-wrap items-center gap-3">
      <a className="inline-flex min-h-12 items-center justify-center rounded-xl bg-[#BF6837] px-6 text-sm font-bold text-[#fff9ef] shadow-lg shadow-black/20 transition hover:bg-[#E18246]" href={primaryHref}>{primaryLabel}<span aria-hidden="true" className="ml-2">↗</span></a>
      <a href="#previas" className="inline-flex min-h-12 items-center justify-center rounded-xl border border-white/20 px-6 text-sm font-semibold text-[#e4ddd5] transition hover:bg-white/5">Ler e ouvir uma prévia</a>
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
     <p className="relative mt-8 text-center text-[11px] tracking-widest text-[#a78f7a]">EDIÇÃO DIGITAL · SAGA NEGRA</p>
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
  <section id="previas" aria-labelledby="previews-title" className="border-b border-white/[.07] bg-[#0c0e10] px-5 py-16 sm:px-8 sm:py-20">
    <div className="mx-auto max-w-6xl">
      <p className="text-xs font-bold uppercase tracking-[.2em] text-[#D69058]">Experimente antes do lançamento</p>
      <h2 id="previews-title" className="mt-3 max-w-3xl font-serif text-3xl font-semibold leading-tight text-[#f8eee4] sm:text-4xl">Duas formas de conhecer a história.</h2>
      <p className="mt-3 max-w-3xl text-sm leading-7 text-[#bcb3aa]">Leia um trecho original do prólogo e escute aproximadamente 1 minuto e 30 segundos da narração. Amostras gratuitas e independentes dos arquivos completos.</p>
      <div className="mt-9 grid items-stretch gap-4 lg:grid-cols-2">
        <article className="flex flex-col rounded-2xl border border-[#c7906b]/25 bg-[#17181a] p-5 sm:p-7" aria-labelledby="preview-ebook-title">
          <div className="flex flex-wrap items-center justify-between gap-3"><span className="rounded-md border border-[#b87449]/35 bg-[#b87449]/10 px-2.5 py-1 text-[10px] font-bold uppercase tracking-[.15em] text-[#efb688]">Amostra do e-book</span><span className="text-xs text-[#9f9993]">Prólogo · leitura</span></div>
          <h3 id="preview-ebook-title" className="mt-5 font-serif text-2xl font-semibold text-[#ffebd2]">O preço de tentar vencer</h3>
          <div className="mt-5 space-y-4 border-l-2 border-[#c88756] pl-5 font-serif text-base leading-8 text-[#dcd0c3]">
            <p>Quanto custa construir uma vida financeiramente estável? Para algumas pessoas, a resposta começa com uma profissão, um salário e a possibilidade de guardar dinheiro. Para outras, começa muito antes do primeiro emprego: na existência ou ausência de uma casa própria na família, na qualidade da educação recebida e na segurança de poder errar sem perder tudo.</p>
            <details className="group"><summary className="cursor-pointer list-none text-xs font-semibold text-[#e5ab7b] underline decoration-[#c88756]/70 underline-offset-4 focus-visible:outline focus-visible:outline-2 focus-visible:outline-[#e5ab7b]">Continuar lendo a amostra <span aria-hidden="true" className="ml-1 inline-block transition-transform group-open:rotate-180">⌄</span></summary>
              <div className="mt-4 space-y-4">
                <p>A história financeira de uma pessoa não começa quando ela recebe seu primeiro pagamento. Começa também nas condições que encontrou ao nascer. Mas essas condições não escrevem, sozinhas, o restante de sua vida.</p>
                <p>Entre o ponto de partida e o resultado existe uma combinação de escolhas, oportunidades, riscos, conhecimentos, acontecimentos inesperados e relações de poder. É nesse espaço que se encontram os fracassos e os sucessos financeiros.</p>
                <p>Durante séculos, pessoas negras produziram riqueza em condições profundamente desiguais. Muitas foram impedidas de controlar o próprio trabalho. Outras construíram negócios, adquiriram bens, organizaram redes comerciais e financiaram projetos familiares. Houve perdas, conquistas, erros e patrimônios transmitidos entre gerações. Não existe uma única trajetória.</p>
                <p>Seria um equívoco transformar a população negra em símbolo permanente da pobreza. Também seria um equívoco apresentar exemplos individuais de enriquecimento como prova de que todas as barreiras sociais desapareceram.</p>
              </div>
            </details>
          </div>
          <p className="mt-auto pt-6 text-[11px] text-[#999188]">Trecho literal da introdução do Release 00. A obra completa será oferecida separadamente no lançamento.</p>
        </article>
        <article className="flex flex-col rounded-2xl border border-[#c7906b]/25 bg-[#17181a] p-5 sm:p-7" aria-labelledby="preview-audio-title">
          <div className="flex flex-wrap items-center justify-between gap-3"><span className="rounded-md border border-[#b87449]/35 bg-[#b87449]/10 px-2.5 py-1 text-[10px] font-bold uppercase tracking-[.15em] text-[#efb688]">Amostra do audiobook</span><span className="text-xs text-[#9f9993]">Cerca de 1min30s</span></div>
          <h3 id="preview-audio-title" className="mt-5 font-serif text-2xl font-semibold text-[#ffebd2]">Ouça a narração original</h3>
          <p className="mt-3 max-w-md text-sm leading-7 text-[#c4b9af]">Experimente o ritmo e a voz da obra. Este player reproduz apenas a amostra, sem disponibilizar o MP3 integral.</p>
          <div className="my-7 rounded-xl border border-[#d6a477]/20 bg-[#0d0f11] p-4">
            <div className="mb-3 flex items-center gap-3 text-sm font-semibold text-[#ede1d3]"><span aria-hidden="true" className="flex h-10 w-10 items-center justify-center rounded-full bg-[#ad602f]/20 text-xl text-[#e4a06d]">♫</span> Release 00 · Trecho da narração</div>
            <audio className="w-full [color-scheme:dark]" controls preload="none" src="/audio/saga-negra-release00-amostra.mp3?v=90s-20261014" aria-label="Amostra de aproximadamente 90 segundos do audiobook Entre o Fracasso e a Prosperidade">
              Seu navegador não consegue reproduzir este áudio.
            </audio>
          </div>
          <p className="mt-auto text-[11px] text-[#999188]">Amostra produzida a partir da gravação no Drive da Sagamente. A reprodução completa exigirá acesso após a compra.</p>
        </article>
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
  <AcademyWorkOffers release="00"/>
  {faqs.length>0&&<section id="perguntas" className="mx-auto max-w-4xl px-5 py-16 sm:px-8 sm:py-24"><p className="text-xs font-bold uppercase tracking-[.2em] text-[#D69058]">Dúvidas frequentes</p><h2 className="mt-3 font-serif text-3xl font-semibold sm:text-4xl">Antes de começar</h2>
   <div className="mt-8 space-y-3">{faqs.map((item,i)=><details key={i} className="group rounded-xl border border-white/10 bg-[#161719] px-5 py-4"><summary className="flex cursor-pointer list-none justify-between gap-5 text-sm font-semibold">{item.title}<span className="shrink-0 text-xl text-[#D69058] transition group-open:rotate-45">+</span></summary>{item.description&&<p className="mt-4 max-w-2xl text-sm leading-7 text-[#b7afa7]">{item.description}</p>}</details>)}</div>
  </section>}
  <section className="border-t border-white/[.08] bg-[radial-gradient(ellipse_at_top,#46291e_0%,#121315_65%)] px-5 py-16 text-center sm:px-8 sm:py-24">
   <div className="mx-auto max-w-3xl"><p className="text-xs font-bold uppercase tracking-[.2em] text-[#D69058]">SAGA NEGRA · RELEASE 00</p><h2 className="mt-4 font-serif text-3xl font-semibold sm:text-5xl">Entender a história também amplia nossas possibilidades de futuro.</h2>
    <p className="mx-auto mt-4 max-w-2xl text-sm leading-7 text-[#c0b5aa]">A obra está disponível para conhecer. Escolha o formato e receba as informações para adquirir.</p>
    <a href={primaryHref} className="mt-7 inline-flex min-h-12 items-center justify-center rounded-xl bg-[#BC6938] px-8 text-sm font-bold text-white hover:bg-[#d87b42]">{primaryLabel} ↗</a>
   </div>
  </section>
  <footer className="border-t border-white/10 px-5 py-6 text-center text-xs text-[#7f7974]">© {new Date().getFullYear()} Sagamente · SAGA NEGRA · E-book e audiobook · Informações para aquisição.</footer>
 </main>
}