import {Link} from 'react-router-dom'
import {BrandImage} from '../BrandImage'

const action='inline-flex min-h-11 items-center justify-center rounded-xl bg-[#B66B3C] px-5 py-3 text-sm font-bold text-white transition hover:bg-[#cf8655]'

export const workInterestUrl=(release:string,format?:'ebook'|'audiobook'|'combo')=>
 '/academia/interesse/'+encodeURIComponent(release)+(format?'?formato='+format:'')

export function AcademyWorkHeader({release}:{release:string}){
 return <header className="border-b border-white/10 bg-[#101114]/95">
  <div className="mx-auto flex max-w-7xl items-center justify-between gap-3 px-4 py-4 sm:px-8">
   <Link to="/academia" aria-label="Voltar à Academia Sagamente"><BrandImage variant="dark" alt="Sagamente" className="h-8 w-auto sm:h-9"/></Link>
   <nav aria-label="Navegação da obra" className="flex items-center gap-2 sm:gap-4">
    <Link to="/academia#obras-digitais" className="inline-flex min-h-10 items-center rounded-xl px-2 text-xs font-semibold text-[#d3b29a] hover:text-white">← Todas as obras</Link>
    <a href="#previas" className="hidden text-xs font-semibold text-[#d3b29a] hover:text-white sm:inline">Amostras</a>
    <Link to={workInterestUrl(release)} className={action}>Quero adquirir</Link>
   </nav>
  </div>
 </header>
}

export function AcademyWorkOffers({
 release,ebook=true,audiobook=true
}:{release:string;ebook?:boolean;audiobook?:boolean}){
 const choices=[
  ...(ebook?[{format:'ebook' as const,label:'E-book',headline:'Para quem prefere ler',copy:'Leia a obra no seu ritmo, em formato digital.',icon:'▤'}]:[]),
  ...(audiobook?[{format:'audiobook' as const,label:'Audiobook',headline:'Para quem prefere ouvir',copy:'Acompanhe a narração da obra onde estiver.',icon:'♫'}]:[]),
  ...(ebook&&audiobook?[{format:'combo' as const,label:'Combo: ler + ouvir',headline:'A experiência completa',copy:'Os dois formatos da mesma obra em uma única escolha.',icon:'✦'}]:[]),
 ]
 return <section id="formatos" className="scroll-mt-24 border-y border-white/10 bg-[#131518] px-5 py-16 sm:px-8 sm:py-24">
  <div className="mx-auto max-w-6xl">
   <p className="text-xs font-bold uppercase tracking-[.2em] text-[#D99664]">Escolha seu formato</p>
   <h2 className="mt-3 font-serif text-3xl font-semibold leading-tight text-[#fff3e6] sm:text-5xl">Uma obra. A experiência que combina com você.</h2>
   <p className="mt-4 max-w-3xl text-sm leading-7 text-[#b9afa6]">Escolha a sua opção e informe o WhatsApp. Nossa equipe apresenta as condições de compra e orienta como acessar a obra na Academia Sagamente.</p>
   <div className={'mt-9 grid gap-4 '+(choices.length===3?'md:grid-cols-3':'sm:grid-cols-2')}>{choices.map((offer,i)=>
    <article key={offer.format} className={'flex flex-col rounded-2xl border p-6 '+(offer.format==='combo'?'border-[#B97042] bg-[#493021]/45':'border-white/10 bg-[#1c1e21]')}>
     <span className="text-3xl text-[#f0b88d]">{offer.icon}</span>
     <p className="mt-5 text-[10px] font-bold uppercase tracking-[.15em] text-[#cda17c]">{offer.headline}</p>
     <h3 className="mt-2 text-xl font-bold text-[#fdf2e7]">{offer.label}</h3>
     <p className="mt-3 flex-1 text-sm leading-7 text-[#bfb3a9]">{offer.copy}</p>
     <Link to={workInterestUrl(release,offer.format)} className={'mt-6 w-full '+action}>
      {offer.format==='ebook'?'Quero o e-book':offer.format==='audiobook'?'Quero o audiobook':'Quero o combo'} →
     </Link>
    </article>
   )}</div>
   <p className="mt-5 text-xs leading-6 text-[#9e948b]">O envio do interesse não realiza cobrança nem libera os arquivos automaticamente. Você recebe orientações antes de decidir.</p>
  </div>
 </section>
}
