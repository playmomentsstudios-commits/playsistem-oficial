import { useEffect, useMemo, useState } from 'react'
import { academyApi } from '../../api/academy'
import { useToast } from '../../contexts/ToastContext'

const statusLabel:Record<string,string>={active:'Ativa',completed:'Concluída',cancelled:'Cancelada',inactive:'Inativo',blocked:'Bloqueado'}
export function AdminAcademyStudents(){
 const toast=useToast(); const [rows,setRows]=useState<any[]>([]); const [loading,setLoading]=useState(true); const [query,setQuery]=useState(''); const [selected,setSelected]=useState<any|null>(null)
 useEffect(()=>{academyApi.academicStudents().then(setRows).catch((e:any)=>toast(e.message,'error')).finally(()=>setLoading(false))},[])
 const students=useMemo(()=>{const grouped=new Map<string,any>();for(const r of rows){const id=r.student?.id||r.student_id;if(!id)continue;const current=grouped.get(id)||{id,ra:r.student?.academic_record,status:r.student?.status,profile:r.user,enrollments:[]};current.enrollments.push(r);grouped.set(id,current)}return [...grouped.values()]},[rows])
 const filtered=students.filter(s=>{const name=[s.profile?.first_name,s.profile?.last_name].filter(Boolean).join(' ');return [name,s.profile?.email,s.ra].join(' ').toLowerCase().includes(query.toLowerCase())})
 const open=(s:any)=>setSelected(s)
 if(loading)return <div className="p-6 text-sm text-gray-500">Carregando vida acadêmica...</div>
 return <div className="p-4 md:p-6 space-y-5">
  <div><p className="text-xs uppercase tracking-[.2em] text-[#E30613] font-bold">Academia</p><h1 className="text-2xl font-bold">Alunos acadêmicos</h1><p className="text-sm text-gray-500">RA, matrículas, matrizes, ofertas, progresso e histórico em uma visão única.</p></div>
  <div className="grid grid-cols-3 gap-3">{[['Alunos',students.length],['Matrículas',rows.length],['Concluídas',rows.filter(r=>r.status==='completed').length]].map(([l,v])=><div key={String(l)} className="rounded-xl border bg-white p-4"><div className="text-xs text-gray-500">{l}</div><div className="text-2xl font-bold">{v}</div></div>)}</div>
  <input value={query} onChange={e=>setQuery(e.target.value)} placeholder="Buscar por nome, e-mail ou RA" className="w-full rounded-xl border px-4 py-3 bg-white" />
  <div className="grid lg:grid-cols-[360px_1fr] gap-4">
   <div className="space-y-2">{filtered.map(s=>{const name=[s.profile?.first_name,s.profile?.last_name].filter(Boolean).join(' ')||s.profile?.email||'Aluno';return <button key={s.id} onClick={()=>open(s)} className={'w-full text-left rounded-xl border p-4 bg-white '+(selected?.id===s.id?'border-[#E30613] ring-1 ring-[#E30613]':'')}><div className="font-semibold">{name}</div><div className="text-xs text-gray-500">{s.ra} · {s.enrollments.length} matrícula(s)</div></button>})}</div>
   <div className="rounded-xl border bg-white p-5">{!selected?<div className="text-sm text-gray-500">Selecione um aluno para abrir a vida acadêmica.</div>:<StudentDetail student={selected}/>}</div>
  </div>
 </div>
}
function StudentDetail({student}:any){
 const name=[student.profile?.first_name,student.profile?.last_name].filter(Boolean).join(' ')||student.profile?.email||'Aluno'
 return <div className="space-y-5"><div><h2 className="text-xl font-bold">{name}</h2><div className="text-sm text-gray-500">{student.profile?.email}</div><div className="mt-2 inline-flex rounded-full bg-gray-100 px-3 py-1 text-xs font-semibold">{student.ra}</div></div>
 <div className="space-y-3">{student.enrollments.map((e:any)=><div key={e.id} className="rounded-xl border p-4"><div className="flex flex-wrap justify-between gap-2"><div><div className="font-semibold">{e.course?.title}</div><div className="text-xs text-gray-500">{e.enrollment_number}</div></div><span className="text-xs font-semibold">{statusLabel[e.status]||e.status}</span></div><div className="mt-3 grid sm:grid-cols-2 gap-2 text-sm"><div><b>Matriz:</b> {e.curriculum?.name||'—'}</div><div><b>Oferta:</b> {e.offering?.name||'—'}</div><div><b>Progresso:</b> {e.progress_percent??0}%</div><div><b>Nota final:</b> {e.final_grade??'—'}</div><div><b>Frequência:</b> {e.attendance_percent!=null?e.attendance_percent+'%':'—'}</div><div><b>Origem:</b> {e.origin||e.source||'—'}</div></div>{e.events?.length?<div className="mt-4 border-t pt-3"><div className="text-xs font-bold uppercase text-gray-500 mb-2">Histórico</div>{e.events.map((ev:any)=><div key={ev.id} className="text-sm py-1">{ev.title} <span className="text-xs text-gray-400">· {new Date(ev.occurred_at).toLocaleDateString('pt-BR')}</span></div>)}</div>:null}</div>)}</div></div>
}
