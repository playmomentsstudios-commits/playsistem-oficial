import { useEffect,useMemo,useState } from 'react'
import { Link } from 'react-router-dom'
import { portalApi } from '../../api/portal'
import { prioridade,rotulo,statusTarefa } from '../../lib/labels.ptBR'

const columns=[
  {key:'pending',label:'Pendente',accent:'border-red-500/40 bg-red-500/5',badge:'bg-red-500/15 text-red-300'},
  {key:'in_progress',label:'Em andamento',accent:'border-blue-500/40 bg-blue-500/5',badge:'bg-blue-500/15 text-blue-300'},
  {key:'review',label:'Revisão',accent:'border-yellow-500/40 bg-yellow-500/5',badge:'bg-yellow-500/15 text-yellow-300'},
  {key:'completed',label:'Concluída',accent:'border-green-500/40 bg-green-500/5',badge:'bg-green-500/15 text-green-300'},
]

const statusStyle:Record<string,string>={
  pending:'border-red-500/40 bg-red-500/10',
  in_progress:'border-blue-500/40 bg-blue-500/10',
  review:'border-yellow-500/40 bg-yellow-500/10',
  completed:'border-green-500/40 bg-green-500/10',
}

function isoDate(date:Date){
  const year=date.getFullYear()
  const month=String(date.getMonth()+1).padStart(2,'0')
  const day=String(date.getDate()).padStart(2,'0')
  return year+'-'+month+'-'+day
}

function monthCells(month:Date){
  const first=new Date(month.getFullYear(),month.getMonth(),1)
  const last=new Date(month.getFullYear(),month.getMonth()+1,0)
  const leading=first.getDay()
  const total=Math.ceil((leading+last.getDate())/7)*7
  return Array.from({length:total},(_,index)=>{
    const day=index-leading+1
    return new Date(month.getFullYear(),month.getMonth(),day)
  })
}

