import type { SiteLandingPage, LandingSection } from '../../services/siteContent'
import { BrandImage } from '../../components/BrandImage'

interface ReleaseConfig {
  release: string
  kicker: string
  question: string
  about: string
  quote: string
  quoteSource: string
  sampleHeading: string
  sample: string[]
  closing: string
  theme: string
}
const releases:Record<string,ReleaseConfig>={
 'saga-negra-o-direito-de-descansar':{
  release:'01',kicker:'O tempo também é um direito',
  question:'Quem tem a liberdade real de descansar?',
  about:'O descanso não pode ser tratado como recompensa para quem já fez tudo. Esta reflexão acompanha a história do trabalho, as garantias legais, a sobrecarga de cuidado e as condições que fazem do tempo livre uma possibilidade desigual.',
  quote:'O descanso é uma necessidade humana, não um prêmio moral.',quoteSource:'Saúde, sono e a dignidade de reconhecer limites',
  sampleHeading:'Abertura — O tempo também é um direito',
  sample:[
   'Descansar não é abandonar responsabilidades. É reconhecer que o corpo humano tem limites, que a vida não se resume ao emprego e que a dignidade também depende do tempo disponível para dormir, conviver, aprender, cuidar de si e participar da sociedade.',
   'Quando uma pessoa precisa escolher continuamente entre descansar e garantir a renda do mês, essa escolha não é inteiramente livre. Ela acontece dentro de condições materiais que precisam ser examinadas.',
   'Na experiência histórica da população negra no Brasil, o direito ao descanso não pode ser separado das relações de trabalho, da distribuição da riqueza, do acesso à moradia, do deslocamento urbano e da divisão do cuidado doméstico.'
  ],
  closing:'Viver não é apenas produzir. O tempo também faz parte da dignidade.',theme:'Tempo · Trabalho · Dignidade'
 },
 'saga-negra-amor-afeto-e-solidao-negra':{
  release:'02',kicker:'Afeto também é história',
  question:'E quando o amor negro é visto além da dor?',
  about:'A vida negra também se constrói em amizades, famílias, desejos, escolhas e redes de cuidado. Uma leitura que valoriza o pertencimento sem idealizar o sofrimento, e considera a solidão sem transformá-la em destino.',
  quote:'O amor não é uma recompensa concedida depois que todos os problemas sociais são resolvidos.',quoteSource:'Abertura — O afeto também faz parte da história',
  sampleHeading:'Abertura — O afeto também faz parte da história',
  sample:[
   'Falar da história negra é falar de liberdade, trabalho, cultura e resistência. Mas também é falar da vida que acontece quando a porta de casa se fecha: das pessoas que se procuram, das amizades que sustentam dias difíceis, dos vínculos familiares que atravessam distâncias e das formas de carinho que nem sempre recebem atenção nos livros.',
   'O amor não é uma recompensa concedida depois que todos os problemas sociais são resolvidos. É uma dimensão da existência, vivida no presente, com suas alegrias, contradições e escolhas.',
   'Existe um risco quando a narrativa sobre pessoas negras se limita à dor. A violência histórica é real e deve ser estudada com seriedade. Porém, ninguém pode ser reduzido àquilo que sofreu.'
  ],
  closing:'O direito de amar é também o direito de ser visto por inteiro.',theme:'Afeto · Relações · Pertencimento'
 },
 'saga-negra-paternidade-negra-presenca-ausencia-e-reconstrucao':{
  release:'03',kicker:'A paternidade começa na presença',
  question:'Que presença estamos construindo?',
  about:'Mais que prover, ser pai envolve aprender a cuidar. Uma reflexão cuidadosa sobre vínculos familiares, modelos de masculinidade, tempo, ausência e possibilidades reais de reconstrução — sem atribuir destinos afetivos à cor da pele.',
  quote:'Ser pai não é somente sustentar financeiramente uma casa.',quoteSource:'A paternidade começa na presença',
  sampleHeading:'A paternidade começa na presença',
  sample:[
   'O que faz de alguém um pai? A biologia pode indicar uma origem. Um registro pode estabelecer uma responsabilidade legal. Mas a experiência cotidiana de uma criança é construída também por gestos repetidos: uma conversa, uma refeição, uma pergunta feita com atenção, a disposição de acompanhar um medo, a presença nos dias difíceis.',
   'Ser pai não é somente sustentar financeiramente uma casa. É reconhecer outra pessoa como sujeito de direitos, de sentimentos e de futuro.',
   'Quando discutimos a paternidade negra no Brasil, essa afirmação aparentemente simples encontra uma história complexa. Não se trata de afirmar que homens negros sejam naturalmente mais ausentes, mais presentes ou mais capazes de cuidar.'
  ],
  closing:'Presença que protege sem dominar. Cuidado que se confirma na rotina.',theme:'Paternidade · Cuidado · Reconstrução'
 },
 'saga-negra-educacao-o-conhecimento-que-abre-portas':{
  release:'04',kicker:'Conhecer é também pertencer',
  question:'Quem tem o direito de aprender e produzir conhecimento?',
  about:'A educação é mais que um diploma: é acesso a oportunidades, reconhecimento de saberes e participação no futuro. O livro confronta barreiras históricas, permanência escolar e desigualdade digital, sem transformar superação individual em obrigação coletiva.',
  quote:'A educação começa antes da escola.',quoteSource:'Conhecer é também pertencer',
  sampleHeading:'Conhecer é também pertencer',
  sample:[
   'A educação começa antes da escola. Ela nasce nas palavras que uma criança escuta, nas perguntas que aprende a fazer, nos saberes de quem a cria e nas histórias que encontra pelo caminho.',
   'Para a população negra brasileira, estudar sempre esteve ligado a uma questão maior: quem tem o direito de produzir conhecimento, ser reconhecido por ele e participar das decisões sobre o futuro?',
   'A resposta não pode depender apenas da força de vontade de cada pessoa. O esforço individual importa, mas não substitui bibliotecas, professores valorizados, alimentação adequada, transporte, segurança e tempo para aprender.'
  ],
  closing:'O conhecimento só abre portas de verdade quando o acesso também é um direito.',theme:'Educação · Conhecimento · Oportunidades'
 },
 'saga-negra-justica-prisao-e-liberdade':{
  release:'05',kicker:'A justiça começa antes do julgamento',
  question:'Como construir segurança sem abandonar direitos?',
  about:'Uma leitura sobre a formação das instituições, a presunção de inocência, a proteção das vítimas, o encarceramento e os impactos sobre famílias. Também examina tecnologias de vigilância e transparência, mantendo o compromisso com evidências e direitos para todos.',
  quote:'Justiça não é sinônimo de impunidade, assim como rigor não é sinônimo de arbitrariedade.',quoteSource:'A justiça começa antes do julgamento',
  sampleHeading:'A justiça começa antes do julgamento',
  sample:[
   'O que significa viver em liberdade quando a própria ideia de segurança é distribuída de maneira desigual? A pergunta não se limita aos tribunais. Ela atravessa a rua, a escola, a família, o trabalho, a maneira como uma pessoa é observada em uma loja e a confiança que sente ao procurar uma instituição pública.',
   'Uma sociedade justa precisa proteger quem sofre violência, investigar os fatos com seriedade e garantir que ninguém seja tratado como culpado antes da prova.',
   'No Brasil, a discussão sobre justiça e população negra exige cuidado com duas simplificações. A primeira é imaginar que a história das pessoas negras se resume ao sofrimento. A segunda é supor que o fim jurídico da escravidão eliminou os efeitos sociais de séculos de exclusão.'
  ],
  closing:'Segurança e direitos precisam caminhar juntos.',theme:'Justiça · Direitos · Liberdade'
 }
}
export const isSagaNegraSeriesLanding=(slug:string)=>Object.prototype.hasOwnProperty.call(releases,slug)
const part=(page:SiteLandingPage,type:LandingSection['type'])=>page.sections.find(s=>s.type===type)?.items||[]
const safeHref=(link:string)=>link.startsWith('mailto:')||link.startsWith('/')||link.startsWith('https://')?link:'#formatos'

