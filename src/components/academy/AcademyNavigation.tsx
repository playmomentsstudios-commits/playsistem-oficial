import { Link } from 'react-router-dom'

type AcademySection='catalog'|'mine'|'preferences'

const sections:{key:AcademySection;label:string;href:string}[]=[
 {key:'catalog',label:'Academia',href:'/app/academia/catalogo'},
 {key:'mine',label:'Minha Academia',href:'/app/academia'},
 {key:'preferences',label:'Configurações',href:'/app/academia/preferencias'},
]

export function AcademyNavigation({active}:{active:AcademySection}){
 return <nav aria-label="Navegação da Academia" className="mb-5 flex flex-wrap items-center gap-1 border-b border-white/10">
  {sections.map(section=><Link key={section.key} to={section.href} aria-current={active===section.key?'page':undefined}
   className={'relative -mb-px inline-flex min-h-11 items-center rounded-t-xl border px-4 py-2 text-sm font-semibold transition-colors '+(active===section.key?'border-[#A65A2A]/50 border-b-[#121214] bg-[#A65A2A]/15 text-[#F6B577]':'border-transparent text-gray-400 hover:bg-white/[.04] hover:text-white')}>
   {section.label}
  </Link>)}
 </nav>
}
