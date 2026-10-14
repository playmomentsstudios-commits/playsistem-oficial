import { useState } from 'react'
import { Link } from 'react-router-dom'
import { AcademyNavigation } from '../../components/academy/AcademyNavigation'

type Density='comfortable'|'compact'
function getDensity():Density{try{return window.localStorage.getItem('sagamente.academy.density')==='compact'?'compact':'comfortable'}catch{return 'comfortable'}}

export function AcademyPreferencesPage(){
 const [density,setDensity]=useState<Density>(getDensity)
 function saveDensity(value:Density){
  setDensity(value)
  try{window.localStorage.setItem('sagamente.academy.density',value)}catch{}
 }
 return <div className="mx-auto max-w-5xl">
  <AcademyNavigation active="preferences"/>
  <header className="mb-6">
   <p className="text-[11px] font-semibold uppercase tracking-[.17em] text-[#DFA269]">Minha experiência</p>
   <h1 className="mt-1 text-2xl font-bold text-white sm:text-3xl">Configurações da Academia</h1>
   <p className="mt-2 text-sm text-gray-400">Poucas opções, no lugar certo. Sua conta e sua experiência de aprendizagem continuam separadas.</p>
  </header>
  <div className="grid gap-3 lg:grid-cols-2">
   <section className="rounded-2xl border border-white/10 bg-[#16171A] p-5">
    <h2 className="font-semibold text-white">Visualização do catálogo</h2>
    <p className="mt-1 text-xs text-gray-400">Escolha a densidade dos cartões da Academia neste dispositivo.</p>
    <fieldset className="mt-4 flex gap-2">
     <legend className="sr-only">Densidade dos cartões</legend>
     {[{value:'comfortable' as Density,label:'Confortável'},{value:'compact' as Density,label:'Compacta'}].map(item=><label key={item.value} className={'flex flex-1 cursor-pointer items-center justify-center gap-2 rounded-xl border px-3 py-3 text-xs font-semibold '+(density===item.value?'border-[#A65A2A] bg-[#A65A2A]/15 text-[#F5B77B]':'border-white/10 text-gray-300')}>
      <input className="accent-[#A65A2A]" type="radio" name="density" checked={density===item.value} onChange={()=>saveDensity(item.value)}/>{item.label}
     </label>)}
    </fieldset>
   </section>
   <section className="rounded-2xl border border-white/10 bg-[#16171A] p-5">
    <h2 className="font-semibold text-white">Conta e segurança</h2>
    <p className="mt-1 text-xs text-gray-400">Dados pessoais, senha e preferências de notificação ficam nas configurações gerais.</p>
    <div className="mt-4 flex flex-wrap gap-3">
     <Link to="/app/perfil" className="min-h-10 rounded-lg border border-white/15 px-3 py-2 text-xs font-semibold text-gray-200">Meu perfil →</Link>
     <Link to="/app/configuracoes" className="min-h-10 rounded-lg border border-white/15 px-3 py-2 text-xs font-semibold text-gray-200">Configurações gerais →</Link>
    </div>
   </section>
   <section className="rounded-2xl border border-white/10 bg-[#16171A] p-5 lg:col-span-2">
    <h2 className="font-semibold text-white">Leitura e áudio</h2>
    <p className="mt-1 text-sm text-gray-400">O leitor de e-books e o player de audiobooks terão controles próprios de fonte, velocidade e retomada. Essas preferências serão disponibilizadas quando os formatos e o acesso pós-compra estiverem integrados; nenhuma reprodução ou compra será simulada aqui.</p>
   </section>
  </div>
 </div>
}
