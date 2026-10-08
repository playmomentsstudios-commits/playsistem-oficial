import { useState } from 'react'
import { CertificateReissueManager } from '../../components/academy/CertificateReissueManager'
import { CertificateTemplateManager } from '../../components/academy/CertificateTemplateManager'

type Tab='issuance'|'templates'
export function AdminAcademyCertificates(){
 const [tab,setTab]=useState<Tab>('issuance')
 return <div className="max-w-7xl mx-auto space-y-5">
  <div><p className="text-[10px] uppercase tracking-[.18em] text-[#A65A2A] font-bold">Academia</p><h1 className="text-2xl md:text-3xl font-bold mt-1">Certificados</h1><p className="text-sm text-gray-500 mt-1">Centralize emissões, reemissões e os modelos usados pelos cursos.</p></div>
  <div className="inline-flex rounded-xl border border-white/[.08] bg-white/[.025] p-1">
   <button onClick={()=>setTab('issuance')} className={'min-h-10 rounded-lg px-4 text-xs font-bold '+(tab==='issuance'?'bg-[#A65A2A] text-white':'text-gray-400 hover:text-white')}>Emissão</button>
   <button onClick={()=>setTab('templates')} className={'min-h-10 rounded-lg px-4 text-xs font-bold '+(tab==='templates'?'bg-[#A65A2A] text-white':'text-gray-400 hover:text-white')}>Modelos de certificados</button>
  </div>
  {tab==='issuance'?<CertificateReissueManager/>:<CertificateTemplateManager/>}
 </div>
}
