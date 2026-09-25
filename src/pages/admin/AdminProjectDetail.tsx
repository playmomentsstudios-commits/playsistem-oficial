import { useEffect,useMemo,useState } from 'react'
import { Link,useParams } from 'react-router-dom'
import { portalApi } from '../../api/portal'
import { useAuth } from '../../contexts/AuthContext'
import { useToast } from '../../contexts/ToastContext'
import { Button } from '../../components/ui/Button'
import { prioridade,rotulo,statusEtapa,statusProjeto,statusTarefa,tipoProjeto } from '../../lib/labels.ptBR'

const projectStatuses=['planning','active','paused','review','completed','cancelled']
const priorities=['low','medium','high','urgent']
const taskStatuses=['pending','in_progress','review','completed','cancelled']
const stageStatuses=['pending','in_progress','completed']

function progress(project:any){
  const tasks=(project?.tasks||[]).filter((task:any)=>task.status!=='cancelled')
  return tasks.length?Math.round(tasks.filter((task:any)=>task.status==='completed').length/tasks.length*100):0
}

export function AdminProjectDetail(){
  const {id=''}=useParams()
  const {user}=useAuth()
  const toast=useToast()
  const [project,setProject]=useState<any>(null)
  const [team,setTeam]=useState<any[]>([])
  const [loading,setLoading]=useState(true)
  const [stageName,setStageName]=useState('')
  const [taskForm,setTaskForm]=useState({title:'',stage_id:'',assigned_to:'',priority:'medium',due_date:'',client_visible:true})

  const load=async()=>{
    const [item,members]=await Promise.all([portalApi.project(id),portalApi.teamMembers()])
    setProject(item)
    setTeam(members)
    setLoading(false)
  }

  useEffect(()=>{void load()},[id])

  const sortedStages=useMemo(()=>[...(project?.stages||[])].sort((a:any,b:any)=>a.position-b.position),[project])
  const tasks=project?.tasks||[]

  async function updateProject(values:any){
    try{
      await portalApi.saveProject(values,id)
      toast('Projeto atualizado.','success')
      await load()
    }catch(error:any){toast(error.message,'error')}
  }

  async function addStage(e:React.FormEvent){
    e.preventDefault()
    if(!stageName.trim())return
    try{
      await portalApi.saveStage({project_id:id,name:stageName.trim(),position:sortedStages.length,status:'pending',client_visible:true})
      setStageName('')
      toast('Etapa criada.','success')
      await load()
    }catch(error:any){toast(error.message,'error')}
  }

  async function addTask(e:React.FormEvent){
    e.preventDefault()
    if(!user||!taskForm.title.trim())return
    try{
      await portalApi.saveTask({
        project_id:id,
        stage_id:taskForm.stage_id||null,
        title:taskForm.title.trim(),
        status:'pending',
        priority:taskForm.priority,
        due_date:taskForm.due_date||null,
        created_by:user.id,
        assigned_to:taskForm.assigned_to||null,
        client_visible:taskForm.client_visible,
        position:tasks.length,
      })
      setTaskForm({title:'',stage_id:'',assigned_to:'',priority:'medium',due_date:'',client_visible:true})
      toast('Tarefa criada.','success')
      await load()
    }catch(error:any){toast(error.message,'error')}
  }

  async function addChecklist(taskId:string){
    const title=window.prompt('Item do checklist')
    if(!title?.trim())return
    try{
      const task=tasks.find((item:any)=>item.id===taskId)
      await portalApi.saveChecklistItem({task_id:taskId,title:title.trim(),completed:false,position:task?.checklist?.length||0})
      await load()
    }catch(error:any){toast(error.message,'error')}
  }

  async function addLink(taskId:string){
    const url=window.prompt('Cole o link (Drive, documento ou referência)')
    if(!url?.trim())return
    const label=window.prompt('Nome do link')||'Abrir link'
    const visible=window.confirm('Este link pode ficar visível para o cliente?')
    try{
      await portalApi.saveTaskLink({task_id:taskId,label,url:url.trim(),link_type:'reference',client_visible:visible})
      await load()
    }catch(error:any){toast(error.message,'error')}
  }

  if(loading)return <p className="text-gray-400">Carregando projeto...</p>
  if(!project)return <div><p>Projeto não encontrado.</p><Link to="/admin/projetos" className="text-[#E30613]">Voltar</Link></div>

  return <div>
    <Link to="/admin/projetos" className="text-sm text-[#E30613]">← Projetos</Link>

    <div className="flex flex-wrap justify-between gap-4 mt-4">
      <div>
        <h1 className="text-2xl font-bold">{project.title}</h1>
        <p className="text-sm text-gray-500 mt-1">{rotulo(tipoProjeto,project.project_type)} · prioridade {rotulo(prioridade,project.priority)}</p>
      </div>
      <div className="flex flex-wrap gap-2">
        <select value={project.status} onChange={e=>updateProject({status:e.target.value})} className="px-3 py-2 rounded-xl bg-black border border-white/10">{projectStatuses.map(value=><option key={value} value={value}>{rotulo(statusProjeto,value)}</option>)}</select>
        <select value={project.priority} onChange={e=>updateProject({priority:e.target.value})} className="px-3 py-2 rounded-xl bg-black border border-white/10">{priorities.map(value=><option key={value} value={value}>{rotulo(prioridade,value)}</option>)}</select>
      </div>
    </div>

    <div className="grid lg:grid-cols-3 gap-4 mt-6">
      <div className="lg:col-span-2 p-5 rounded-2xl bg-[#141416] border border-white/10">
        <div className="flex justify-between"><span>Progresso geral</span><b>{progress(project)}%</b></div>
        <div className="h-2 bg-white/10 rounded mt-2"><div className="h-2 bg-[#E30613] rounded" style={{width:progress(project)+'%'}}/></div>
        <p className="text-sm text-gray-400 mt-4 whitespace-pre-wrap">{project.description||'Sem descrição.'}</p>
      </div>
      <div className="p-5 rounded-2xl bg-[#141416] border border-white/10 text-sm space-y-2">
        <p><span className="text-gray-500">Início:</span> {project.start_date?new Date(project.start_date+'T12:00').toLocaleDateString('pt-BR'):'—'}</p>
        <p><span className="text-gray-500">Prazo:</span> {project.due_date?new Date(project.due_date+'T12:00').toLocaleDateString('pt-BR'):'—'}</p>
        {project.drive_folder_url&&<a href={project.drive_folder_url} target="_blank" rel="noreferrer" className="inline-block text-[#E30613]">Abrir pasta do projeto ↗</a>}
      </div>
    </div>

    <section className="mt-8">
      <h2 className="text-xl font-bold">Etapas</h2>
      <p className="text-sm text-gray-500 mb-3">Organize o fluxo e o que o cliente pode acompanhar</p>
      <form onSubmit={addStage} className="flex gap-2 mb-4"><input value={stageName} onChange={e=>setStageName(e.target.value)} placeholder="Nova etapa" className="px-3 py-2 rounded-xl bg-white/5 border border-white/10 flex-1"/><Button type="submit">Adicionar etapa</Button></form>
      <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-3">{sortedStages.map((stage:any)=><div key={stage.id} className="p-4 rounded-2xl bg-[#141416] border border-white/10">
        <div className="flex justify-between gap-2"><b>{stage.name}</b><button onClick={async()=>{if(window.confirm('Excluir esta etapa? As tarefas permanecem sem etapa.')){await portalApi.deleteStage(stage.id);await load()}}} className="text-xs text-red-400">Excluir</button></div>
        <select value={stage.status} onChange={async e=>{await portalApi.saveStage({status:e.target.value},stage.id);await load()}} className="mt-3 w-full px-3 py-2 rounded-lg bg-black border border-white/10 text-sm">{stageStatuses.map(value=><option key={value} value={value}>{rotulo(statusEtapa,value)}</option>)}</select>
        <label className="mt-3 flex items-center gap-2 text-xs text-gray-400"><input type="checkbox" checked={stage.client_visible} onChange={async e=>{await portalApi.saveStage({client_visible:e.target.checked},stage.id);await load()}}/> Visível para o cliente</label>
      </div>)}</div>
    </section>

    <section className="mt-8">
      <h2 className="text-xl font-bold">Tarefas</h2>
      <p className="text-sm text-gray-500 mb-4">Responsáveis, prazos, checklist e links</p>

      <form onSubmit={addTask} className="p-4 rounded-2xl bg-[#141416] border border-white/10 mb-5 grid md:grid-cols-2 lg:grid-cols-5 gap-3">
        <input value={taskForm.title} onChange={e=>setTaskForm({...taskForm,title:e.target.value})} placeholder="Nova tarefa" className="px-3 py-2 rounded-xl bg-white/5 border border-white/10 lg:col-span-2"/>
        <select value={taskForm.stage_id} onChange={e=>setTaskForm({...taskForm,stage_id:e.target.value})} className="px-3 py-2 rounded-xl bg-black border border-white/10"><option value="">Sem etapa</option>{sortedStages.map((stage:any)=><option key={stage.id} value={stage.id}>{stage.name}</option>)}</select>
        <select value={taskForm.assigned_to} onChange={e=>setTaskForm({...taskForm,assigned_to:e.target.value})} className="px-3 py-2 rounded-xl bg-black border border-white/10"><option value="">Sem responsável</option>{team.map(member=><option key={member.id} value={member.id}>{member.first_name} {member.last_name}</option>)}</select>
        <input type="date" value={taskForm.due_date} onChange={e=>setTaskForm({...taskForm,due_date:e.target.value})} className="px-3 py-2 rounded-xl bg-black border border-white/10"/>
        <select value={taskForm.priority} onChange={e=>setTaskForm({...taskForm,priority:e.target.value})} className="px-3 py-2 rounded-xl bg-black border border-white/10">{priorities.map(value=><option key={value} value={value}>{rotulo(prioridade,value)}</option>)}</select>
        <label className="flex items-center gap-2 text-sm text-gray-400"><input type="checkbox" checked={taskForm.client_visible} onChange={e=>setTaskForm({...taskForm,client_visible:e.target.checked})}/> Visível ao cliente</label>
        <div className="lg:col-span-3"><Button type="submit">Criar tarefa</Button></div>
      </form>

      <div className="space-y-3">{tasks.map((task:any)=>{
        const member=team.find(item=>item.id===task.assigned_to)
        const stage=sortedStages.find((item:any)=>item.id===task.stage_id)
        return <div key={task.id} className="p-4 rounded-2xl bg-[#141416] border border-white/10">
          <div className="flex flex-wrap justify-between gap-3">
            <div>
              <b>{task.title}</b>
              <p className="text-xs text-gray-500 mt-1">{stage?.name||'Sem etapa'} · {member?member.first_name+' '+member.last_name:'Sem responsável'} · prioridade {rotulo(prioridade,task.priority)}</p>
              {task.due_date&&<p className="text-xs text-gray-500 mt-1">Prazo: {new Date(task.due_date+'T12:00').toLocaleDateString('pt-BR')}</p>}
            </div>
            <div className="flex gap-2 items-start">
              <select value={task.status} onChange={async e=>{await portalApi.saveTask({status:e.target.value,completed_at:e.target.value==='completed'?new Date().toISOString():null},task.id);await load()}} className="px-3 py-2 rounded-lg bg-black border border-white/10 text-sm">{taskStatuses.map(value=><option key={value} value={value}>{rotulo(statusTarefa,value)}</option>)}</select>
              <button onClick={async()=>{if(window.confirm('Excluir esta tarefa?')){await portalApi.deleteTask(task.id);await load()}}} className="px-3 py-2 text-xs text-red-400">Excluir</button>
            </div>
          </div>

          <div className="grid lg:grid-cols-2 gap-4 mt-4">
            <div>
              <div className="flex justify-between"><p className="text-sm font-semibold">Checklist</p><button onClick={()=>addChecklist(task.id)} className="text-xs text-[#E30613]">+ item</button></div>
              <div className="space-y-1 mt-2">{(task.checklist||[]).sort((a:any,b:any)=>a.position-b.position).map((item:any)=><label key={item.id} className="flex items-center gap-2 text-sm"><input type="checkbox" checked={item.completed} onChange={async e=>{await portalApi.saveChecklistItem({completed:e.target.checked},item.id);await load()}}/><span className={item.completed?'line-through text-gray-500':''}>{item.title}</span><button type="button" onClick={async()=>{await portalApi.deleteChecklistItem(item.id);await load()}} className="ml-auto text-xs text-red-400">×</button></label>)}</div>
            </div>
            <div>
              <div className="flex justify-between"><p className="text-sm font-semibold">Links</p><button onClick={()=>addLink(task.id)} className="text-xs text-[#E30613]">+ link</button></div>
              <div className="space-y-1 mt-2">{(task.links||[]).map((link:any)=><div key={link.id} className="flex items-center gap-2 text-sm"><a href={link.url} target="_blank" rel="noreferrer" className="text-[#E30613]">{link.label} ↗</a>{link.client_visible&&<span className="text-[10px] text-emerald-400">cliente</span>}<button onClick={async()=>{await portalApi.deleteTaskLink(link.id);await load()}} className="ml-auto text-xs text-red-400">×</button></div>)}</div>
            </div>
          </div>
        </div>
      })}</div>
    </section>
  </div>
}