export function SagaNegraSeriesLanding({page,preview=false}:{page:SiteLandingPage;preview?:boolean}){
 const info=releases[page.slug]
 if(!info)return null
 const advantages=part(page,'benefits'),topics=part(page,'content'),offers=part(page,'proof'),faq=part(page,'faq')
 const cover=page.hero_image_url||'/images/saga-negra-release'+info.release+'-cover.svg'
 const audio='/audio/saga-negra-release'+info.release+'-amostra.mp3'
 const cta=safeHref(page.cta_href)
 return <main id="topo" className="min-h-screen overflow-hidden bg-[#0b0d10] text-[#f7efe4] selection:bg-[#B66D46] selection:text-white">
  {preview&&<div className="sticky top-0 z-50 border-b border-amber-500/30 bg-[#604122] px-4 py-2 text-center text-xs font-bold text-amber-100">PRÉVIA DO ADMINISTRADOR · Rascunho não publicado. <a className="underline" href="/admin/landings">Voltar às landings</a></div>}
  <header className="border-b border-white/10 bg-[#101114]/95">
   <div className="mx-auto flex max-w-7xl items-center justify-between gap-4 px-5 py-4 sm:px-8">
    <a href="#topo" aria-label="Sagamente, início"><BrandImage variant="dark" alt="Sagamente" className="h-9 w-auto"/></a>
    <nav aria-label="Navegação interna" className="hidden items-center gap-6 text-xs font-semibold text-[#c2b9b0] md:flex">
     <a href="#sobre" className="hover:text-white">A obra</a><a href="#previas" className="hover:text-white">Leia e ouça</a><a href="#temas" className="hover:text-white">Temas</a><a href="#formatos" className="hover:text-white">Formatos</a>
    </nav>
    <a href={cta} className="inline-flex min-h-10 items-center rounded-xl border border-[#b97749] bg-[#a45b37] px-4 text-xs font-bold text-white transition hover:bg-[#bc7348]">{page.cta_label} ↗</a>
   </div>
  </header>
  <section className="relative border-b border-white/[.07]">
   <div aria-hidden="true" className="pointer-events-none absolute -right-40 -top-24 h-[670px] w-[670px] rounded-full bg-[#ad6c3b]/10 blur-[100px]"/>
   <div className="relative mx-auto grid max-w-7xl items-center gap-12 px-5 py-16 sm:px-8 md:py-20 lg:grid-cols-[1.1fr_.9fr] lg:gap-16">
    <div className="max-w-3xl">
     <p className="mb-5 inline-flex rounded-full border border-[#b97749]/30 bg-[#ad6c3b]/10 px-3 py-2 text-[10px] font-bold uppercase tracking-[.2em] text-[#EDB78D]">SAGA NEGRA · RELEASE {info.release}</p>
     <h1 className="font-serif text-[clamp(2.7rem,5.2vw,5.2rem)] font-semibold leading-[1.07] tracking-tight text-[#fff3e4]">{page.headline}</h1>
     <p className="mt-6 max-w-xl text-base leading-8 text-[#c5bdb6] sm:text-lg">{page.subheadline}</p>
     <div className="mt-8 flex flex-wrap gap-3">
      <a href="#previas" className="inline-flex min-h-12 items-center justify-center rounded-xl bg-[#be6b3b] px-6 text-sm font-bold text-white transition hover:bg-[#d47d46]">Experimentar grátis ↗</a>
      <a href="#formatos" className="inline-flex min-h-12 items-center justify-center rounded-xl border border-white/20 px-5 text-sm font-semibold text-gray-200 hover:bg-white/5">Conhecer os formatos</a>
     </div>
     <div className="mt-8 flex flex-wrap gap-4 border-t border-white/10 pt-5 text-xs text-[#ad9c8c]"><span>✦ E-book e audiobook</span><span>✦ Duas prévias gratuitas</span><span>✦ {info.theme}</span></div>
    </div>
    <div className="relative mx-auto w-full max-w-[430px]">
     <div className="absolute inset-12 rounded-full bg-[#ad6c3b]/15 blur-[65px]" aria-hidden="true"/>
     <div className="relative mx-auto w-[79%] max-w-[320px] -rotate-[4deg] shadow-[25px_30px_55px_rgba(0,0,0,.65)] transition-transform duration-500 hover:rotate-0">
      <img src={cover} width="900" height="1200" alt={'Capa original SAGA NEGRA Release '+info.release} loading="eager" className="relative aspect-[3/4] w-full rounded-r-lg border border-[#aa825b]/30 object-cover"/>
      <div aria-hidden="true" className="absolute -right-2 top-3 h-[95%] w-2 rounded-r-sm bg-[#d6c7ad]"/>
     </div>
     <p className="relative mt-7 text-center text-[10px] uppercase tracking-widest text-[#938476]">Arte conceitual · Edição de pré-lançamento</p>
    </div>
   </div>
  </section>
  <section id="sobre" className="border-b border-white/[.07] bg-[#121417] px-5 py-16 sm:px-8 sm:py-20">
   <div className="mx-auto grid max-w-6xl gap-8 lg:grid-cols-[.85fr_1.15fr] lg:gap-16">
    <div><p className="text-[10px] font-bold uppercase tracking-[.2em] text-[#d79868]">{info.kicker}</p><h2 className="mt-3 font-serif text-3xl font-semibold leading-tight sm:text-4xl">{info.question}</h2></div>
    <div className="space-y-5 text-sm leading-8 text-[#c7bfb7] sm:text-base"><p>{info.about}</p><blockquote className="border-l-2 border-[#d89964] pl-5 font-serif text-xl italic text-[#f1d9be]">“{info.quote}”</blockquote><p className="text-xs text-[#ad9686]">{info.quoteSource} · Trecho do e-book</p></div>
   </div>
  </section>
  <section id="previas" className="mx-auto max-w-7xl px-5 py-16 sm:px-8 sm:py-24">
   <p className="text-[10px] font-bold uppercase tracking-[.2em] text-[#D99664]">Prévia gratuita da obra</p><h2 className="mt-3 max-w-3xl font-serif text-3xl font-semibold sm:text-5xl">Leia um pouco. Ouça um pouco. Descubra mais.</h2>
   <p className="mt-4 max-w-3xl text-sm leading-7 text-[#b7ada4]">As demonstrações foram preparadas a partir dos arquivos originais deste título. Não incluem o e-book ou o audiobook completo.</p>
   <div className="mt-9 grid gap-5 lg:grid-cols-2">
    <article className="flex flex-col rounded-2xl border border-[#c79168]/20 bg-[#17191c] p-5 sm:p-7">
     <div className="flex items-center justify-between gap-3"><span className="rounded-full border border-[#d29266]/30 px-3 py-1 text-[10px] font-bold uppercase tracking-wider text-[#e7b388]">Amostra de leitura</span><span className="text-xs text-[#aaa098]">E-book</span></div>
     <h3 className="mt-5 font-serif text-2xl font-semibold text-[#f6e7d2]">{info.sampleHeading}</h3>
     <p className="mt-5 border-l-2 border-[#c18a61] pl-4 font-serif text-base leading-8 text-[#d9cabe]">{info.sample[0]}</p>
     <details className="group mt-4"><summary className="cursor-pointer text-xs font-bold text-[#e4ad80] underline underline-offset-4">Continuar lendo a amostra <span aria-hidden="true" className="inline-block transition-transform group-open:rotate-180">⌄</span></summary><div className="mt-4 space-y-4 border-l-2 border-[#c18a61]/50 pl-4 font-serif text-base leading-8 text-[#d9cabe]">{info.sample.slice(1).map((paragraph,i)=><p key={i}>{paragraph}</p>)}</div></details>
     <p className="mt-auto pt-7 text-[11px] text-[#938980]">Trecho literal do PDF fornecido pelo autor. Obra integral disponível apenas após o lançamento.</p>
    </article>
    <article className="flex flex-col rounded-2xl border border-[#c79168]/20 bg-[#17191c] p-5 sm:p-7">
     <div className="flex items-center justify-between gap-3"><span className="rounded-full border border-[#d29266]/30 px-3 py-1 text-[10px] font-bold uppercase tracking-wider text-[#e7b388]">Amostra para ouvir</span><span className="text-xs text-[#aaa098]">≈ 44 segundos</span></div>
     <h3 className="mt-5 font-serif text-2xl font-semibold text-[#f6e7d2]">A narração original</h3>
     <p className="mt-3 text-sm leading-7 text-[#bdb0a5]">Escute um trecho da obra. O player contém apenas a demonstração e não oferece acesso ao MP3 original do Drive.</p>
     <div className="my-8 rounded-xl border border-white/[.08] bg-[#0d0f12] p-4"><div className="mb-3 flex items-center gap-3 text-sm text-[#ead5c3]"><span aria-hidden="true" className="inline-flex h-9 w-9 items-center justify-center rounded-full bg-[#ab6b40]/20 text-lg text-[#e3a877]">♫</span> Release {info.release} · Trecho do audiobook</div>
      <audio aria-label={'Amostra do audiobook Release '+info.release} className="w-full [color-scheme:dark]" controls preload="none" src={audio}>Seu navegador não pode reproduzir este áudio.</audio>
     </div>
     <p className="mt-auto text-[11px] text-[#938980]">Prévia independente, extraída do audiobook da Sagamente. O acesso completo exigirá autorização após a compra.</p>
    </article>
   </div>
  </section>
  {advantages.length>0&&<section id="temas" className="border-y border-white/[.07] bg-[#111316] px-5 py-16 sm:px-8 sm:py-24">
   <div className="mx-auto max-w-7xl"><p className="text-[10px] font-bold uppercase tracking-[.2em] text-[#D99664]">O que você vai explorar</p><h2 className="mt-3 font-serif text-3xl font-semibold sm:text-4xl">Questões que atravessam a história e o presente.</h2>
    <div className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">{advantages.map((item,i)=><article key={i} className="rounded-2xl border border-white/[.08] bg-[#1b1d20] p-5"><span className="font-serif text-3xl text-[#C68858]">{String(i+1).padStart(2,'0')}</span><h3 className="mt-3 text-base font-bold text-[#f4e6d5]">{item.title}</h3><p className="mt-2 text-sm leading-7 text-[#b7ada4]">{item.description}</p></article>)}</div>
   </div>
  </section>}
  {topics.length>0&&<section className="mx-auto max-w-6xl px-5 py-16 sm:px-8 sm:py-20"><p className="text-[10px] font-bold uppercase tracking-[.2em] text-[#D99664]">A trajetória do livro</p><h2 className="mt-3 font-serif text-3xl font-semibold sm:text-4xl">Um percurso de leitura com contexto.</h2><div className="mt-8 grid gap-3 md:grid-cols-2">{topics.map((item,i)=><div key={i} className="rounded-xl border border-white/[.08] bg-[#17191c] p-5"><div className="flex gap-4"><span className="shrink-0 font-serif text-2xl text-[#d6a070]">{String(i+1).padStart(2,'0')}</span><div><h3 className="font-bold">{item.title}</h3><p className="mt-2 text-sm leading-7 text-[#afa69e]">{item.description}</p></div></div></div>)}</div></section>}
  <section id="formatos" className="border-y border-white/[.07] bg-[#131518] px-5 py-16 sm:px-8 sm:py-24"><div className="mx-auto max-w-6xl"><p className="text-[10px] font-bold uppercase tracking-[.2em] text-[#D99664]">Acesso no lançamento</p><h2 className="mt-3 font-serif text-3xl font-semibold sm:text-5xl">Escolha ler, ouvir ou combinar.</h2><p className="mt-4 max-w-3xl text-sm leading-7 text-[#b5aaa0]">Valores planejados para o lançamento, ainda não disponíveis para pagamento. Quando a compra e a liberação na Minha Academia estiverem validadas, os formatos serão ativados.</p>
   <div className="mt-9 grid gap-4 md:grid-cols-3">{offers.map((item,i)=><article key={i} className={'rounded-2xl border p-6 '+(i===2?'border-[#B97042] bg-[#483024]/50':'border-white/10 bg-[#1c1e21]')}><span className="text-[10px] font-bold uppercase tracking-wider text-[#cda17c]">{i===0?'Leitura digital':i===1?'Áudio':'Dois formatos'}</span><h3 className="mt-3 text-lg font-bold">{item.title}</h3><p className="mt-3 min-h-20 text-sm leading-7 text-[#b6ada5]">{item.description}</p><a className="mt-5 inline-flex min-h-11 w-full items-center justify-center rounded-xl border border-[#b97647] px-4 text-sm font-bold text-[#efb78b] hover:bg-[#B97042]/15" href={cta}>{page.cta_label} ↗</a></article>)}</div>
   <p className="mt-5 text-xs text-[#8f8984]">O Combo Essencial inclui somente e-book e audiobook. Podcast não faz parte deste pacote.</p>
  </div></section>
  {faq.length>0&&<section id="duvidas" className="mx-auto max-w-4xl px-5 py-16 sm:px-8 sm:py-20"><p className="text-[10px] font-bold uppercase tracking-[.2em] text-[#D99664]">Perguntas frequentes</p><h2 className="mt-3 font-serif text-3xl font-semibold sm:text-4xl">Antes de começar</h2><div className="mt-7 space-y-3">{faq.map((item,i)=><details key={i} className="group rounded-xl border border-white/[.09] bg-[#17191c] p-5"><summary className="flex cursor-pointer list-none justify-between gap-4 text-sm font-bold">{item.title}<span aria-hidden="true" className="text-lg text-[#dda174]">+</span></summary><p className="mt-4 text-sm leading-7 text-[#b8aea5]">{item.description}</p></details>)}</div></section>}
  <section className="border-t border-white/[.07] bg-[radial-gradient(ellipse_at_top,#493021_0%,#121417_70%)] px-5 py-16 text-center sm:px-8 sm:py-24"><div className="mx-auto max-w-3xl"><p className="text-[10px] font-bold uppercase tracking-[.2em] text-[#dda174]">SAGA NEGRA · RELEASE {info.release}</p><h2 className="mt-4 font-serif text-3xl font-semibold sm:text-5xl">{info.closing}</h2><p className="mx-auto mt-5 max-w-xl text-sm leading-7 text-[#b9aca0]">Acompanhe a preparação do lançamento. A página permanece em pré-lançamento e nenhuma compra será realizada agora.</p><a href={cta} className="mt-7 inline-flex min-h-12 items-center justify-center rounded-xl bg-[#b96538] px-8 text-sm font-bold hover:bg-[#d77f48]">{page.cta_label} ↗</a></div></section>
  <footer className="border-t border-white/[.08] px-5 py-7 text-center text-xs text-[#8c8177]">© {new Date().getFullYear()} Sagamente · SAGA NEGRA · Pré-lançamento · Sem checkout nesta página.</footer>
 </main>
}
