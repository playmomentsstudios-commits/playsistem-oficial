import { useEffect,useMemo,useState } from 'react'
import { portalApi } from '../../api/portal'
import { academyApi } from '../../api/academy'
import { useToast } from '../../contexts/ToastContext'

type TargetMode='all_customers'|'selected_customers'|'academy_students'|'service_customers'

export function AdminAnnouncements(){
 const toast=useToast()
 const [rows,setRows]=useState<any[]>([]),[customers,setCustomers]=useState<any[]>([]),[services,setServices]=useState<any[]>([]),[courses,setCourses]=useState<any[]>([])
 const [title,setTitle]=useState(''),[content,setContent]=useState(''),[targetMode,setTargetMode]=useState<TargetMode>('all_customers'),[selected,setSelected]=useState<string[]>([]),[reference,setReference]=useState(''),[search,setSearch]=useState(''),[saving,setSaving]=useState(false)
 const load=async()=>{const [a,c,s,co]=await Promise.all([portalApi.announcements(),portalApi.customers(),portalApi.services(true),academyApi.adminCourses()]);setRows(a);setCustomers(c);setServices(s);setCourses(co)}
 useEffect(()=>{void load().catch((e:any)=>toast(e.message,'error'))},[])
 const filteredCustomers=useMemo(()=>customers.filter(c=>!search.trim()||[c.first_name,c.last_name,c.email].join(' ').toLowerCase().includes(search.toLowerCase())),[customers,search])
 const toggle=(id:string)=>setSelected(v=>v.includes(id)?v.filter(x=>x!==id):[...v,id])
 async function create(){
  if(!title.trim()||!content.trim())return toast('Informe título e mensagem.','warning')
  if(targetMode==='selected_customers'&&!selected.length)return toast('Selecione pelo menos um cliente.','warning')
  try{setSaving(true);await portalApi.createTargetedAnnouncement({title:title.trim(),content:content.trim(),target_mode:targetMode,target_ids:selected,target_reference_id:reference||null});setTitle('');setContent('');setSelected([]);setReference('');toast('Comunicado publicado e notificações direcionadas.','success');await load()}catch(e:any){toast(e.message,'error')}finally{setSaving(false)}
 }
 const targetLabel=(a:any)=>a.target_mode==='selected_customers'?((a.recipient_ids?.length||0)+' cliente(s)'):a.target_mode==='academy_students'?'Alunos da Academia':a.target_mode==='service_customers'?'Clientes de serviço':'Todos os clientes'
 return <div className="max-w-6xl"><div className="mb-6"><p className="text-[10px] uppercase tracking-[.18em] text-[#A65A2A] font-bold">Comunicação</p><h1 className="text-2xl font-bold mt-1">Comunicados</h1><p className="text-sm text-gray-500 mt-1">Publique para todos ou direcione a mensagem ao público certo.</p></div>
  <div className="grid lg:grid-cols-[1fr_.8fr] gap-5">
   <section className="pm-surface p-5 space-y-4"><div><h2 className="font-bold">Nova publicação</h2><p className="text-xs text-gray-500 mt-1">O comunicado também gera notificação apenas para os destinatários definidos.</p></div>
    <label className="block text-xs text-gray-500">Título<input value={title} onChange={e=>setTitle(e.target.value)} className="pm-control mt-1 w-full px-3" placeholder="Ex.: Atualização importante"/></label>
    <label className="block text-xs text-gray-500">Mensagem<textarea rows={5} value={content} onChange={e=>setContent(e.target.value)} className="mt-1 w-full rounded-xl bg-black/30 border border-white/10 p-3" placeholder="Escreva uma mensagem objetiva..."/></label>
    <div><p className="text-xs text-gray-500 mb-2">Quem deve receber?</p><div className="grid sm:grid-cols-2 gap-2">{([['all_customers','Todos os clientes','Base ativa completa'],['selected_customers','Clientes específicos','Seleção manual'],['academy_students','Alunos','Todos ou por curso'],['service_customers','Clientes de serviços','Todos ou por serviço']] as const).map(([value,label,help])=><button key={value} type="button" onClick={()=>{setTargetMode(value);setSelected([]);setReference('')}} className={'text-left p-3 rounded-xl border '+(targetMode===value?'border-[#A65A2A]/40 bg-[#A65A2A]/10':'border-white/10 bg-white/[.025]')}><span className="block text-xs font-semibold">{label}</span><span className="block text-[10px] text-gray-500 mt-1">{help}</span></button>)}</div></div>
    {targetMode==='selected_customers'&&<div className="rounded-xl border border-white/10 p-3"><input value={search} onChange={e=>setSearch(e.target.value)} placeholder="Buscar cliente..." className="pm-control w-full px-3 mb-2"/><div className="max-h-52 overflow-y-auto space-y-1">{filteredCustomers.map(c=><label key={c.id} className="flex items-center gap-3 min-h-10 px-2 rounded-lg hover:bg-white/[.04] text-xs cursor-pointer"><input type="checkbox" checked={selected.includes(c.id)} onChange={()=>toggle(c.id)} className="accent-[#A65A2A]"/><span className="min-w-0"><span className="block font-medium truncate">{c.first_name} {c.last_name}</span><span className="block text-[10px] text-gray-600 truncate">{c.email}</span></span></label>)}</div><p className="text-[10px] text-[#A65A2A] mt-2">{selected.length} selecionado(s)</p></div>}
    {targetMode==='academy_students'&&<label className="block text-xs text-gray-500">Curso (opcional)<select value={reference} onChange={e=>setReference(e.target.value)} className="pm-control mt-1 w-full px-3"><option value="">Todos os alunos ativos/concluintes</option>{courses.map(c=><option key={c.id} value={c.id}>{c.title}</option>)}</select></label>}
    {targetMode==='service_customers'&&<label className="block text-xs text-gray-500">Serviço (opcional)<select value={reference} onChange={e=>setReference(e.target.value)} className="pm-control mt-1 w-full px-3"><option value="">Todos que já adquiriram serviços</option>{services.map(s=><option key={s.id} value={s.id}>{s.name}</option>)}</select></label>}
    <button disabled={saving} onClick={()=>void create()} className="min-h-11 px-5 rounded-xl bg-[#A65A2A] text-white text-sm font-bold disabled:opacity-50">{saving?'Publicando…':'Publicar comunicado'}</button>
   </section>
   <section><div className="flex items-center justify-between mb-3"><h2 className="font-bold">Publicados</h2><span className="text-xs text-gray-500">{rows.length}</span></div><div className="space-y-3 max-h-[720px] overflow-y-auto">{rows.map(a=><article key={a.id} className="pm-surface p-4"><div className="flex justify-between gap-3"><b>{a.title}</b><span className="pm-tag pm-tag-neutral shrink-0">{targetLabel(a)}</span></div><p className="text-sm text-gray-400 mt-2 whitespace-pre-wrap">{a.content}</p><p className="text-[10px] text-gray-600 mt-3">{new Date(a.published_at||a.created_at).toLocaleString('pt-BR')}</p></article>)}{!rows.length&&<p className="text-sm text-gray-500">Nenhum comunicado publicado.</p>}</div></section>
  </div>
 </div>
}