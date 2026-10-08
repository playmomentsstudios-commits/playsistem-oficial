import { useEffect,useMemo,useState } from 'react'
import { Link,useNavigate,useParams } from 'react-router-dom'
import { portalApi } from '../../api/portal'
import { projectProgress as progress } from '../../lib/projectProgress'
import { fileManagementApi } from '../../api/fileManagement'
import { useAuth } from '../../contexts/AuthContext'
import { useToast } from '../../contexts/ToastContext'
import { Button } from '../../components/ui/Button'
import { FilePreviewModal } from '../../components/files/FilePreviewModal'
import { exportProjectReportSpreadsheet,printProjectReportPdf } from '../../lib/projectReport'
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


export function AdminProjectDetailV2(){
  const {id=''}=useParams()
  const {user}=useAuth()
  const navigate=useNavigate()
  const toast=useToast()
  const [project,setProject]=useState<any>(null)
  const [team,setTeam]=useState<any[]>([])
  const [customers,setCustomers]=useState<any[]>([])
  const [customerDraft,setCustomerDraft]=useState('')
  const [savingCustomer,setSavingCustomer]=useState(false)
  const [projectViewers,setProjectViewers]=useState<any[]>([])
  const [viewerDraft,setViewerDraft]=useState('')
  const [savingViewer,setSavingViewer]=useState(false)
  const [removingViewer,setRemovingViewer]=useState<string|null>(null)
  const [files,setFiles]=useState<any[]>([])
  const [driveRootItems,setDriveRootItems]=useState<any[]>([])
  const [loading,setLoading]=useState(true)
  const [loadError,setLoadError]=useState<string|null>(null)
  const [loadWarning,setLoadWarning]=useState<string|null>(null)
  const [stageName,setStageName]=useState('')
  const [showStageForm,setShowStageForm]=useState(false)
  const [showTaskForm,setShowTaskForm]=useState(false)
  const [fileTask,setFileTask]=useState('')
  const [fileStage,setFileStage]=useState('')
  const [fileVisible,setFileVisible]=useState(false)
  const [fileFolder,setFileFolder]=useState('received')
  const [uploading,setUploading]=useState(false)
  const [fileProgress,setFileProgress]=useState(0)
  const [fileProgressName,setFileProgressName]=useState('')
  const [fileMenu,setFileMenu]=useState<string|null>(null)
  const [previewFile,setPreviewFile]=useState<any|null>(null)
  const [reviewHistoryFile,setReviewHistoryFile]=useState<any>(null)
  const [reviewHistory,setReviewHistory]=useState<any[]>([])
  const [loadingReviews,setLoadingReviews]=useState(false)
  const [taskForm,setTaskForm]=useState({title:'',stage_id:'',assigned_to:'',priority:'medium',due_date:'',client_visible:true})
  const [projectTab,setProjectTab]=useState<'execucao'|'arquivos'>('execucao')

  const load=async()=>{
    setLoading(true)
    setLoadError(null)
    setLoadWarning(null)
    try{
      // Only the project is essential. A Drive/API failure must not block the project screen.
      const item=await portalApi.project(id)
      setProject(item)
      setCustomerDraft(item?.customer_id||'')
      const results=await Promise.allSettled([
        portalApi.teamMembers(),
        portalApi.projectFiles(id),
        portalApi.customers(),
        portalApi.projectViewers(id),
      ])
      const [members,projectFiles,clientRows,viewerRows]=results
      setTeam(members.status==='fulfilled'?members.value:[])
      setFiles(projectFiles.status==='fulfilled'?projectFiles.value:[])
      setCustomers(clientRows.status==='fulfilled'?clientRows.value:[])
      setProjectViewers(viewerRows.status==='fulfilled'?viewerRows.value:[])
      const warnings=[]
      if(members.status==='rejected')warnings.push('equipe')
      if(projectFiles.status==='rejected')warnings.push('arquivos')
      if(clientRows.status==='rejected')warnings.push('clientes')
      if(viewerRows.status==='rejected')warnings.push('acessos adicionais')
      if(warnings.length)setLoadWarning('Alguns recursos não puderam ser carregados: '+warnings.join(', ')+'. O projeto continua disponível.')
    }catch(error:any){
      setLoadError(error?.message||'Falha ao carregar o projeto.')
    }finally{
      setLoading(false)
    }
  }

  useEffect(()=>{void load()},[id])

  useEffect(()=>{
    if(projectTab!=='arquivos'||!project)return
    let active=true
    // Drive folder provisioning is optional and should never block task management.
    void portalApi.ensureProjectDriveFolder(id).then(folder=>{
      if(active)setDriveRootItems((folder.rootItems||[]).filter((entry:any)=>entry.mimeType!=='application/vnd.google-apps.folder'))
    }).catch(error=>{
      if(active)setLoadWarning('Google Drive indisponível: '+(error?.message||'não foi possível acessar a pasta')+'. As tarefas continuam disponíveis.')
    })
    return ()=>{active=false}
  },[projectTab,id,project?.id])

  async function saveCustomerLink(){
    if(!project||project.project_type==='internal'||savingCustomer)return
    if((project.customer_id||'')===customerDraft)return
    const nextCustomer=customers.find((item:any)=>item.id===customerDraft)
    if(customerDraft&&(!nextCustomer||nextCustomer.status!=='active')){
      toast('Selecione um cliente ativo.','error')
      return
    }
    const previousCustomer=customers.find((item:any)=>item.id===project.customer_id)
    const nextName=nextCustomer?[nextCustomer.first_name,nextCustomer.last_name].filter(Boolean).join(' '):'nenhum cliente'
    const previousName=previousCustomer?[previousCustomer.first_name,previousCustomer.last_name].filter(Boolean).join(' '):'nenhum cliente'
    if(!window.confirm('Alterar acesso ao projeto de '+previousName+' para '+nextName+'? O novo cliente poderá visualizar as etapas, tarefas e arquivos marcados como visíveis para o cliente. O anterior perderá o acesso.'))return
    setSavingCustomer(true)
    try{
      await portalApi.assignProjectCustomer(id,customerDraft||null)
      toast(customerDraft?'Cliente vinculado ao projeto.':'Cliente desvinculado do projeto.','success')
      await load()
    }catch(error:any){toast(error?.message||'Não foi possível atualizar o vínculo.','error')}
    finally{setSavingCustomer(false)}
  }

  async function addViewer(){
    if(!project||!viewerDraft||savingViewer||project.project_type==='internal')return
    const client=customers.find((row:any)=>row.id===viewerDraft)
    if(!client||client.status!=='active'){
      toast('Escolha um cliente ativo.','error')
      return
    }
    if(!project.customer_id){
      toast('Vincule primeiro o cliente principal do projeto.','error')
      return
    }
    if(project.customer_id===viewerDraft||projectViewers.some((row:any)=>row.customer_id===viewerDraft)){
      toast('Este cliente já possui acesso ao projeto.','error')
      return
    }
    setSavingViewer(true)
    try{
      await portalApi.addProjectViewer(id,viewerDraft,user?.id)
      toast('Novo cliente adicionado ao projeto sem substituir os anteriores.','success')
      setViewerDraft('')
      await load()
    }catch(error:any){toast(error?.message||'Não foi possível adicionar o cliente.','error')}
    finally{setSavingViewer(false)}
  }

  async function removeViewer(customerId:string){
    if(removingViewer||project?.project_type==='internal')return
    const client=customers.find((row:any)=>row.id===customerId)
    const name=[client?.first_name,client?.last_name].filter(Boolean).join(' ')||'este cliente'
    if(!window.confirm('Remover o acesso de '+name+' a este projeto? Os demais clientes continuarão vinculados.'))return
    setRemovingViewer(customerId)
    try{
      await portalApi.removeProjectViewer(id,customerId)
      toast('Acesso adicional removido.','success')
      await load()
    }catch(error:any){toast(error?.message||'Não foi possível remover este acesso.','error')}
    finally{setRemovingViewer(null)}
  }

  async function changeStageStatus(stageId:string,status:string){
    const previous=project?.stages?.find((stage:any)=>stage.id===stageId)?.status
    setProject((current:any)=>current?{...current,stages:(current.stages||[]).map((stage:any)=>stage.id===stageId?{...stage,status}:stage)}:current)
    try{await portalApi.saveStage({status},stageId)}
    catch(error:any){
      setProject((current:any)=>current?{...current,stages:(current.stages||[]).map((stage:any)=>stage.id===stageId?{...stage,status:previous}:stage)}:current)
      toast(error?.message||'Não foi possível atualizar a etapa.','error')
    }
  }

  async function changeTaskVisibility(taskId:string,visible:boolean){
    if(visible&&!window.confirm('Liberar esta tarefa e seu checklist para todos os clientes vinculados a este projeto?'))return
    try{
      await portalApi.saveTask({client_visible:visible},taskId)
      toast(visible?'Tarefa liberada para clientes.':'Tarefa ocultada do portal do cliente.','success')
      await load()
    }catch(error:any){toast(error?.message||'Não foi possível atualizar a visibilidade da tarefa.','error')}
  }

  async function changeFileVisibility(file:any,visible:boolean){
    if(project?.project_type==='internal'&&visible){
      toast('Projetos internos não permitem arquivos compartilhados com clientes.','error')
      return
    }
    if(visible&&!window.confirm('Liberar "'+file.name+'" para todos os clientes com acesso ao projeto? Verifique se o material pode ser compartilhado.'))return
    try{
      if(visible&&file.storage_provider==='google_drive'){
        await fileManagementApi.publish(file.id)
      }else{
        await portalApi.setProjectFileVisibility(file.id,visible)
      }
      toast(visible?'Arquivo liberado para os clientes.':'Arquivo ocultado do portal do cliente.','success')
      setFileMenu(null)
      await load()
    }catch(error:any){toast(error?.message||'Não foi possível alterar o compartilhamento do arquivo.','error')}
  }

  async function changeTaskStatus(taskId:string,status:string){
    const previous=project?.tasks?.find((task:any)=>task.id===taskId)
    const completed_at=status==='completed'?(previous?.completed_at||new Date().toISOString()):null
    setProject((current:any)=>current?{...current,tasks:(current.tasks||[]).map((task:any)=>task.id===taskId?{...task,status,completed_at}:task)}:current)
    try{await portalApi.saveTask({status,completed_at},taskId)}
    catch(error:any){
      setProject((current:any)=>current?{...current,tasks:(current.tasks||[]).map((task:any)=>task.id===taskId?{...task,status:previous?.status,completed_at:previous?.completed_at}:task)}:current)
      toast(error?.message||'Não foi possível atualizar a tarefa.','error')
    }
  }

  async function toggleChecklist(taskId:string,itemId:string,completed:boolean){
    setProject((current:any)=>current?{...current,tasks:(current.tasks||[]).map((task:any)=>
      task.id!==taskId?task:{...task,checklist:(task.checklist||[]).map((item:any)=>item.id===itemId?{...item,completed}:item)}
    )}:current)
    try{
      await portalApi.saveChecklistItem({completed},itemId)
    }catch(error:any){
      setProject((current:any)=>current?{...current,tasks:(current.tasks||[]).map((task:any)=>
        task.id!==taskId?task:{...task,checklist:(task.checklist||[]).map((item:any)=>item.id===itemId?{...item,completed:!completed}:item)}
      )}:current)
      toast(error?.message||'Erro ao salvar checklist.','error')
    }
  }

  const sortedStages=useMemo(()=>[...(project?.stages||[])].sort((a:any,b:any)=>a.position-b.position),[project])
  const tasks=project?.tasks||[]
  const pendingFileTasks=useMemo(()=>{
    const rank=(task:any)=>{
      const title=String(task.title||'').trim()
      const card=title.match(/^card\s*0*(\d+)/i)
      if(card)return [0,Number(card[1])]
      if(/^cartaz\b/i.test(title))return [1,0]
      if(/^banner\b/i.test(title))return [2,0]
      return [3,Number(task.position)||0]
    }
    return sortedStages.map((stage:any)=>({
      stage,
      items:tasks.filter((task:any)=>task.stage_id===stage.id&&task.status!=='completed'&&task.status!=='cancelled')
        .sort((a:any,b:any)=>{const x=rank(a),y=rank(b);return x[0]-y[0]||x[1]-y[1]||String(a.title).localeCompare(String(b.title),'pt-BR')})
    })).filter(group=>group.items.length)
  },[tasks,sortedStages])
  const selectedFileTask=tasks.find((task:any)=>task.id===fileTask)
  useEffect(()=>{
    if(fileTask&&(!selectedFileTask||['completed','cancelled'].includes(selectedFileTask.status)))setFileTask('')
  },[fileTask,selectedFileTask?.id,selectedFileTask?.status])
  const effectiveFileStage=selectedFileTask?.stage_id||fileStage||sortedStages[0]?.id||null

  useEffect(()=>{
    if(project?.project_type==='internal'&&!fileStage&&sortedStages[0]?.id)setFileStage(sortedStages[0].id)
  },[project?.project_type,fileStage,sortedStages])

  async function updateProject(values:any){
    try{
      await portalApi.saveProject(values,id)
      toast('Projeto atualizado.','success')
      await load()
    }catch(error:any){toast(error.message,'error')}
  }

  async function deleteProject(){
    if(user?.role!=='admin')return
    const confirmation=window.prompt('Exclusão definitiva. Digite EXCLUIR para remover o projeto do sistema. Os arquivos físicos no Google Drive serão preservados para segurança.')
    if(confirmation!=='EXCLUIR')return
    try{
      await portalApi.deleteProject(id)
      toast('Projeto excluído do sistema. Os arquivos do Google Drive foram preservados.','success')
      navigate('/admin/projetos',{replace:true})
    }catch(error:any){toast(error.message||'Não foi possível excluir o projeto.','error')}
  }

  async function addStage(e:React.FormEvent){
    e.preventDefault()
    if(!stageName.trim())return
    try{
      await portalApi.saveStage({project_id:id,name:stageName.trim(),position:sortedStages.length,status:'pending',client_visible:true})
      setStageName('')
      setShowStageForm(false)
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
      setShowTaskForm(false)
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
    const picked=Array.from(event.target.files||[])
    event.target.value=''
    if(!picked.length||!user)return
    const invalid=picked.find(file=>file.size>50*1024*1024*1024)
    if(invalid){
      toast('Cada arquivo do Google Drive pode ter até 50 GB.','error')
      return
    }
    setUploading(true)
    setFileProgress(0)
    setFileProgressName('')
    try{
      await portalApi.ensureProjectDriveFolder(id)
      for(let index=0;index<picked.length;index+=1){
        const file=picked[index]
        setFileProgressName(file.name)
        await portalApi.uploadDriveFile({
          project_id:id,
          task_id:fileTask||null,
          stage_id:project.project_type==='internal'?effectiveFileStage:null,
          folder_kind:fileFolder,
          client_visible:project.project_type==='internal'?false:fileVisible,
        },file,value=>setFileProgress(Math.round(((index+(value/100))/picked.length)*100)))
      }
      toast(picked.length===1?'Arquivo enviado ao Google Drive e adicionado ao projeto.':picked.length+' arquivos enviados ao projeto.','success')
      setFileProgress(0)
      setFileProgressName('')
      await load()
    }catch(error:any){toast(error.message,'error')}
    finally{setUploading(false)}
  }

  async function uploadNewVersion(event:React.ChangeEvent<HTMLInputElement>,previousFile:any){
    const file=event.target.files?.[0]
    event.target.value=''
    if(!file)return
    if(file.size>50*1024*1024*1024){
      toast('A nova versão pode ter até 50 GB no Google Drive.','error')
      return
    }
    try{
      setUploading(true);setFileProgress(0);setFileProgressName(file.name)
      await portalApi.ensureProjectDriveFolder(id)
      const uploaded=await portalApi.uploadDriveFile({
        project_id:id,
        task_id:previousFile.task_id||null,
        stage_id:project.project_type==='internal'?(previousFile.stage_id||effectiveFileStage):null,
        folder_kind:'preview',
        client_visible:project.project_type==='internal'?false:true,
      },file,setFileProgress)
      await portalApi.linkFileVersion(uploaded.id,previousFile.id)
      toast(project.project_type==='internal'?'Nova versão adicionada ao projeto interno.':'Nova versão adicionada. Agora você pode solicitar a aprovação do cliente.','success')
      setFileMenu(null);setFileProgress(0);setFileProgressName('')
      await load()
    }catch(error:any){toast(error.message||'Não foi possível adicionar a nova versão.','error')}
    finally{setUploading(false)}
  }

  async function requestReview(file:any){
    if(project?.project_type==='internal'){
      toast('Projeto interno não usa aprovação de cliente.','error')
      return
    }
    try{
      if(file.storage_provider==='google_drive'&&!file.client_visible)await fileManagementApi.publish(file.id)
      await portalApi.requestFileReview(file.id)
      toast('Aprovação solicitada ao cliente.','success')
      setFileMenu(null)
      await load()
    }catch(error:any){toast(error.message||'Não foi possível solicitar aprovação.','error')}
  }

  async function cancelReview(file:any){
    try{
      await portalApi.cancelFileReview(file.id)
      toast('Solicitação de aprovação cancelada.','success')
      setFileMenu(null)
      await load()
    }catch(error:any){toast(error.message||'Não foi possível cancelar a aprovação.','error')}
  }

  function reviewBadge(file:any){
    if(!file.review_required)return null
    if(file.review_status==='pending')return {label:'Aguardando cliente',className:'bg-yellow-500/10 text-yellow-300'}
    if(file.review_status==='approved')return {label:'Aprovado',className:'bg-emerald-500/10 text-emerald-400'}
    if(file.review_status==='changes_requested')return {label:'Ajustes solicitados',className:'bg-orange-500/10 text-orange-400'}
    return null
  }

  async function showReviewHistory(file:any){
    try{
      setReviewHistoryFile(file)
      setLoadingReviews(true)
      setFileMenu(null)
      setReviewHistory(await portalApi.fileReviews(file.id))
    }catch(error:any){toast(error.message||'Não foi possível carregar o histórico de aprovação.','error')}
    finally{setLoadingReviews(false)}
  }

  function reviewActionLabel(action:string){
    if(action==='requested')return 'Aprovação solicitada'
    if(action==='approved')return 'Aprovado pelo cliente'
    if(action==='changes_requested')return 'Cliente solicitou ajustes'
    if(action==='cancelled')return 'Solicitação cancelada'
    return action
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

  function openFile(file:any){
    setFileMenu(null)
    setPreviewFile(file)
  }

  if(loading)return <p role="status" className="text-gray-400">Carregando projeto...</p>
  if(loadError)return <div role="alert" className="pm-surface p-5 space-y-3"><p className="text-red-300">Não foi possível carregar este projeto: {loadError}</p><button type="button" onClick={()=>void load()} className="px-4 py-2 rounded-xl bg-[#A65A2A] text-white">Tentar novamente</button></div>
  if(!project)return <div><p>Projeto não encontrado.</p><Link to="/admin/projetos" className="text-[#A65A2A]">Voltar</Link></div>

  return <div>
    <FilePreviewModal file={previewFile} onClose={()=>setPreviewFile(null)}/>
    {loadWarning&&<div role="alert" className="mb-4 rounded-xl border border-amber-500/30 bg-amber-500/10 px-4 py-3 text-sm text-amber-200">{loadWarning} <button type="button" className="ml-2 underline" onClick={()=>void load()}>Tentar novamente</button></div>}
    <Link to="/admin/projetos" className="inline-flex items-center min-h-10 text-sm text-gray-400 hover:text-white">← Voltar para projetos</Link>

    <div className="pm-surface p-5 flex flex-wrap justify-between gap-4 mt-3">
      <div>
        <h1 className="text-2xl font-bold">{project.title}</h1>
        <p className="text-sm text-gray-500 mt-1">{rotulo(tipoProjeto,project.project_type)} · prioridade {rotulo(prioridade,project.priority)}</p>
      </div>
      <div className="flex flex-wrap gap-2">
        <select value={project.status} onChange={e=>updateProject({status:e.target.value})} className="pm-control px-3">{projectStatuses.map(value=><option key={value} value={value}>{rotulo(statusProjeto,value)}</option>)}</select>
        <select value={project.priority} onChange={e=>updateProject({priority:e.target.value})} className="px-3 py-2 rounded-xl bg-black border border-white/10">{priorities.map(value=><option key={value} value={value}>{rotulo(prioridade,value)}</option>)}</select>
        <div className="relative group">
          <button type="button" className="min-h-10 px-3 rounded-xl border border-white/10 bg-white/[.04] text-gray-200 text-xs font-semibold hover:bg-white/[.08]">Exportar relatório ▾</button>
          <div className="absolute right-0 top-full z-20 mt-1 hidden min-w-48 rounded-xl border border-white/10 bg-[#111114] p-1 shadow-xl group-hover:block group-focus-within:block">
            <button type="button" onClick={()=>exportProjectReportSpreadsheet(project,team)} className="w-full rounded-lg px-3 py-2 text-left text-xs text-gray-200 hover:bg-white/[.06]">Planilha (.xls)</button>
            <button type="button" onClick={()=>printProjectReportPdf(project,team)} className="w-full rounded-lg px-3 py-2 text-left text-xs text-gray-200 hover:bg-white/[.06]">Gerar PDF / Imprimir</button>
          </div>
        </div>
        {user?.role==='admin'&&<button type="button" onClick={()=>void deleteProject()} className="min-h-10 px-3 rounded-xl border border-red-500/25 bg-red-500/10 text-red-300 text-xs font-semibold hover:bg-red-500/15">Excluir projeto</button>}
      </div>
    </div>

    <section className="mt-3 pm-surface p-4" aria-label="Cliente vinculado ao projeto">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="text-sm font-semibold">Clientes com acesso ao projeto</h2>
          <p className="text-xs text-gray-500 mt-1">
            {project.project_type==='internal'
              ? 'Projeto interno: não pode ser compartilhado com clientes. Para um trabalho contratado, crie um projeto de serviço ou site.'
              : 'Defina um cliente principal e adicione outros visualizadores. Todos acompanham somente conteúdo liberado para clientes.'}
          </p>
        </div>
        {project.customer_id&&project.project_type!=='internal'&&<Link to={'/admin/clientes/'+project.customer_id} className="text-xs text-[#F1C19D] hover:underline">Abrir cadastro do cliente ↗</Link>}
      </div>
      {project.project_type!=='internal'&&<div className="flex flex-col sm:flex-row gap-2 mt-3">
        <select aria-label="Cliente principal do projeto" value={customerDraft} onChange={e=>setCustomerDraft(e.target.value)} disabled={savingCustomer}
          className="min-h-11 flex-1 px-3 rounded-xl bg-black border border-white/10 disabled:opacity-50">
          <option value="">Sem cliente vinculado</option>
          {customers.map((client:any)=><option key={client.id} value={client.id} disabled={client.status!=='active'}>
            {[client.first_name,client.last_name].filter(Boolean).join(' ')} — {client.email}{client.status!=='active'?' (conta inativa)':''}
          </option>)}
        </select>
        <Button type="button" disabled={savingCustomer||(project.customer_id||'')===customerDraft} onClick={()=>void saveCustomerLink()}>
          {savingCustomer?'Salvando...':project.customer_id?'Trocar cliente principal':'Vincular cliente principal'}
        </Button>
      </div>}
      {project.project_type!=='internal'&&customers.length===0&&<p className="text-xs text-amber-300 mt-2">Não há clientes disponíveis ou não foi possível carregar a lista. Cadastre/ative o cliente na área de Clientes e tente novamente.</p>}
      {project.project_type!=='internal'&&<div className="mt-4 pt-4 border-t border-white/10">
        <h3 className="text-sm font-semibold">Visualizadores adicionais ({projectViewers.length})</h3>
        <p className="text-xs text-gray-500 mt-1">Clientes extras podem visualizar o projeto e arquivos liberados. Apenas o cliente principal pode enviar arquivos e aprovar entregas.</p>
        {projectViewers.length>0&&<div className="flex flex-col gap-2 mt-3">
          {projectViewers.map((access:any)=>{
            const client=customers.find((row:any)=>row.id===access.customer_id)
            return <div key={access.customer_id} className="flex items-center justify-between gap-3 p-3 rounded-xl bg-white/[.035] border border-white/10">
              <div className="min-w-0">
                <p className="text-sm font-medium truncate">{[client?.first_name,client?.last_name].filter(Boolean).join(' ')||'Cliente cadastrado'}</p>
                <p className="text-xs text-gray-500 truncate">{client?.email||'Conta vinculada'}{client?.status!=='active'?' · Acesso suspenso':''}</p>
              </div>
              <button type="button" disabled={removingViewer===access.customer_id} onClick={()=>void removeViewer(access.customer_id)}
                className="min-h-9 px-3 rounded-lg border border-red-500/20 text-red-300 text-xs disabled:opacity-50">Remover</button>
            </div>
          })}
        </div>}
        <div className="flex flex-col sm:flex-row gap-2 mt-3">
          <select aria-label="Adicionar outro cliente ao projeto" value={viewerDraft} onChange={e=>setViewerDraft(e.target.value)}
            disabled={savingViewer||!project.customer_id}
            className="min-h-11 flex-1 px-3 rounded-xl bg-black border border-white/10 disabled:opacity-50">
            <option value="">Selecione outro cliente</option>
            {customers.filter((client:any)=>client.status==='active'&&client.id!==project.customer_id&&!projectViewers.some((a:any)=>a.customer_id===client.id))
              .map((client:any)=><option key={client.id} value={client.id}>
                {[client.first_name,client.last_name].filter(Boolean).join(' ')} — {client.email}
              </option>)}
          </select>
          <Button type="button" disabled={!viewerDraft||savingViewer||!project.customer_id} onClick={()=>void addViewer()}>
            {savingViewer?'Adicionando...':'+ Adicionar cliente'}
          </Button>
        </div>
        {!project.customer_id&&<p className="text-xs text-amber-300 mt-2">Vincule primeiro o cliente principal para poder adicionar mais pessoas.</p>}
      </div>}
      {project.customer_id&&project.project_type!=='internal'&&<p className="text-xs text-emerald-300 mt-3">O cliente principal e os visualizadores ativos podem acessar este projeto em Minha Conta → Projetos.</p>}
    </section>

    <div className="mt-3 pm-surface px-4 py-3">
      <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
        <div className="flex items-center gap-3 min-w-[150px]">
          <span className="text-xs text-gray-400">Progresso</span>
          <b className="text-sm">{progress(project)}%</b>
        </div>
        <div className="h-1.5 bg-white/[.08] rounded-full overflow-hidden flex-1 min-w-[110px]" role="progressbar" aria-label="Progresso do projeto" aria-valuemin={0} aria-valuemax={100} aria-valuenow={progress(project)}>
          <div className="h-full bg-[#A65A2A] rounded-full transition-[width] duration-300" style={{width:progress(project)+'%'}}/>
        </div>
        <details className="text-xs text-gray-400">
          <summary className="cursor-pointer select-none hover:text-white">Detalhes do projeto</summary>
          <div className="mt-3 max-w-2xl space-y-2">
            <p className="whitespace-pre-wrap">{project.description||'Sem descrição.'}</p>
            <p>Início: {project.start_date?new Date(project.start_date+'T12:00').toLocaleDateString('pt-BR'):'—'} · Prazo: {project.due_date?new Date(project.due_date+'T12:00').toLocaleDateString('pt-BR'):'—'}</p>
            {project.drive_folder_url&&<a href={project.drive_folder_url} target="_blank" rel="noreferrer" className="text-[#A65A2A]">Abrir pasta no Drive ↗</a>}
          </div>
        </details>
      </div>
    </div>

    <div className="mt-3 flex gap-2 overflow-x-auto pb-1"><button type="button" onClick={()=>setProjectTab('execucao')} className={'shrink-0 min-h-10 px-4 rounded-xl text-sm font-semibold border '+(projectTab==='execucao'?'bg-[#A65A2A]/15 text-[#F1C19D] border-[#A65A2A]/30':'bg-white/[.03] text-gray-400 border-white/10')}>Execução</button><button type="button" onClick={()=>setProjectTab('arquivos')} className={'shrink-0 min-h-10 px-4 rounded-xl text-sm font-semibold border '+(projectTab==='arquivos'?'bg-[#A65A2A]/15 text-[#F1C19D] border-[#A65A2A]/30':'bg-white/[.03] text-gray-400 border-white/10')}>Arquivos <span className="ml-1 text-[10px] opacity-70">({files.length})</span></button><Link to="/admin/arquivos" className="shrink-0 min-h-10 px-4 rounded-xl text-sm font-semibold border border-white/10 text-gray-400 flex items-center">Central de Arquivos ↗</Link></div>

    {projectTab==='arquivos'&&<div>
    <section className="mt-8">
      <div className="flex flex-wrap justify-between gap-3 items-end">
        <div>
          <h2 className="text-xl font-bold">Arquivos do projeto</h2>
          <p className="text-sm text-gray-500">Os mesmos arquivos da Central de Arquivos, vinculados diretamente a este projeto.</p>
        </div>
        <Link to="/admin/arquivos" className="text-sm text-[#A65A2A]">Abrir Central de Arquivos →</Link>
      </div>

      {driveRootItems.length>0&&<div className="pm-surface p-4 mt-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h3 className="font-semibold">Documentos operacionais na pasta do projeto</h3>
            <p className="text-xs text-gray-500 mt-1">Arquivos colocados diretamente na raiz do Google Drive deste projeto.</p>
          </div>
          {project.drive_folder_url&&<a href={project.drive_folder_url} target="_blank" rel="noreferrer" className="text-xs text-[#A65A2A]">Abrir pasta no Drive ↗</a>}
        </div>
        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-2 mt-4">
          {driveRootItems.map((entry:any)=><a key={entry.id} href={entry.webViewLink} target="_blank" rel="noreferrer" className="p-3 rounded-xl bg-white/[.04] border border-white/10 hover:bg-white/[.07]">
            <p className="text-sm font-medium truncate" title={entry.name}>📊 {entry.name}</p>
            <p className="text-[10px] text-gray-500 mt-1">{entry.modifiedTime?('Atualizado '+new Date(entry.modifiedTime).toLocaleString('pt-BR')):'Documento do projeto'}</p>
          </a>)}
        </div>
      </div>}

      <div className="pm-surface p-4 mt-4">
        <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-3 items-end">
          <label className="text-sm text-gray-400">Direcionar para
            <select value={fileTask} onChange={e=>{const next=e.target.value;setFileTask(next);const linked=tasks.find((task:any)=>task.id===next);if(linked?.stage_id)setFileStage(linked.stage_id)}} className="mt-1 w-full px-3 py-2 rounded-xl bg-black border border-white/10">
              <option value="">Arquivo geral do projeto</option>
              {pendingFileTasks.map(({stage,items}:any)=><optgroup key={stage.id} label={/^\d{4}-\d{2}$/.test(stage.name)?new Date(stage.name+'-01T12:00:00').toLocaleDateString('pt-BR',{month:'long',year:'numeric'}).toUpperCase():stage.name}>{items.map((task:any)=><option key={task.id} value={task.id}>{task.title}</option>)}</optgroup>)}
            </select>
          </label>
          {project.project_type==='internal'?<label className="text-sm text-gray-400">Etapa / pasta no Drive
            <select value={effectiveFileStage||''} disabled={Boolean(selectedFileTask?.stage_id)} onChange={e=>setFileStage(e.target.value)} className="mt-1 w-full px-3 py-2 rounded-xl bg-black border border-white/10 disabled:opacity-60">
              {sortedStages.map((stage:any)=><option key={stage.id} value={stage.id}>{stage.name}</option>)}
            </select>
          </label>:<label className="text-sm text-gray-400">Pasta no Drive
            <select value={fileFolder} onChange={e=>setFileFolder(e.target.value)} className="mt-1 w-full px-3 py-2 rounded-xl bg-black border border-white/10">
              {driveFolderOptions.map(([value,label])=><option key={value} value={value}>{label}</option>)}
            </select>
          </label>}
          {project.project_type==='internal'?<label className="text-sm text-gray-400">Visibilidade
            <div className="mt-1 w-full px-3 py-2 rounded-xl bg-white/5 border border-white/10 text-gray-300">Somente equipe · projeto interno</div>
          </label>:<label className="text-sm text-gray-400">Visibilidade
            <select value={fileVisible?'cliente':'interno'} onChange={e=>setFileVisible(e.target.value==='cliente')} className="mt-1 w-full px-3 py-2 rounded-xl bg-black border border-white/10">
              <option value="interno">Somente equipe</option>
              <option value="cliente">Cliente pode visualizar</option>
            </select>
          </label>}
          <label className={'px-4 py-2.5 rounded-xl text-center '+(uploading?'bg-white/10 text-gray-500 cursor-not-allowed':'bg-[#A65A2A] text-white cursor-pointer')}>
            {uploading?'Enviando...':'Adicionar arquivos'}
            <input type="file" multiple disabled={uploading} onChange={uploadProjectFile} className="hidden"/>
          </label>
        </div>

        {uploading&&fileProgress>0&&<div className="mt-4">
          <div className="flex justify-between gap-3 text-xs text-gray-500"><span className="truncate">{fileProgressName||'Upload para o Google Drive'}</span><span>{fileProgress}%</span></div>
          <div className="h-2 rounded bg-white/10 mt-2"><div className="h-2 rounded bg-[#A65A2A]" style={{width:fileProgress+'%'}}/></div>
        </div>}

        

        <div className="mt-5 grid sm:grid-cols-2 lg:grid-cols-3 gap-3">
          {files.length===0?<p className="text-sm text-gray-500">Nenhum arquivo vinculado a este projeto.</p>:files.map(file=>{
            const review=reviewBadge(file)
            return <div key={file.id} className="p-3 rounded-xl bg-white/5 border border-white/10">
              <div className="flex gap-3">
                <div className="w-12 h-12 shrink-0 rounded-xl bg-black/30 flex items-center justify-center text-2xl">{projectFileIcon(file)}</div>
                <button onClick={()=>openFile(file)} className="text-left min-w-0 flex-1">
                  <div className="flex items-center gap-2 min-w-0"><p className="text-sm font-medium truncate" title={file.name}>{file.name}</p><span className="text-[9px] text-[#A65A2A] shrink-0">v{file.version_number||1}</span></div>
                  <p className="text-xs text-gray-500 mt-1">{fileSize(file.file_size)} · {file.client_visible?'Cliente':'Equipe'}</p>
                  <p className="text-[10px] text-gray-600 mt-1">{file.stage?.name?('📁 '+file.stage.name):(tasks.find((task:any)=>task.id===file.task_id)?.title||'Arquivo geral do projeto')}</p>
                  {review&&<span className={'inline-flex mt-2 px-2 py-1 rounded-full text-[9px] font-semibold '+review.className}>{review.label}</span>}
                </button>
              </div>
              <div className="mt-3 flex justify-end relative">
                <button type="button" onClick={()=>setFileMenu(fileMenu===file.id?null:file.id)} className="w-8 h-8 rounded-lg bg-black/30 hover:bg-black/50 text-gray-400 hover:text-white" title="Ações" aria-label="Ações do arquivo">•••</button>
                {fileMenu===file.id&&<div className="absolute z-20 right-0 bottom-10 w-56 rounded-xl border border-white/10 bg-[#0d0d0f] shadow-2xl p-2">
                  <div className="flex items-center gap-1 mb-2">
                    <button type="button" onClick={()=>{setFileMenu(null);void openFile(file)}} className="w-9 h-9 rounded-lg hover:bg-white/[0.07]" title="Abrir">↗</button>
                    <button type="button" onClick={()=>void renameProjectFile(file)} className="w-9 h-9 rounded-lg hover:bg-white/[0.07]" title="Renomear">✎</button>
                    <label className="w-9 h-9 rounded-lg hover:bg-white/[0.07] flex items-center justify-center cursor-pointer" title="Enviar nova versão">
                      V+
                      <input type="file" className="sr-only" onChange={e=>void uploadNewVersion(e,file)}/>
                    </label>
                    <button type="button" onClick={()=>{setFileMenu(null);void deleteProjectFile(file)}} className="w-9 h-9 rounded-lg hover:bg-red-500/10 text-red-400" title="Excluir">⌫</button>
                  </div>
                  <div className="mb-2">
                    {project.project_type!=='internal'&&!file.review_required&&<button type="button" onClick={()=>void requestReview(file)} className="w-full min-h-9 px-2 rounded-lg bg-[#A65A2A]/10 text-[#ff5d68] text-xs text-left">Solicitar aprovação do cliente</button>}
                    {project.project_type!=='internal'&&file.review_required&&file.review_status==='pending'&&<button type="button" onClick={()=>void cancelReview(file)} className="w-full min-h-9 px-2 rounded-lg bg-white/[0.05] text-gray-300 text-xs text-left">Cancelar solicitação de aprovação</button>}
                    {project.project_type!=='internal'&&file.review_required&&['approved','changes_requested'].includes(file.review_status)&&<button type="button" onClick={()=>void requestReview(file)} className="w-full min-h-9 px-2 rounded-lg bg-white/[0.05] text-gray-300 text-xs text-left">Solicitar nova avaliação</button>}
                    {project.project_type!=='internal'&&file.review_required&&<button type="button" onClick={()=>void showReviewHistory(file)} className="w-full min-h-9 px-2 rounded-lg hover:bg-white/[0.05] text-gray-400 text-xs text-left">Ver histórico e comentários</button>}
                  </div>
                  <label className="flex items-center gap-2 text-[11px] text-gray-300 mb-2">
                     <input type="checkbox" checked={Boolean(file.client_visible)} onChange={e=>void changeFileVisibility(file,e.target.checked)}/>
                     Liberado para o cliente
                   </label>
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
            </div>
          })}
        </div>
      </div>
    </section>

    </div>}

    {projectTab==='execucao'&&<div>
    <section className="mt-4">
      <div className="flex flex-wrap items-center justify-between gap-3 mb-3">
        <div><h2 className="text-base font-bold">Etapas e tarefas</h2><p className="text-xs text-gray-500">Abra uma etapa para acompanhar suas tarefas e checklists.</p></div>
        <div className="flex gap-2">
          <button type="button" aria-expanded={showStageForm} onClick={()=>{setShowStageForm(value=>!value);setShowTaskForm(false)}} className="min-h-9 px-3 rounded-lg border border-white/15 text-gray-200 text-xs font-semibold hover:bg-white/[.06]">{showStageForm?'Fechar etapa':'+ Nova etapa'}</button>
          <button type="button" aria-expanded={showTaskForm} onClick={()=>{setShowTaskForm(value=>!value);setShowStageForm(false)}} className="min-h-9 px-3 rounded-lg bg-[#A65A2A] text-white text-xs font-semibold hover:bg-[#81431E]">{showTaskForm?'Fechar tarefa':'+ Nova tarefa'}</button>
        </div>
      </div>
      {showStageForm&&<form onSubmit={addStage} className="pm-surface p-4 mb-4 flex flex-col sm:flex-row gap-3"><input autoFocus required value={stageName} onChange={e=>setStageName(e.target.value)} placeholder="Nome da etapa (ex.: Produção Dezembro/Janeiro)" className="px-3 py-2 rounded-xl bg-white/5 border border-white/10 flex-1"/><div className="flex gap-2"><Button type="submit">Salvar etapa</Button><button type="button" onClick={()=>setShowStageForm(false)} className="px-3 py-2 text-sm text-gray-400">Cancelar</button></div></form>}
      {showTaskForm&&<form onSubmit={addTask} className="pm-surface p-4 mb-5 grid md:grid-cols-2 lg:grid-cols-5 gap-3">
        <input value={taskForm.title} onChange={e=>setTaskForm({...taskForm,title:e.target.value})} placeholder="Nova tarefa" className="px-3 py-2 rounded-xl bg-white/5 border border-white/10 lg:col-span-2"/>
        <select value={taskForm.stage_id} onChange={e=>setTaskForm({...taskForm,stage_id:e.target.value})} className="px-3 py-2 rounded-xl bg-black border border-white/10"><option value="">Sem etapa</option>{sortedStages.map((stage:any)=><option key={stage.id} value={stage.id}>{stage.name}</option>)}</select>
        <select value={taskForm.assigned_to} onChange={e=>setTaskForm({...taskForm,assigned_to:e.target.value})} className="px-3 py-2 rounded-xl bg-black border border-white/10"><option value="">Sem responsável</option>{team.map(member=><option key={member.id} value={member.id}>{member.first_name} {member.last_name}</option>)}</select>
        <input type="date" value={taskForm.due_date} onChange={e=>setTaskForm({...taskForm,due_date:e.target.value})} className="px-3 py-2 rounded-xl bg-black border border-white/10"/>
        <select value={taskForm.priority} onChange={e=>setTaskForm({...taskForm,priority:e.target.value})} className="px-3 py-2 rounded-xl bg-black border border-white/10">{priorities.map(value=><option key={value} value={value}>{rotulo(prioridade,value)}</option>)}</select>
        <label className="flex items-center gap-2 text-sm text-gray-400"><input type="checkbox" checked={taskForm.client_visible} onChange={e=>setTaskForm({...taskForm,client_visible:e.target.checked})}/> Visível ao cliente</label>
        <div className="lg:col-span-3 flex items-center gap-3"><Button type="submit">Criar tarefa</Button><button type="button" onClick={()=>setShowTaskForm(false)} className="text-sm text-gray-400">Cancelar</button></div>
      </form>}
      <div className="space-y-3">{[...sortedStages,{id:'sem-etapa',name:'Sem etapa',status:'pending',client_visible:false}].map((stage:any)=>{
        const stageTasks=tasks.filter((task:any)=>stage.id==='sem-etapa'?!task.stage_id:task.stage_id===stage.id).sort((a:any,b:any)=>{
          const rank=(task:any)=>{
            const title=String(task.title||'').trim()
            const card=title.match(/^card\\s*0*(\\d+)/i)
            if(card)return [0,Number(card[1])]
            if(/^cartaz\\b/i.test(title))return [1,0]
            if(/^banner\\b/i.test(title))return [2,0]
            return [3,Number(task.position)||0]
          }
          const x=rank(a),y=rank(b)
          return x[0]-y[0]||x[1]-y[1]||String(a.title).localeCompare(String(b.title),'pt-BR')
        })
        if(stage.id==='sem-etapa'&&!stageTasks.length)return null
        const complete=stageTasks.filter((task:any)=>task.status==='completed').length
        return <details key={stage.id} className={'pm-surface rounded-xl border transition-colors '+(stage.status==='completed'?'border-emerald-500/45 bg-emerald-500/[.09]':stage.status==='in_progress'?'border-amber-400/45 bg-amber-400/[.08]':'border-white/10')} >
          <summary className={"cursor-pointer select-none p-4 rounded-xl "+(stage.status==="completed"?"text-emerald-300 hover:bg-emerald-500/[.07]":stage.status==="in_progress"?"text-amber-300 hover:bg-amber-400/[.07]":"hover:bg-white/[.035]")}>
            <span className="font-bold text-base">{/^\d{4}-\d{2}$/.test(stage.name)?new Date(stage.name+'-01T12:00:00').toLocaleDateString('pt-BR',{month:'long',year:'numeric'}):stage.name}</span>
            <span className="ml-3 text-xs text-gray-400">{complete}/{stageTasks.length} tarefas concluídas</span>
          </summary>
          <div className="px-4 pb-4 space-y-3">
            {stage.id!=='sem-etapa'&&<div className="flex flex-wrap items-center gap-3 text-xs text-gray-400 border-b border-white/10 pb-3">
              <label>Etapa <select value={stage.status} onChange={e=>void changeStageStatus(stage.id,e.target.value)} className="ml-2 pm-control rounded-lg p-2">{stageStatuses.map(value=><option key={value} value={value}>{rotulo(statusEtapa,value)}</option>)}</select></label>
              <label className="flex items-center gap-2"><input type="checkbox" checked={stage.client_visible} onChange={async e=>{await portalApi.saveStage({client_visible:e.target.checked},stage.id);await load()}}/> Visível ao cliente</label>
              <button type="button" className="text-red-400 ml-auto" onClick={async()=>{if(window.confirm('Excluir esta etapa? As tarefas permanecem sem etapa.')){await portalApi.deleteStage(stage.id);await load()}}}>Excluir etapa</button>
            </div>}
            {stageTasks.length===0&&<p className="text-sm text-gray-500">Nenhuma tarefa nesta etapa.</p>}
            {stageTasks.map((task:any)=>{
        const member=team.find(item=>item.id===task.assigned_to)
        const stage=sortedStages.find((item:any)=>item.id===task.stage_id)
        return <details key={task.id} className={'rounded-xl border p-3 transition-colors '+(task.status==='completed'?'border-emerald-500/35 bg-emerald-500/[.07]':task.status==='in_progress'?'border-amber-400/35 bg-amber-400/[.07]':task.status==='review'?'border-sky-400/35 bg-sky-400/[.07]':task.status==='cancelled'?'border-white/10 bg-black/10 opacity-60':'border-white/15 bg-white/[.025]')}>
          <summary className={'cursor-pointer font-semibold text-sm select-none '+(task.status==='completed'?'text-emerald-300':task.status==='in_progress'?'text-amber-300':task.status==='review'?'text-sky-300':task.status==='cancelled'?'text-gray-500 line-through':'text-gray-200')}>{task.title} <span className="ml-2 text-xs font-normal opacity-80">· {rotulo(statusTarefa,task.status)}</span></summary>
          <div className="mt-3">
          <div className="flex flex-wrap justify-between gap-3">
            <div>
              <b>{task.title}</b>
              <p className="text-xs text-gray-500 mt-1">{stage?.name||'Sem etapa'} · {member?member.first_name+' '+member.last_name:'Sem responsável'} · prioridade {rotulo(prioridade,task.priority)}</p>
              {task.due_date&&<p className="text-xs text-gray-500 mt-1">Prazo: {new Date(task.due_date+'T12:00').toLocaleDateString('pt-BR')}</p>}
            </div>
            <div className="flex gap-2 items-start">
              <label className="flex items-center gap-2 text-xs text-gray-400 min-h-10">
                <input type="checkbox" checked={Boolean(task.client_visible)} onChange={e=>void changeTaskVisibility(task.id,e.target.checked)}/>
                Visível ao cliente
              </label>
              <select value={task.status} onChange={e=>void changeTaskStatus(task.id,e.target.value)} className={"pm-select-status px-3 py-2 rounded-lg text-sm "+(task.status==="pending"?"pm-state-pending":task.status==="in_progress"?"pm-state-progress":task.status==="review"?"pm-state-review":task.status==="completed"?"pm-state-success":"pm-state-danger")}>{taskStatuses.map(value=><option key={value} value={value}>{rotulo(statusTarefa,value)}</option>)}</select>
              <button onClick={async()=>{if(window.confirm('Excluir esta tarefa?')){await portalApi.deleteTask(task.id);await load()}}} className="px-3 py-2 text-xs text-red-400">Excluir</button>
            </div>
          </div>

          {(files.filter((file:any)=>file.task_id===task.id).length>0)&&<div className="mt-4">
            <p className="text-sm font-semibold mb-2">Arquivos desta tarefa</p>
            <div className="flex flex-wrap gap-2">{files.filter((file:any)=>file.task_id===task.id).map((file:any)=><button key={file.id} onClick={()=>openFile(file)} className="px-3 py-2 rounded-lg bg-white/5 text-xs">{file.name} ↗</button>)}</div>
          </div>}
          <div className="grid lg:grid-cols-2 gap-4 mt-4">
            <div>
              <div className="flex justify-between"><p className="text-sm font-semibold">Checklist</p><button onClick={()=>addChecklist(task.id)} className="text-xs text-[#A65A2A]">+ item</button></div>
              <div className="space-y-1 mt-2">{(task.checklist||[]).sort((a:any,b:any)=>a.position-b.position).map((item:any)=><label key={item.id} className="flex items-center gap-2 text-sm"><input type="checkbox" checked={item.completed} onChange={e=>void toggleChecklist(task.id,item.id,e.target.checked)}/><span className={item.completed?'line-through text-gray-500':''}>{item.title}</span><button type="button" onClick={async()=>{await portalApi.deleteChecklistItem(item.id);await load()}} className="ml-auto text-xs text-red-400">×</button></label>)}</div>
            </div>
            <div>
              <div className="flex justify-between"><p className="text-sm font-semibold">Links</p><button onClick={()=>addLink(task.id)} className="text-xs text-[#A65A2A]">+ link</button></div>
              <div className="space-y-1 mt-2">{(task.links||[]).map((link:any)=><div key={link.id} className="flex items-center gap-2 text-sm"><a href={link.url} target="_blank" rel="noreferrer" className="text-[#A65A2A]">{link.label} ↗</a>{link.client_visible&&<span className="text-[10px] text-emerald-400">cliente</span>}<button onClick={async()=>{await portalApi.deleteTaskLink(link.id);await load()}} className="ml-auto text-xs text-red-400">×</button></div>)}</div>
            </div>
          </div>
          </div>
        </details>
      })}
          </div>
        </details>
      })}</div>
    </section>
    </div>}
  {reviewHistoryFile&&<div className="fixed inset-0 z-[70] bg-black/75 backdrop-blur-sm flex items-center justify-center p-4" onMouseDown={e=>{if(e.currentTarget===e.target)setReviewHistoryFile(null)}}>
    <div className="w-full max-w-xl max-h-[80vh] overflow-hidden rounded-2xl bg-[#111113] border border-white/10 shadow-2xl">
      <div className="h-14 px-4 border-b border-white/10 flex items-center justify-between gap-3">
        <div className="min-w-0">
          <p className="font-semibold text-sm truncate">Histórico de aprovação · {reviewHistoryFile.name}</p>
          <p className="text-[10px] text-gray-500">Versão {reviewHistoryFile.version_number||1}</p>
        </div>
        <button onClick={()=>setReviewHistoryFile(null)} className="w-9 h-9 rounded-lg bg-white/[0.05]">×</button>
      </div>
      <div className="p-4 overflow-y-auto max-h-[calc(80vh-56px)]">
        {loadingReviews?<p className="text-sm text-gray-500">Carregando...</p>:reviewHistory.length===0?<p className="text-sm text-gray-500">Nenhum registro ainda.</p>:<div className="space-y-3">
          {reviewHistory.map(item=><div key={item.id} className="p-3 rounded-xl bg-white/[0.035] border border-white/8">
            <div className="flex justify-between gap-3">
              <p className="text-sm font-semibold">{reviewActionLabel(item.action)}</p>
              <span className="text-[10px] text-gray-600 shrink-0">{new Date(item.created_at).toLocaleString('pt-BR')}</span>
            </div>
            {item.comment&&<p className="text-sm text-gray-300 mt-2 whitespace-pre-wrap">{item.comment}</p>}
            <p className="text-[10px] text-gray-600 mt-2">{item.author?[item.author.first_name,item.author.last_name].filter(Boolean).join(' ')||item.author.email:'Sistema'}</p>
          </div>)}
        </div>}
      </div>
    </div>
  </div>}

  </div>
}
