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
  const [view,setView]=useState<'kanban'|'lista'|'calendario'>('calendario')
  const [projectFilter,setProjectFilter]=useState('todos')
  const [assigneeFilter,setAssigneeFilter]=useState('todos')
  const [priorityFilter,setPriorityFilter]=useState('todos')
  const [search,setSearch]=useState('')
  const [calendarMonth,setCalendarMonth]=useState(()=>new Date(new Date().getFullYear(),new Date().getMonth(),1))
  const [selectedDate,setSelectedDate]=useState(()=>isoDate(new Date()))
  const [taskModal,setTaskModal]=useState(false)
  const [taskForm,setTaskForm]=useState<any>({title:'',description:'',project_id:'',assigned_to:'',priority:'medium',due_date:isoDate(new Date())})
  const [showTaskDetails,setShowTaskDetails]=useState(false)
  const [savingTask,setSavingTask]=useState(false)
  const [selectedTask,setSelectedTask]=useState<any>(null)
  const [taskActivity,setTaskActivity]=useState<any[]>([])
  const [loadingActivity,setLoadingActivity]=useState(false)

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
  const completed=filtered.filter((task:any)=>task.status==='completed').length
  const withDeadline=filtered.filter((task:any)=>task.due_date)
  const completedOnTime=withDeadline.filter((task:any)=>task.status==='completed'&&task.completed_at&&String(task.completed_at).slice(0,10)<=task.due_date).length
  const onTimeRate=withDeadline.filter((task:any)=>task.status==='completed'&&task.completed_at).length?Math.round(completedOnTime/withDeadline.filter((task:any)=>task.status==='completed'&&task.completed_at).length*100):null
  const teamLoad=useMemo(()=>team.map(member=>{const memberTasks=filtered.filter((task:any)=>task.assigned_to===member.id&&task.status!=='completed');return {id:member.id,name:[member.first_name,member.last_name].filter(Boolean).join(' '),open:memberTasks.length,overdue:memberTasks.filter((task:any)=>task.due_date&&task.due_date<today).length}}).filter(item=>item.open>0).sort((a,b)=>b.open-a.open),[team,filtered,today])
  const cells=useMemo(()=>monthCells(calendarMonth),[calendarMonth])
  const selectedTasks=filtered.filter((task:any)=>task.due_date===selectedDate)

  function openTask(date=selectedDate){setSelectedDate(date);setShowTaskDetails(false);setTaskForm({title:'',description:'',project_id:projectFilter!=='todos'?projectFilter:'',assigned_to:'',priority:'medium',due_date:date});setTaskModal(true)}
  async function createTask(){if(!taskForm.title.trim()||!taskForm.project_id)return;setSavingTask(true);try{await portalApi.saveTask({...taskForm,title:taskForm.title.trim(),assigned_to:taskForm.assigned_to||null,status:'pending'});await load();setCalendarMonth(new Date(taskForm.due_date+'T12:00'));setSelectedDate(taskForm.due_date);setTaskModal(false)}finally{setSavingTask(false)}}

  async function openTaskDetails(task:any){setSelectedTask(task);setLoadingActivity(true);try{setTaskActivity(await portalApi.taskActivity(task.id))}catch{setTaskActivity([])}finally{setLoadingActivity(false)}}

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
        <p className="text-[11px] uppercase tracking-[.18em] text-[#A65A2A] font-semibold">Operação</p>
        <h1 className="text-2xl font-bold mt-1">Tarefas</h1>
        <p className="text-sm text-gray-500 mt-1">Organize responsáveis, prioridades, prazos e entregas da equipe.</p>
      </div>
      <div className="flex flex-wrap gap-2">
        {(['calendario','kanban','lista'] as const).map(option=><button key={option} onClick={()=>setView(option)} className={'px-3 py-2 rounded-xl text-sm border '+(view===option?'bg-[#A65A2A]/15 text-red-200 border-[#A65A2A]/30':'bg-white/[0.03] text-gray-400 border-white/10')}>{option==='calendario'?'▦  Calendário':option==='kanban'?'◫  Quadro':'☷  Lista'}</button>)}
      </div>
    </div>

    <div className="grid grid-cols-2 lg:grid-cols-6 gap-2 mb-4">
      <div className="px-4 py-3 rounded-xl bg-[#121214] border border-white/10"><p className="text-[10px] uppercase tracking-[.12em] text-gray-500">Para hoje</p><b className="text-xl mt-2 block">{dueToday}</b></div>
      <div className="px-4 py-3 rounded-xl bg-[#121214] border border-white/10"><p className="text-[10px] uppercase tracking-[.12em] text-gray-500">Atrasadas</p><b className="text-xl mt-2 block text-red-300">{overdue}</b></div>
      <div className="px-4 py-3 rounded-xl bg-[#121214] border border-white/10"><p className="text-[10px] uppercase tracking-[.12em] text-gray-500">Em andamento</p><b className="text-xl mt-2 block text-blue-300">{inProgress}</b></div>
      <div className="px-4 py-3 rounded-xl bg-[#121214] border border-white/10"><p className="text-[10px] uppercase tracking-[.12em] text-gray-500">Em revisão</p><b className="text-xl mt-2 block text-violet-300">{review}</b></div><div className="px-4 py-3 rounded-xl bg-[#121214] border border-white/10"><p className="text-[10px] uppercase tracking-[.12em] text-gray-500">Concluídas</p><b className="text-xl mt-2 block text-green-300">{completed}</b></div><div className="px-4 py-3 rounded-xl bg-[#121214] border border-white/10"><p className="text-[10px] uppercase tracking-[.12em] text-gray-500">No prazo</p><b className="text-xl mt-2 block text-emerald-300">{onTimeRate===null?'—':onTimeRate+'%'}</b></div>
    </div>

    <div className="px-3 py-2.5 rounded-xl bg-[#111113] border border-white/8 flex flex-wrap gap-2 mb-4">
      <input value={search} onChange={e=>setSearch(e.target.value)} placeholder="Buscar tarefa ou projeto..." className="min-h-10 flex-1 min-w-[220px] px-3 py-2 rounded-lg bg-white/[.04] border border-white/10 text-sm"/>
      <select value={projectFilter} onChange={e=>setProjectFilter(e.target.value)} className="min-h-10 px-3 py-2 rounded-lg bg-black border border-white/10 text-sm"><option value="todos">Todos os projetos</option>{projects.map(project=><option key={project.id} value={project.id}>{project.title}</option>)}</select>
      <select value={assigneeFilter} onChange={e=>setAssigneeFilter(e.target.value)} className="min-h-10 px-3 py-2 rounded-lg bg-black border border-white/10 text-sm"><option value="todos">Todos os responsáveis</option><option value="sem_responsavel">Sem responsável</option>{team.map(member=><option key={member.id} value={member.id}>{member.first_name} {member.last_name}</option>)}</select>
      <select value={priorityFilter} onChange={e=>setPriorityFilter(e.target.value)} className="min-h-10 px-3 py-2 rounded-lg bg-black border border-white/10 text-sm"><option value="todos">Todas as prioridades</option>{['low','medium','high','urgent'].map(value=><option key={value} value={value}>{rotulo(prioridade,value)}</option>)}</select>
    </div>

    {!loading&&teamLoad.length>0&&<section className="mb-4 rounded-2xl bg-[#111113] border border-white/8 overflow-hidden"><div className="px-4 py-3 border-b border-white/8"><p className="text-[10px] uppercase tracking-[.14em] text-gray-600">Carga da equipe</p><p className="text-sm font-semibold mt-1">Tarefas abertas por responsável</p></div><div className="grid sm:grid-cols-2 xl:grid-cols-3 gap-px bg-white/[.05]">{teamLoad.map(item=><button type="button" key={item.id} onClick={()=>setAssigneeFilter(item.id)} className="bg-[#111113] p-3 text-left hover:bg-white/[.03]"><div className="flex justify-between gap-3"><span className="text-sm font-semibold truncate">{item.name}</span><span className="text-xs text-gray-400">{item.open} aberta(s)</span></div><p className={'text-[10px] mt-1 '+(item.overdue?'text-red-300':'text-gray-600')}>{item.overdue?item.overdue+' atrasada(s)':'Nenhuma atrasada'}</p></button>)}</div></section>}

    {loading?<p className="text-gray-400">Carregando...</p>:view==='kanban'?<div className="grid xl:grid-cols-4 gap-3">{columns.map(column=><section key={column.key} className={'rounded-2xl border min-h-56 '+column.accent}>
      <div className="p-3 border-b border-white/10 flex justify-between"><b>{column.label}</b><span className={'text-xs px-2 py-1 rounded-full '+column.badge}>{filtered.filter((task:any)=>task.status===column.key).length}</span></div>
      <div className="p-3 space-y-2">{filtered.filter((task:any)=>task.status===column.key).map((task:any)=><div key={task.id} className={'p-3 rounded-xl border '+(statusStyle[task.status]||'border-white/5 bg-[#1a1a1e]')}>
        <button type="button" onClick={()=>void openTaskDetails(task)} className="font-semibold text-sm text-left hover:text-[#ff6573]">{task.title}</button>
        <p className="text-xs text-gray-500 mt-1">{task.projectTitle}</p>
        <p className="text-xs text-gray-500 mt-1">{assigneeName(task.assigned_to)} · {rotulo(prioridade,task.priority)}</p>
        {task.due_date&&<p className={'text-xs mt-1 '+(task.due_date<today&&task.status!=='completed'?'text-red-300':'text-gray-500')}>Prazo: {new Date(task.due_date+'T12:00').toLocaleDateString('pt-BR')}</p>}
        <select value={task.status} onChange={e=>changeStatus(task.id,e.target.value)} className={"pm-select-status mt-3 w-full px-2 py-1.5 rounded-lg text-xs "+(task.status==="pending"?"pm-state-pending":task.status==="in_progress"?"pm-state-progress":task.status==="review"?"pm-state-review":"pm-state-success")}>{columns.map(option=><option key={option.key} value={option.key}>{option.label}</option>)}</select>
      </div>)}</div>
    </section>)}</div>:view==='lista'?<div className="space-y-2">{filtered.map((task:any)=><div key={task.id} className={'p-4 rounded-2xl border flex flex-wrap justify-between gap-3 '+(statusStyle[task.status]||'bg-[#141416] border-white/10')}>
      <div><button type="button" onClick={()=>void openTaskDetails(task)} className="font-semibold text-left hover:text-[#ff6573]">{task.title}</button><p className="text-xs text-gray-500">{task.projectTitle} · {assigneeName(task.assigned_to)}</p></div>
      <div className="flex items-center gap-3"><span className="text-xs">{rotulo(prioridade,task.priority)}</span><span className="text-xs">{rotulo(statusTarefa,task.status)}</span>{task.due_date&&<span className="text-xs text-gray-500">{new Date(task.due_date+'T12:00').toLocaleDateString('pt-BR')}</span>}</div>
    </div>)}</div>:<div className="grid xl:grid-cols-[1fr_360px] gap-4">
      <section className="rounded-2xl bg-[#101012] border border-white/10 overflow-hidden min-w-0">
        <div className="px-4 py-3 flex flex-wrap items-center justify-between gap-3 border-b border-white/10">
          <div className="flex items-center gap-2"><button onClick={()=>openTask()} className="min-h-9 px-3 rounded-lg bg-[#A65A2A] text-white text-xs font-bold">＋ Nova tarefa</button><button onClick={()=>{const now=new Date();setCalendarMonth(new Date(now.getFullYear(),now.getMonth(),1));setSelectedDate(isoDate(now))}} className="min-h-9 px-3 rounded-lg border border-white/10 text-xs font-semibold hover:bg-white/5">Hoje</button><button aria-label="Mês anterior" onClick={()=>setCalendarMonth(new Date(calendarMonth.getFullYear(),calendarMonth.getMonth()-1,1))} className="w-9 h-9 rounded-lg hover:bg-white/5 text-gray-400">‹</button><button aria-label="Próximo mês" onClick={()=>setCalendarMonth(new Date(calendarMonth.getFullYear(),calendarMonth.getMonth()+1,1))} className="w-9 h-9 rounded-lg hover:bg-white/5 text-gray-400">›</button></div>
          <h2 className="font-bold capitalize text-base">{calendarMonth.toLocaleDateString('pt-BR',{month:'long',year:'numeric'})}</h2>
          <div className="hidden md:flex items-center gap-3 text-[9px] text-gray-500"><span>● Pendente</span><span className="text-blue-400">● Em andamento</span><span className="text-yellow-400">● Revisão</span><span className="text-green-400">● Concluída</span></div>
        </div>
        <div className="grid grid-cols-7 border-b border-white/10">{['Dom','Seg','Ter','Qua','Qui','Sex','Sáb'].map(day=><div key={day} className="p-2 text-center text-xs text-gray-500">{day}</div>)}</div>
        <div className="grid grid-cols-7">{cells.map((date,index)=>{
          const key=isoDate(date)
          const dayTasks=filtered.filter((task:any)=>task.due_date===key)
          const sameMonth=date.getMonth()===calendarMonth.getMonth()
          const selected=selectedDate===key
          return <button key={key+'-'+index} onClick={()=>setSelectedDate(key)} onDoubleClick={()=>openTask(key)} className={'min-h-28 p-2 border-r border-b border-white/5 text-left align-top transition '+(sameMonth?'':'opacity-30 ')+(selected?'bg-white/10':'hover:bg-white/5')}>
            <span className={'text-xs '+(key===today?'inline-flex w-6 h-6 items-center justify-center rounded-full bg-[#A65A2A] text-white':'text-gray-400')}>{date.getDate()}</span>
            {dayTasks.length>0&&<div className="mt-2 space-y-1">{dayTasks.slice(0,3).map((task:any)=><div key={task.id} className={'truncate rounded-md px-1.5 py-1 text-[9px] font-medium '+(task.status==='pending'?'bg-red-500/10 text-red-300':task.status==='in_progress'?'bg-blue-500/10 text-blue-300':task.status==='review'?'bg-yellow-500/10 text-yellow-200':'bg-green-500/10 text-green-300')}>{task.title}</div>)}{dayTasks.length>3&&<div className="text-[9px] text-gray-500 px-1">+ {dayTasks.length-3} mais</div>}</div>}
          </button>
        })}</div>
      </section>
      <aside className="rounded-2xl bg-[#141416] border border-white/10 h-fit overflow-hidden xl:sticky xl:top-20"><div className="px-4 py-3 border-b border-white/8"><p className="text-[9px] uppercase tracking-[.14em] text-gray-600">Agenda do dia</p>
        <h3 className="font-bold">{new Date(selectedDate+'T12:00').toLocaleDateString('pt-BR',{weekday:'long',day:'2-digit',month:'long'})}</h3>
        <p className="text-xs text-gray-500 mt-1">{selectedTasks.length} {selectedTasks.length===1?'tarefa prevista':'tarefas previstas'}</p></div>
        <div className="p-4 space-y-3">{selectedTasks.length===0?<p className="text-sm text-gray-500">Nenhuma entrega nessa data.</p>:selectedTasks.map((task:any)=><div key={task.id} className={'p-3 rounded-xl border '+(statusStyle[task.status]||'border-white/10')}>
          <button type="button" onClick={()=>void openTaskDetails(task)} className="font-semibold text-sm text-left hover:text-[#ff6573]">{task.title}</button>
          <p className="text-xs text-gray-500 mt-1">{task.projectTitle}</p>
          <p className="text-xs text-gray-500 mt-1">{assigneeName(task.assigned_to)} · {rotulo(statusTarefa,task.status)}</p>
        </div>)}</div>
      </aside>
    </div>}
    {selectedTask&&<div className="fixed inset-0 z-50 bg-black/75 backdrop-blur-sm flex items-center justify-center p-4" onMouseDown={e=>{if(e.target===e.currentTarget)setSelectedTask(null)}}><div className="w-full max-w-2xl max-h-[88vh] overflow-y-auto rounded-2xl border border-white/10 bg-[#141416] shadow-2xl"><div className="sticky top-0 bg-[#141416]/95 backdrop-blur border-b border-white/10 p-5 flex justify-between gap-4"><div className="min-w-0"><p className="text-[10px] uppercase tracking-[.15em] text-[#ff5364]">Detalhes da tarefa</p><h2 className="text-xl font-bold mt-1 truncate">{selectedTask.title}</h2><p className="text-xs text-gray-500 mt-1">{selectedTask.projectTitle}</p></div><button onClick={()=>setSelectedTask(null)} className="text-gray-500 hover:text-white">✕</button></div><div className="p-5 space-y-5">{selectedTask.description&&<section><p className="text-xs uppercase tracking-wide text-gray-500">Descrição</p><p className="text-sm text-gray-300 mt-2 whitespace-pre-wrap">{selectedTask.description}</p></section>}<div className="grid sm:grid-cols-2 gap-3"><div className="p-3 rounded-xl bg-white/[.03] border border-white/10"><p className="text-[10px] text-gray-500 uppercase">Responsável</p><p className="text-sm font-semibold mt-1">{assigneeName(selectedTask.assigned_to)}</p></div><div className="p-3 rounded-xl bg-white/[.03] border border-white/10"><p className="text-[10px] text-gray-500 uppercase">Prazo</p><p className="text-sm font-semibold mt-1">{selectedTask.due_date?new Date(selectedTask.due_date+'T12:00').toLocaleDateString('pt-BR'):'Sem prazo'}</p></div><div className="p-3 rounded-xl bg-white/[.03] border border-white/10"><p className="text-[10px] text-gray-500 uppercase">Prioridade</p><p className="text-sm font-semibold mt-1">{rotulo(prioridade,selectedTask.priority)}</p></div><div className="p-3 rounded-xl bg-white/[.03] border border-white/10"><p className="text-[10px] text-gray-500 uppercase">Situação</p><select value={selectedTask.status} onChange={async e=>{await changeStatus(selectedTask.id,e.target.value);setSelectedTask((v:any)=>({...v,status:e.target.value}))}} className={"pm-select-status mt-1 w-full rounded-lg px-2 py-1.5 text-sm "+(selectedTask.status==="pending"?"pm-state-pending":selectedTask.status==="in_progress"?"pm-state-progress":selectedTask.status==="review"?"pm-state-review":"pm-state-success")}>{columns.map(option=><option key={option.key} value={option.key}>{option.label}</option>)}</select></div></div><section><div className="flex items-center justify-between"><p className="text-xs uppercase tracking-wide text-gray-500">Histórico</p><span className="text-[10px] text-gray-600">{taskActivity.length} registro(s)</span></div>{loadingActivity?<p className="text-sm text-gray-500 mt-3">Carregando histórico...</p>:taskActivity.length===0?<p className="text-sm text-gray-500 mt-3">Ainda não há movimentações registradas para esta tarefa.</p>:<div className="mt-3 space-y-2">{taskActivity.slice(0,12).map((item:any)=><div key={item.id} className="p-3 rounded-xl bg-white/[.025] border border-white/[.06]"><div className="flex justify-between gap-3"><p className="text-xs font-semibold">{item.action==='created'?'Tarefa criada':item.action==='status_changed'?'Situação alterada':item.action==='updated'?'Tarefa atualizada':'Atualização da tarefa'}</p><span className="text-[10px] text-gray-600">{item.created_at?new Date(item.created_at).toLocaleString('pt-BR'):''}</span></div>{item.details&&<p className="text-[10px] text-gray-500 mt-1">Alteração registrada no histórico operacional.</p>}</div>)}</div>}</section><div className="flex flex-wrap gap-2 pt-1"><Link to={'/admin/projetos/'+selectedTask.projectId} className="min-h-10 px-4 rounded-xl bg-[#A65A2A] text-white text-xs font-bold flex items-center">Abrir projeto</Link><button onClick={()=>setSelectedTask(null)} className="min-h-10 px-4 rounded-xl border border-white/10 text-xs font-semibold text-gray-300">Fechar</button></div></div></div></div>}
    {taskModal&&<div className="fixed inset-0 z-50 bg-black/75 backdrop-blur-sm flex items-center justify-center p-4" onMouseDown={e=>{if(e.target===e.currentTarget)setTaskModal(false)}}><div className="w-full max-w-lg rounded-2xl border border-white/10 bg-[#141416] p-5 shadow-2xl"><div className="flex justify-between items-start"><div><p className="text-[10px] uppercase tracking-[.15em] text-[#ff5364]">Calendário</p><h2 className="text-lg font-bold mt-1">Nova tarefa</h2><p className="text-xs text-gray-500 mt-1">{new Date(taskForm.due_date+'T12:00').toLocaleDateString('pt-BR')}</p></div><button onClick={()=>setTaskModal(false)} className="text-gray-500 hover:text-white">✕</button></div><div className="grid gap-3 mt-5"><label className="text-xs text-gray-400">Título da tarefa<input autoFocus value={taskForm.title} onChange={e=>setTaskForm((v:any)=>({...v,title:e.target.value}))} placeholder="Ex.: Revisar identidade visual" className="mt-1 w-full min-h-11 px-3 rounded-xl bg-black border border-white/10 text-sm"/></label><label className="text-xs text-gray-400">Projeto<select value={taskForm.project_id} onChange={e=>setTaskForm((v:any)=>({...v,project_id:e.target.value}))} className="mt-1 w-full min-h-11 px-3 rounded-xl bg-black border border-white/10 text-sm"><option value="">Selecione o projeto</option>{projects.map(p=><option key={p.id} value={p.id}>{p.title}</option>)}</select></label><div className="grid sm:grid-cols-2 gap-3"><label className="text-xs text-gray-400">Responsável<select value={taskForm.assigned_to} onChange={e=>setTaskForm((v:any)=>({...v,assigned_to:e.target.value}))} className="mt-1 w-full min-h-11 px-3 rounded-xl bg-black border border-white/10 text-sm"><option value="">Sem responsável</option>{team.map(m=><option key={m.id} value={m.id}>{m.first_name} {m.last_name}</option>)}</select></label><label className="text-xs text-gray-400">Prioridade<select value={taskForm.priority} onChange={e=>setTaskForm((v:any)=>({...v,priority:e.target.value}))} className="mt-1 w-full min-h-11 px-3 rounded-xl bg-black border border-white/10 text-sm">{['low','medium','high','urgent'].map(v=><option key={v} value={v}>{rotulo(prioridade,v)}</option>)}</select></label></div><label className="text-xs text-gray-400">Prazo<input type="date" value={taskForm.due_date} onChange={e=>setTaskForm((v:any)=>({...v,due_date:e.target.value}))} className="mt-1 w-full min-h-11 px-3 rounded-xl bg-black border border-white/10 text-sm"/></label><button type="button" onClick={()=>setShowTaskDetails(v=>!v)} className="min-h-10 rounded-xl border border-white/10 text-xs font-semibold text-gray-300 hover:bg-white/5">{showTaskDetails?'Ocultar detalhes':'＋ Adicionar detalhes'}</button>{showTaskDetails&&<label className="text-xs text-gray-400">Descrição<textarea value={taskForm.description} onChange={e=>setTaskForm((v:any)=>({...v,description:e.target.value}))} placeholder="Contexto, instruções e resultado esperado..." rows={4} className="mt-1 w-full px-3 py-2 rounded-xl bg-black border border-white/10 text-sm resize-y"/></label>}<button disabled={savingTask||!taskForm.title.trim()||!taskForm.project_id} onClick={()=>void createTask()} className="min-h-11 rounded-xl bg-[#A65A2A] disabled:opacity-40 text-white text-sm font-bold">{savingTask?'Salvando...':'Criar tarefa'}</button><p className="text-[10px] text-gray-600">No celular, selecione o dia e use “Nova tarefa”. No computador, você também pode dar dois cliques no dia.</p></div></div></div>}
  </div>
}