export function AdminProductivity(){
  const [projects,setProjects]=useState<any[]>([])
  const [team,setTeam]=useState<any[]>([])
  const [loading,setLoading]=useState(true)
  const [view,setView]=useState<'kanban'|'lista'|'calendario'>('kanban')
  const [projectFilter,setProjectFilter]=useState('todos')
  const [assigneeFilter,setAssigneeFilter]=useState('todos')
  const [priorityFilter,setPriorityFilter]=useState('todos')
  const [search,setSearch]=useState('')
  const [calendarMonth,setCalendarMonth]=useState(()=>new Date(new Date().getFullYear(),new Date().getMonth(),1))
  const [selectedDate,setSelectedDate]=useState(()=>isoDate(new Date()))

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

  const today=isoDate(new Date())
  const overdue=filtered.filter((task:any)=>task.due_date&&task.due_date<today&&task.status!=='completed').length
  const dueToday=filtered.filter((task:any)=>task.due_date===today&&task.status!=='completed').length
  const inProgress=filtered.filter((task:any)=>task.status==='in_progress').length
  const review=filtered.filter((task:any)=>task.status==='review').length
  const cells=useMemo(()=>monthCells(calendarMonth),[calendarMonth])
  const selectedTasks=filtered.filter((task:any)=>task.due_date===selectedDate)

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
        <p className="text-sm text-gray-500">Visão operacional de tarefas, prazos e entregas</p>
      </div>
      <div className="flex flex-wrap gap-2">
        {(['kanban','lista','calendario'] as const).map(option=><button key={option} onClick={()=>setView(option)} className={'px-3 py-2 rounded-xl text-sm '+(view===option?'bg-[#E30613]':'bg-white/5')}>{option==='kanban'?'Kanban':option==='lista'?'Lista':'Calendário'}</button>)}
      </div>
    </div>

    <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mb-5">
      <div className="p-4 rounded-2xl bg-[#141416] border border-white/10"><p className="text-xs text-gray-500">Para hoje</p><b className="text-2xl">{dueToday}</b></div>
      <div className="p-4 rounded-2xl bg-[#141416] border border-white/10"><p className="text-xs text-gray-500">Atrasadas</p><b className="text-2xl text-red-400">{overdue}</b></div>
      <div className="p-4 rounded-2xl bg-[#141416] border border-white/10"><p className="text-xs text-gray-500">Em andamento</p><b className="text-2xl text-blue-300">{inProgress}</b></div>
      <div className="p-4 rounded-2xl bg-[#141416] border border-white/10"><p className="text-xs text-gray-500">Em revisão</p><b className="text-2xl text-yellow-300">{review}</b></div>
    </div>

    <div className="flex flex-wrap gap-2 mb-5">
      <input value={search} onChange={e=>setSearch(e.target.value)} placeholder="Buscar tarefa ou projeto..." className="px-3 py-2 rounded-xl bg-white/5 border border-white/10"/>
      <select value={projectFilter} onChange={e=>setProjectFilter(e.target.value)} className="px-3 py-2 rounded-xl bg-black border border-white/10"><option value="todos">Todos os projetos</option>{projects.map(project=><option key={project.id} value={project.id}>{project.title}</option>)}</select>
      <select value={assigneeFilter} onChange={e=>setAssigneeFilter(e.target.value)} className="px-3 py-2 rounded-xl bg-black border border-white/10"><option value="todos">Todos os responsáveis</option><option value="sem_responsavel">Sem responsável</option>{team.map(member=><option key={member.id} value={member.id}>{member.first_name} {member.last_name}</option>)}</select>
      <select value={priorityFilter} onChange={e=>setPriorityFilter(e.target.value)} className="px-3 py-2 rounded-xl bg-black border border-white/10"><option value="todos">Todas as prioridades</option>{['low','medium','high','urgent'].map(value=><option key={value} value={value}>{rotulo(prioridade,value)}</option>)}</select>
    </div>

    {loading?<p className="text-gray-400">Carregando...</p>:view==='kanban'?<div className="grid xl:grid-cols-4 gap-3">{columns.map(column=><section key={column.key} className={'rounded-2xl border min-h-56 '+column.accent}>
      <div className="p-3 border-b border-white/10 flex justify-between"><b>{column.label}</b><span className={'text-xs px-2 py-1 rounded-full '+column.badge}>{filtered.filter((task:any)=>task.status===column.key).length}</span></div>
      <div className="p-3 space-y-2">{filtered.filter((task:any)=>task.status===column.key).map((task:any)=><div key={task.id} className={'p-3 rounded-xl border '+(statusStyle[task.status]||'border-white/5 bg-[#1a1a1e]')}>
        <Link to={'/admin/projetos/'+task.projectId} className="font-semibold text-sm">{task.title}</Link>
        <p className="text-xs text-gray-500 mt-1">{task.projectTitle}</p>
        <p className="text-xs text-gray-500 mt-1">{assigneeName(task.assigned_to)} · {rotulo(prioridade,task.priority)}</p>
        {task.due_date&&<p className={'text-xs mt-1 '+(task.due_date<today&&task.status!=='completed'?'text-red-300':'text-gray-500')}>Prazo: {new Date(task.due_date+'T12:00').toLocaleDateString('pt-BR')}</p>}
        <select value={task.status} onChange={e=>changeStatus(task.id,e.target.value)} className="mt-3 w-full px-2 py-1.5 rounded-lg bg-black border border-white/10 text-xs">{columns.map(option=><option key={option.key} value={option.key}>{option.label}</option>)}</select>
      </div>)}</div>
    </section>)}</div>:view==='lista'?<div className="space-y-2">{filtered.map((task:any)=><div key={task.id} className={'p-4 rounded-2xl border flex flex-wrap justify-between gap-3 '+(statusStyle[task.status]||'bg-[#141416] border-white/10')}>
      <div><Link to={'/admin/projetos/'+task.projectId} className="font-semibold">{task.title}</Link><p className="text-xs text-gray-500">{task.projectTitle} · {assigneeName(task.assigned_to)}</p></div>
      <div className="flex items-center gap-3"><span className="text-xs">{rotulo(prioridade,task.priority)}</span><span className="text-xs">{rotulo(statusTarefa,task.status)}</span>{task.due_date&&<span className="text-xs text-gray-500">{new Date(task.due_date+'T12:00').toLocaleDateString('pt-BR')}</span>}</div>
    </div>)}</div>:<div className="grid xl:grid-cols-[1fr_360px] gap-4">
      <section className="rounded-2xl bg-[#101012] border border-white/10 overflow-hidden">
        <div className="p-4 flex items-center justify-between gap-3 border-b border-white/10">
          <button onClick={()=>setCalendarMonth(new Date(calendarMonth.getFullYear(),calendarMonth.getMonth()-1,1))} className="px-3 py-2 rounded-lg bg-white/5">←</button>
          <h2 className="font-bold capitalize">{calendarMonth.toLocaleDateString('pt-BR',{month:'long',year:'numeric'})}</h2>
          <button onClick={()=>setCalendarMonth(new Date(calendarMonth.getFullYear(),calendarMonth.getMonth()+1,1))} className="px-3 py-2 rounded-lg bg-white/5">→</button>
        </div>
        <div className="grid grid-cols-7 border-b border-white/10">{['Dom','Seg','Ter','Qua','Qui','Sex','Sáb'].map(day=><div key={day} className="p-2 text-center text-xs text-gray-500">{day}</div>)}</div>
        <div className="grid grid-cols-7">{cells.map((date,index)=>{
          const key=isoDate(date)
          const dayTasks=filtered.filter((task:any)=>task.due_date===key)
          const sameMonth=date.getMonth()===calendarMonth.getMonth()
          const selected=selectedDate===key
          return <button key={key+'-'+index} onClick={()=>setSelectedDate(key)} className={'min-h-24 p-2 border-r border-b border-white/5 text-left align-top transition '+(sameMonth?'':'opacity-30 ')+(selected?'bg-white/10':'hover:bg-white/5')}>
            <span className={'text-xs '+(key===today?'inline-flex w-6 h-6 items-center justify-center rounded-full bg-[#E30613] text-white':'text-gray-400')}>{date.getDate()}</span>
            {dayTasks.length>0&&<div className="mt-2"><span className="inline-flex px-2 py-1 rounded-full bg-[#E30613]/15 text-[#ff6b7a] text-[10px] font-semibold">{dayTasks.length} {dayTasks.length===1?'tarefa':'tarefas'}</span><div className="flex gap-1 mt-2">{columns.map(column=>dayTasks.some((task:any)=>task.status===column.key)&&<span key={column.key} className={'w-2 h-2 rounded-full '+(column.key==='pending'?'bg-red-500':column.key==='in_progress'?'bg-blue-500':column.key==='review'?'bg-yellow-400':'bg-green-500')}/>)}</div></div>}
          </button>
        })}</div>
      </section>
      <aside className="rounded-2xl bg-[#141416] border border-white/10 p-4 h-fit">
        <h3 className="font-bold">{new Date(selectedDate+'T12:00').toLocaleDateString('pt-BR',{weekday:'long',day:'2-digit',month:'long'})}</h3>
        <p className="text-xs text-gray-500 mt-1">{selectedTasks.length} {selectedTasks.length===1?'tarefa prevista':'tarefas previstas'}</p>
        <div className="mt-4 space-y-3">{selectedTasks.length===0?<p className="text-sm text-gray-500">Nenhuma entrega nessa data.</p>:selectedTasks.map((task:any)=><div key={task.id} className={'p-3 rounded-xl border '+(statusStyle[task.status]||'border-white/10')}>
          <Link to={'/admin/projetos/'+task.projectId} className="font-semibold text-sm">{task.title}</Link>
          <p className="text-xs text-gray-500 mt-1">{task.projectTitle}</p>
          <p className="text-xs text-gray-500 mt-1">{assigneeName(task.assigned_to)} · {rotulo(statusTarefa,task.status)}</p>
        </div>)}</div>
      </aside>
    </div>}
  </div>
}
