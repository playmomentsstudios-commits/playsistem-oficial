import { useEffect,useMemo,useState } from 'react'
import { Link } from 'react-router-dom'
import { portalApi } from '../../api/portal'
import { prioridade,rotulo,statusTarefa } from '../../lib/labels.ptBR'

const columns=[
  {key:'pending',label:'Pendente'},
  {key:'in_progress',label:'Em andamento'},
  {key:'review',label:'Revisão'},
  {key:'completed',label:'Concluída'},
]

export function AdminProductivity(){
  const [projects,setProjects]=useState<any[]>([])
  const [team,setTeam]=useState<any[]>([])
  const [loading,setLoading]=useState(true)
  const [view,setView]=useState<'kanban'|'lista'>('kanban')
  const [projectFilter,setProjectFilter]=useState('todos')
  const [assigneeFilter,setAssigneeFilter]=useState('todos')
  const [priorityFilter,setPriorityFilter]=useState('todos')
  const [search,setSearch]=useState('')

  const load=async()=>{
    const [p,t]=await Promise.all([portalApi.projects(),portalApi.teamMembers()])
    setProjects(p)
    setTeam(t)
    setLoading(false)
  }

  useEffect(()=>{void load()},[])

  const tasks=useMemo(()=>projects.flatMap(project=>(project.tasks||[]).map((task:any)=>({...task,projectTitle:project.title,projectId:project.id}))),[projects])

  const filtered=useMemo(()=>tasks.filter((task:any)=>{
    if(task.status==='cancelled')return false
    const matchesProject=projectFilter==='todos'||task.projectId===projectFilter
    const matchesAssignee=assigneeFilter==='todos'||(assigneeFilter==='sem_responsavel'?!task.assigned_to:task.assigned_to===assigneeFilter)
    const matchesPriority=priorityFilter==='todos'||task.priority===priorityFilter
    const matchesSearch=!search.trim()||(task.title||'').toLowerCase().includes(search.toLowerCase())||(task.projectTitle||'').toLowerCase().includes(search.toLowerCase())
    return matchesProject&&matchesAssignee&&matchesPriority&&matchesSearch
  }),[tasks,projectFilter,assigneeFilter,priorityFilter,search])

  const today=new Date().toISOString().slice(0,10)
  const overdue=filtered.filter((task:any)=>task.due_date&&task.due_date<today&&task.status!=='completed').length
  const dueToday=filtered.filter((task:any)=>task.due_date===today&&task.status!=='completed').length
  const inProgress=filtered.filter((task:any)=>task.status==='in_progress').length
  const review=filtered.filter((task:any)=>task.status==='review').length

  async function changeStatus(id:string,status:string){
    await portalApi.saveTask({status,completed_at:status==='completed'?new Date().toISOString():null},id)
    await load()
  }

  function assigneeName(id?:string|null){
    const member=team.find(item=>item.id===id)
    return member?member.first_name+' '+member.last_name:'Sem responsável'
  }

  return <div>
    <div className="flex flex-wrap justify-between items-end gap-4 mb-6">
      <div>
        <h1 className="text-2xl font-bold">Produtividade</h1>
        <p className="text-sm text-gray-500">Visão operacional de tarefas e prazos</p>
      </div>
      <div className="flex gap-2">
        <button onClick={()=>setView('kanban')} className={'px-3 py-2 rounded-xl text-sm '+(view==='kanban'?'bg-[#E30613]':'bg-white/5')}>Kanban</button>
        <button onClick={()=>setView('lista')} className={'px-3 py-2 rounded-xl text-sm '+(view==='lista'?'bg-[#E30613]':'bg-white/5')}>Lista</button>
      </div>
    </div>

    <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mb-5">
      <div className="p-4 rounded-2xl bg-[#141416] border border-white/10"><p className="text-xs text-gray-500">Para hoje</p><b className="text-2xl">{dueToday}</b></div>
      <div className="p-4 rounded-2xl bg-[#141416] border border-white/10"><p className="text-xs text-gray-500">Atrasadas</p><b className="text-2xl text-red-400">{overdue}</b></div>
      <div className="p-4 rounded-2xl bg-[#141416] border border-white/10"><p className="text-xs text-gray-500">Em andamento</p><b className="text-2xl">{inProgress}</b></div>
      <div className="p-4 rounded-2xl bg-[#141416] border border-white/10"><p className="text-xs text-gray-500">Em revisão</p><b className="text-2xl">{review}</b></div>
    </div>

    <div className="flex flex-wrap gap-2 mb-5">
      <input value={search} onChange={e=>setSearch(e.target.value)} placeholder="Buscar tarefa ou projeto..." className="px-3 py-2 rounded-xl bg-white/5 border border-white/10"/>
      <select value={projectFilter} onChange={e=>setProjectFilter(e.target.value)} className="px-3 py-2 rounded-xl bg-black border border-white/10"><option value="todos">Todos os projetos</option>{projects.map(project=><option key={project.id} value={project.id}>{project.title}</option>)}</select>
      <select value={assigneeFilter} onChange={e=>setAssigneeFilter(e.target.value)} className="px-3 py-2 rounded-xl bg-black border border-white/10"><option value="todos">Todos os responsáveis</option><option value="sem_responsavel">Sem responsável</option>{team.map(member=><option key={member.id} value={member.id}>{member.first_name} {member.last_name}</option>)}</select>
      <select value={priorityFilter} onChange={e=>setPriorityFilter(e.target.value)} className="px-3 py-2 rounded-xl bg-black border border-white/10"><option value="todos">Todas as prioridades</option>{['low','medium','high','urgent'].map(value=><option key={value} value={value}>{rotulo(prioridade,value)}</option>)}</select>
    </div>

    {loading?<p className="text-gray-400">Carregando...</p>:view==='kanban'?<div className="grid xl:grid-cols-4 gap-3">{columns.map(column=><section key={column.key} className="rounded-2xl bg-[#101012] border border-white/10 min-h-56">
      <div className="p-3 border-b border-white/10 flex justify-between"><b>{column.label}</b><span className="text-xs text-gray-500">{filtered.filter((task:any)=>task.status===column.key).length}</span></div>
      <div className="p-3 space-y-2">{filtered.filter((task:any)=>task.status===column.key).map((task:any)=><div key={task.id} className="p-3 rounded-xl bg-[#1a1a1e] border border-white/5">
        <Link to={'/admin/projetos/'+task.projectId} className="font-semibold text-sm">{task.title}</Link>
        <p className="text-xs text-gray-500 mt-1">{task.projectTitle}</p>
        <p className="text-xs text-gray-500 mt-1">{assigneeName(task.assigned_to)} · {rotulo(prioridade,task.priority)}</p>
        {task.due_date&&<p className={'text-xs mt-1 '+(task.due_date<today&&task.status!=='completed'?'text-red-400':'text-gray-500')}>Prazo: {new Date(task.due_date+'T12:00').toLocaleDateString('pt-BR')}</p>}
        <select value={task.status} onChange={e=>changeStatus(task.id,e.target.value)} className="mt-3 w-full px-2 py-1.5 rounded-lg bg-black border border-white/10 text-xs">{columns.map(option=><option key={option.key} value={option.key}>{option.label}</option>)}</select>
      </div>)}</div>
    </section>)}</div>:<div className="space-y-2">{filtered.map((task:any)=><div key={task.id} className="p-4 rounded-2xl bg-[#141416] border border-white/10 flex flex-wrap justify-between gap-3">
      <div><Link to={'/admin/projetos/'+task.projectId} className="font-semibold">{task.title}</Link><p className="text-xs text-gray-500">{task.projectTitle} · {assigneeName(task.assigned_to)}</p></div>
      <div className="flex items-center gap-3"><span className="text-xs">{rotulo(prioridade,task.priority)}</span><span className="text-xs">{rotulo(statusTarefa,task.status)}</span>{task.due_date&&<span className="text-xs text-gray-500">{new Date(task.due_date+'T12:00').toLocaleDateString('pt-BR')}</span>}</div>
    </div>)}</div>}
  </div>
}
