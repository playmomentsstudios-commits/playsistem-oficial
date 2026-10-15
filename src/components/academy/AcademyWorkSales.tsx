import {useEffect,useState} from 'react'
import {Link} from 'react-router-dom'
import {BrandImage} from '../BrandImage'
import {supabase} from '../../lib/supabase'
import {academyComboSavings,formatAcademyMoney as money,type AcademyWorkPrice} from '../../lib/academyPricing'
import './academyWorkSales.css'

const action='inline-flex min-h-11 items-center justify-center rounded-xl bg-[#B66B3C] px-5 py-3 text-sm font-bold text-white transition hover:bg-[#cf8655]'

export const workInterestUrl=(release:string,format?:'ebook'|'audiobook'|'combo')=>
 '/academia/comprar/'+encodeURIComponent(release)+(format?'?formato='+format:'')

export function ComboDiscountBadge({percentage,compact=false}:{percentage:string;compact?:boolean}){
 return <span aria-label={percentage+'% de desconto em relação aos formatos separados'}
  className={'inline-flex max-w-full items-center justify-center rounded-full border border-[#ffcf9c]/40 bg-[#ed9b59] font-extrabold leading-4 text-[#24150d] shadow-sm '+(compact?'px-2 py-0.5 text-[10px]':'px-3 py-1.5 text-[11px]')}>
  {compact?'−'+percentage+'%':percentage+'% de desconto'}
 </span>
}

export function AcademyWorkHeader({release}:{release:string}){
 return <header className="sticky top-0 z-40 border-b border-white/10 bg-[#101114]/95 shadow-lg shadow-black/10 backdrop-blur-md">
  <div className="mx-auto flex max-w-7xl items-center justify-between gap-3 px-4 py-3 sm:px-8">
   <Link to="/academia" aria-label="Voltar à Academia Sagamente" className="shrink-0">
    <BrandImage variant="compact" alt="Sagamente" className="h-8 w-auto sm:hidden"/>
    <BrandImage variant="dark" alt="Sagamente" className="hidden h-9 w-auto sm:block"/>
   </Link>
   <nav aria-label="Navegação da obra" className="flex items-center gap-2 sm:gap-4">
    <Link to="/academia#obras-digitais" aria-label="Todas as obras" className="inline-flex min-h-11 min-w-11 items-center justify-center rounded-xl px-2 text-xs font-semibold text-[#d3b29a] hover:text-white"><span className="sm:hidden" aria-hidden="true">←</span><span className="hidden sm:inline">← Todas as obras</span></Link>
    <a href="#previas" className="hidden text-xs font-semibold text-[#d3b29a] hover:text-white sm:inline">Amostras</a>
    <Link to={workInterestUrl(release)} className={'academy-purchase-cta whitespace-nowrap '+action}>Quero adquirir</Link>
   </nav>
  </div>
 </header>
}

export function AcademyWorkOffers({
 release,ebook=true,audiobook=true
}:{release:string;ebook?:boolean;audiobook?:boolean}){
 const [price,setPrice]=useState<AcademyWorkPrice|null>(null)
 useEffect(()=>{
  let active=true
  setPrice(null)
  void (async()=>{
   try{
    const {data,error}=await supabase.rpc('academy_public_work_prices')
    if(active&&!error)setPrice((data||[]).find((row:AcademyWorkPrice)=>row.release_code===release)||null)
   }catch{if(active)setPrice(null)}
  })()
  return()=>{active=false}
 },[release])
 const savings=academyComboSavings(price)
 const choices=[
  ...(ebook?[{format:'ebook' as const,label:'E-book',headline:'Para quem prefere ler',copy:'Leia a obra no seu ritmo, em formato digital.',icon:'▤'}]:[]),
  ...(audiobook?[{format:'audiobook' as const,label:'Audiobook',headline:'Para quem prefere ouvir',copy:'Acompanhe a narração da obra onde estiver.',icon:'♫'}]:[]),
  ...(ebook&&audiobook?[{format:'combo' as const,label:'Combo: ler + ouvir',headline:'A experiência completa',copy:'Os dois formatos da mesma obra em uma única escolha.',icon:'✦'}]:[]),
 ]
 return <section id="formatos" className="scroll-mt-24 border-y border-white/10 bg-[#131518] px-5 py-16 sm:px-8 sm:py-24">
  <div className="mx-auto max-w-6xl">
   <p className="text-xs font-bold uppercase tracking-[.2em] text-[#D99664]">Escolha seu formato</p>
   <h2 className="mt-3 font-serif text-3xl font-semibold leading-tight text-[#fff3e6] sm:text-5xl">Uma obra. A experiência que combina com você.</h2>
   <p className="mt-4 max-w-3xl text-sm leading-7 text-[#b9afa6]">Escolha seu formato, crie sua conta ou entre e pague com Pix na página segura da InfinitePay.</p>
   <div className={'mt-9 grid gap-4 '+(choices.length===3?'md:grid-cols-3':'sm:grid-cols-2')}>{choices.map(offer=>
    <article key={offer.format} className={'flex flex-col rounded-2xl border p-6 '+(offer.format==='combo'?'border-[#B97042] bg-[#493021]/45':'border-white/10 bg-[#1c1e21]')}>
     <div className="flex flex-wrap items-center justify-between gap-3">
      <span className="text-3xl text-[#f0b88d]">{offer.icon}</span>
      {offer.format==='combo'&&savings&&<ComboDiscountBadge percentage={savings.percentage}/>}
     </div>
     <p className="mt-5 text-[10px] font-bold uppercase tracking-[.15em] text-[#cda17c]">{offer.headline}</p>
     <h3 className="mt-2 text-xl font-bold text-[#fdf2e7]">{offer.label}</h3>
     <p className="mt-3 flex-1 text-sm leading-7 text-[#bfb3a9]">{offer.copy}</p>
     {price&&<div className="mt-5 space-y-1">
      {offer.format==='combo'&&savings&&<p className="text-xs text-[#c6ac99]">Separados: <del>{money(savings.separateCents)}</del></p>}
      <p className="text-3xl font-extrabold tabular-nums text-[#ffe2c7]">
       {money(offer.format==='ebook'?price.ebook_cents:offer.format==='audiobook'?price.audiobook_cents:price.combo_cents)}
      </p>
      {offer.format==='combo'&&savings&&<p className="text-xs font-semibold text-[#efb37f]">Economize {money(savings.savingCents)}</p>}
     </div>}
     <Link to={workInterestUrl(release,offer.format)} className={'mt-6 w-full '+action}>
      {offer.format==='ebook'?'Quero o e-book':offer.format==='audiobook'?'Quero o audiobook':'Quero o combo'} →
     </Link>
    </article>
   )}</div>
   <p className="mt-5 text-xs leading-6 text-[#9e948b]">Após a confirmação do pagamento e do seu e-mail, a obra fica disponível na Minha Academia.</p>
  </div>
 </section>
}
