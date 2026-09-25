import { useEffect,useMemo,useState } from 'react'
import { Link,useParams } from 'react-router-dom'
import { portalApi } from '../../api/portal'
import { fileManagementApi } from '../../api/fileManagement'
import { useAuth } from '../../contexts/AuthContext'
import { useToast } from '../../contexts/ToastContext'
import { Button } from '../../components/ui/Button'
import { prioridade,rotulo,statusEtapa,statusProjeto,statusTarefa,tipoProjeto } from '../../lib/labels.ptBR'

const projectStatuses=['planning','active','paused','review','completed','cancelled']
const priorities=['low','medium','high','urgent']
const taskStatuses=['pending','in_progress','review','completed','cancelled']
const stageStatuses=['pending','in_progress','completed']
const driveFolderOptions=[
  ['received','01 - Arquivos recebidos'],
  ['raw','02 - Brutos'],
  ['production','03 - Produção'],
  ['preview','04 - Prévia'],
  ['approved','05 - Aprovados'],
  ['delivery','06 - Entrega final'],
]

function fileSize(value:number|null|undefined){
  if(!value)return '—'
  const units=['B','KB','MB','GB','TB']
  let size=value,index=0
  while(size>=1024&&index<units.length-1){size/=1024;index+=1}
  return size.toLocaleString('pt-BR',{maximumFractionDigits:index>=3?2:1})+' '+units[index]
}

function projectFileIcon(file:any){
  const type=(file.mime_type||file.file_type||'').toLowerCase()
  if(type.startsWith('video/'))return '🎬'
  if(type.startsWith('image/'))return '🖼️'
  if(type.startsWith('audio/'))return '🎵'
  if(type.includes('pdf'))return '📄'
  return '📎'
}

function progress(project:any){
  const tasks=(project?.tasks||[]).filter((task:any)=>task.status!=='cancelled')
  return tasks.length?Math.round(tasks.filter((task:any)=>task.status==='completed').length/tasks.length*100):0
}

