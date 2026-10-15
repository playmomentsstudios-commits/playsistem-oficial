import {useState} from 'react'
import {Link} from 'react-router-dom'
import {useAuth} from '../../contexts/AuthContext'
import {AdminAcademy} from './AdminAcademy'
import {AdminAcademyLibrary} from '../../components/academy/AdminAcademyLibrary'

export function AdminAcademyHub(){
 const {user}=useAuth()
 const isAdmin=user?.role==='admin'
 const [section,setSection]=useState<'library'|'courses'>(isAdmin?'library':'courses')
 const tabs=([['library','E-books e audiobooks'],['courses','Cursos e aulas']] as const)
 return <div className="max-w-7xl mx-auto">
  <header className="mb-5 flex flex-wrap items-start justify-between gap-3">
   <div><p className="text-[10px] font-bold uppercase tracking-[.18em] text-[#A65A2A]">Academia Sagamente</p>
    <h1 className="mt-1 text-2xl font-bold">Gestão de conteúdo</h1>
    <p className="mt-1 text-xs text-gray-500">Biblioteca digital, cursos, alunos e páginas de apresentação.</p>
   </div>
   <div className="flex flex-wrap gap-2">
    <Link to="/admin/academia/alunos" className="min-h-10 rounded-xl border border-white/10 px-3 py-2.5 text-xs font-semibold text-gray-300">Alunos</Link>
    {isAdmin&&<Link to="/admin/landings" className="min-h-10 rounded-xl border border-white/10 px-3 py-2.5 text-xs font-semibold text-gray-300">Landing pages</Link>}
   </div>
  </header>
  <div className="mb-5 flex gap-2 overflow-x-auto border-b border-white/10 pb-3" aria-label="Seções da gestão de conteúdo">
   {tabs.filter(([key])=>key!=='library'||isAdmin).map(([key,label])=>
    <button type="button" key={key} aria-pressed={section===key} onClick={()=>setSection(key)}
     className={'min-h-11 shrink-0 rounded-xl px-4 text-xs font-bold '+(section===key?'bg-[#A65A2A] text-white':'border border-white/10 bg-white/[.025] text-gray-300')}>{label}</button>)}
  </div>
  {section==='library'&&isAdmin?<AdminAcademyLibrary/>:<AdminAcademy/>}
 </div>
}