export function AdminProjectDetailV2(){
  const {id=''}=useParams()
  const {user}=useAuth()
  const toast=useToast()
  const [project,setProject]=useState<any>(null)
  const [team,setTeam]=useState<any[]>([])
  const [files,setFiles]=useState<any[]>([])
  const [loading,setLoading]=useState(true)
  const [stageName,setStageName]=useState('')
  const [fileTask,setFileTask]=useState('')
  const [fileVisible,setFileVisible]=useState(false)
  const [fileFolder,setFileFolder]=useState('received')
  const [uploading,setUploading]=useState(false)
  const [fileProgress,setFileProgress]=useState(0)
  const [fileMenu,setFileMenu]=useState<string|null>(null)
  const [taskForm,setTaskForm]=useState({title:'',stage_id:'',assigned_to:'',priority:'medium',due_date:'',client_visible:true})

  const load=async()=>{
    const [item,members,projectFiles]=await Promise.all([portalApi.project(id),portalApi.teamMembers(),portalApi.projectFiles(id)])
    setProject(item)
    setTeam(members)
    setFiles(projectFiles)
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

  async function uploadProjectFile(event:React.ChangeEvent<HTMLInputElement>){
    const file=event.target.files?.[0]
    if(!file||!user)return
    if(!project?.customer_id){
      toast('Para usar a biblioteca do cliente, vincule este projeto a um cliente.','error')
      event.target.value=''
      return
    }
    if(file.size>1024*1024*1024){
      toast('O limite por arquivo é 1 GB.','error')
      event.target.value=''
      return
    }
    setUploading(true)
    setFileProgress(0)
    try{
      await portalApi.ensureProjectDriveFolder(id)
      await portalApi.uploadDriveFile({
        project_id:id,
        task_id:fileTask||null,
        folder_kind:fileFolder,
        client_visible:fileVisible,
      },file,setFileProgress)
      toast('Arquivo enviado ao Google Drive e adicionado ao projeto.','success')
      event.target.value=''
      setFileProgress(0)
      await load()
    }catch(error:any){toast(error.message,'error')}
    finally{setUploading(false)}
  }

  async function deleteProjectFile(file:any){
    if(!window.confirm('Excluir "'+file.name+'"?'))return
    try{
      await fileManagementApi.remove(file.id)
      toast('Arquivo excluído.','success')
      await load()
    }catch(error:any){toast(error.message,'error')}
  }

  async function moveProjectFile(file:any,folderKind:string){
    try{
      await fileManagementApi.move(file.id,folderKind)
      toast('Arquivo movido no Google Drive.','success')
      setFileMenu(null)
      await load()
    }catch(error:any){toast(error.message,'error')}
  }

  async function renameProjectFile(file:any){
    const next=window.prompt('Novo nome do arquivo',file.name)
    if(!next?.trim()||next.trim()===file.name)return
    try{
      await fileManagementApi.rename(file.id,next.trim())
      toast('Arquivo renomeado.','success')
      setFileMenu(null)
      await load()
    }catch(error:any){toast(error.message||'Não foi possível renomear o arquivo.','error')}
  }

  async function openFile(file:any){
    try{
      if(file.external_url){window.open(file.external_url,'_blank','noopener,noreferrer');return}
      if(file.storage_path){
        const url=await portalApi.fileUrl(file.storage_path)
        window.open(url,'_blank','noopener,noreferrer')
      }
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
      <div className="flex flex-wrap justify-between gap-3 items-end">
        <div>
          <h2 className="text-xl font-bold">Arquivos do projeto</h2>
          <p className="text-sm text-gray-500">Os mesmos arquivos da Central de Arquivos, vinculados diretamente a este projeto.</p>
        </div>
        <Link to="/admin/arquivos" className="text-sm text-[#E30613]">Abrir Central de Arquivos →</Link>
      </div>

      <div className="p-4 rounded-2xl bg-[#141416] border border-white/10 mt-4">
        <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-3 items-end">
          <label className="text-sm text-gray-400">Direcionar para
            <select value={fileTask} onChange={e=>setFileTask(e.target.value)} className="mt-1 w-full px-3 py-2 rounded-xl bg-black border border-white/10">
              <option value="">Arquivo geral do projeto</option>
              {tasks.map((task:any)=><option key={task.id} value={task.id}>{task.title}</option>)}
            </select>
          </label>
          <label className="text-sm text-gray-400">Pasta no Drive
            <select value={fileFolder} onChange={e=>setFileFolder(e.target.value)} className="mt-1 w-full px-3 py-2 rounded-xl bg-black border border-white/10">
              {driveFolderOptions.map(([value,label])=><option key={value} value={value}>{label}</option>)}
            </select>
          </label>
          <label className="text-sm text-gray-400">Visibilidade
            <select value={fileVisible?'cliente':'interno'} onChange={e=>setFileVisible(e.target.value==='cliente')} className="mt-1 w-full px-3 py-2 rounded-xl bg-black border border-white/10">
              <option value="interno">Somente equipe</option>
              <option value="cliente">Cliente pode visualizar</option>
            </select>
          </label>
          <label className={'px-4 py-2.5 rounded-xl text-center cursor-pointer '+(uploading?'bg-white/10 text-gray-500':'bg-[#E30613] text-white')}>
            {uploading?'Enviando...':'Adicionar ao Drive'}
            <input type="file" disabled={uploading} onChange={uploadProjectFile} className="hidden"/>
          </label>
        </div>

        {uploading&&fileProgress>0&&<div className="mt-4">
          <div className="flex justify-between text-xs text-gray-500"><span>Upload para o Google Drive</span><span>{fileProgress}%</span></div>
          <div className="h-2 rounded bg-white/10 mt-2"><div className="h-2 rounded bg-[#E30613]" style={{width:fileProgress+'%'}}/></div>
        </div>}

        {!project.customer_id&&<p className="text-xs text-yellow-300 mt-3">Projeto interno: vincule um cliente para utilizar a biblioteca de arquivos.</p>}

        <div className="mt-5 grid sm:grid-cols-2 lg:grid-cols-3 gap-3">
          {files.length===0?<p className="text-sm text-gray-500">Nenhum arquivo vinculado a este projeto.</p>:files.map(file=><div key={file.id} className="p-3 rounded-xl bg-white/5 border border-white/10">
            <div className="flex gap-3">
              <div className="w-12 h-12 shrink-0 rounded-xl bg-black/30 flex items-center justify-center text-2xl">{projectFileIcon(file)}</div>
              <button onClick={()=>openFile(file)} className="text-left min-w-0 flex-1">
                <p className="text-sm font-medium truncate" title={file.name}>{file.name}</p>
                <p className="text-xs text-gray-500 mt-1">{fileSize(file.file_size)} · {file.client_visible?'Cliente':'Equipe'}</p>
                <p className="text-[10px] text-gray-600 mt-1">{tasks.find((task:any)=>task.id===file.task_id)?.title||'Arquivo geral do projeto'}</p>
              </button>
            </div>
            <div className="mt-3 flex justify-end relative">
              <button type="button" onClick={()=>setFileMenu(fileMenu===file.id?null:file.id)} className="w-8 h-8 rounded-lg bg-black/30 hover:bg-black/50 text-gray-400 hover:text-white" title="Ações" aria-label="Ações do arquivo">•••</button>
              {fileMenu===file.id&&<div className="absolute z-20 right-0 bottom-10 w-52 rounded-xl border border-white/10 bg-[#0d0d0f] shadow-2xl p-2">
                <div className="flex items-center gap-1 mb-2">
                  <button type="button" onClick={()=>{setFileMenu(null);void openFile(file)}} className="w-9 h-9 rounded-lg hover:bg-white/[0.07]" title="Abrir">↗</button>
                  <button type="button" onClick={()=>void renameProjectFile(file)} className="w-9 h-9 rounded-lg hover:bg-white/[0.07]" title="Renomear">✎</button>
                  <button type="button" onClick={()=>{setFileMenu(null);void deleteProjectFile(file)}} className="w-9 h-9 rounded-lg hover:bg-red-500/10 text-red-400" title="Excluir">⌫</button>
                </div>
                <label className="block text-[10px] text-gray-500">Tarefa
                  <select value={file.task_id||''} onChange={async e=>{await portalApi.assignClientFileTask(file.id,e.target.value||null);setFileMenu(null);await load()}} className="mt-1 w-full px-2 py-1.5 rounded-lg bg-black border border-white/10 text-xs">
                    <option value="">Arquivo geral</option>
                    {tasks.map((task:any)=><option key={task.id} value={task.id}>{task.title}</option>)}
                  </select>
                </label>
                {file.storage_provider==='google_drive'&&<label className="block text-[10px] text-gray-500 mt-2">Pasta
                  <select defaultValue="" onChange={e=>{if(e.target.value){void moveProjectFile(file,e.target.value);setFileMenu(null)}}} className="mt-1 w-full px-2 py-1.5 rounded-lg bg-black border border-white/10 text-xs">
                    <option value="">Mover para...</option>
                    {driveFolderOptions.map(([value,label])=><option key={value} value={value}>{label}</option>)}
                  </select>
                </label>}
              </div>}
            </div>
          </div>)}
        </div>
      </div>
    </section>

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

          {(files.filter((file:any)=>file.task_id===task.id).length>0)&&<div className="mt-4">
            <p className="text-sm font-semibold mb-2">Arquivos desta tarefa</p>
            <div className="flex flex-wrap gap-2">{files.filter((file:any)=>file.task_id===task.id).map((file:any)=><button key={file.id} onClick={()=>openFile(file)} className="px-3 py-2 rounded-lg bg-white/5 text-xs">{file.name} ↗</button>)}</div>
          </div>}
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
