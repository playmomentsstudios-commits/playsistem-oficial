import { useEffect,useMemo,useRef,useState } from 'react'
import { Link,useNavigate,useParams } from 'react-router-dom'
import { portalApi } from '../../api/portal'
import { adminProjectFolderGroups,standardProjectFolders } from '../../lib/projectFileOrganization'
import { projectProgress as progress } from '../../lib/projectProgress'
import { fileManagementApi } from '../../api/fileManagement'
import { useAuth } from '../../contexts/AuthContext'
import { useToast } from '../../contexts/ToastContext'
import { Button } from '../../components/ui/Button'
import { FilePreviewModal } from '../../components/files/FilePreviewModal'
import { DriveFileThumbnail } from '../../components/files/DriveFileThumbnail'
import { exportProjectReportSpreadsheet,printProjectReportPdf } from '../../lib/projectReport'
import { prioridade,rotulo,statusEtapa,statusProjeto,statusTarefa,tipoProjeto } from '../../lib/labels.ptBR'

const projectStatuses=['planning','active','paused','review','completed','cancelled']
const priorities=['low','medium','high','urgent']
const taskStatuses=['pending','in_progress','review','completed','cancelled']
const stageStatuses=['pending','in_progress','review','completed']
const driveFolderOptions=standardProjectFolders.map(({kind,label})=>[kind,label])

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
  const [folderDirectory,setFolderDirectory]=useState<{standard:any[];custom:any[];stages:any[]}>({standard:[],custom:[],stages:[]})
  const [movingFile,setMovingFile]=useState<string|null>(null)
  const [syncingFiles,setSyncingFiles]=useState(false)
  const [syncedAt,setSyncedAt]=useState<Date|null>(null)
  const syncLock=useRef(false)
  const [driveRootItems,setDriveRootItems]=useState<any[]>([])
  const [loading,setLoading]=useState(true)
  const [loadError,setLoadError]=useState<string|null>(null)
  const [loadWarning,setLoadWarning]=useState<string|null>(null)
  const [stageName,setStageName]=useState('')
  const [showStageForm,setShowStageForm]=useState(false)
  const [showStatusLabels,setShowStatusLabels]=useState(false)
  const [statusLabelDraft,setStatusLabelDraft]=useState<Record<string,string>>({})
  const [showTaskForm,setShowTaskForm]=useState(false)
  const [fileTask,setFileTask]=useState('')
  const [fileStage,setFileStage]=useState('')
  const [fileFolder,setFileFolder]=useState('received')
  const [fileCustomFolder,setFileCustomFolder]=useState('')
  const [creatingReceivedFolder,setCreatingReceivedFolder]=useState(false)
  useEffect(()=>{setFileCustomFolder('')},[id])
  const [taskUploadingId,setTaskUploadingId]=useState<string|null>(null)
  const [taskUploadProgress,setTaskUploadProgress]=useState<{taskId:string;name:string;percent:number;done:number;total:number;status:'uploading'|'done'|'error'}|null>(null)
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
        portalApi.projectDriveFolderDirectory(id),
      ])
      const [members,projectFiles,clientRows,viewerRows,folders]=results
      setTeam(members.status==='fulfilled'?members.value:[])
      setFiles(projectFiles.status==='fulfilled'?projectFiles.value:[])
      setCustomers(clientRows.status==='fulfilled'?clientRows.value:[])
      setProjectViewers(viewerRows.status==='fulfilled'?viewerRows.value:[])
      setFolderDirectory(folders.status==='fulfilled'?folders.value:{standard:[],custom:[],stages:[]})
      const warnings=[]
      if(members.status==='rejected')warnings.push('equipe')
      if(projectFiles.status==='rejected')warnings.push('arquivos')
      if(clientRows.status==='rejected')warnings.push('clientes')
      if(viewerRows.status==='rejected')warnings.push('acessos adicionais')
      if(folders.status==='rejected')warnings.push('pastas do Google Drive')
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

  // Sync on entry and while the file tab is visible: edits saved from Illustrator,
  // Photoshop or the Drive desktop app appear without a manual site upload.
  const syncDriveFiles=async()=>{
    if(!id||syncLock.current)return
    syncLock.current=true
    setSyncingFiles(true)
    try{
      await portalApi.syncDriveProjectFiles(id)
      const refreshed=await portalApi.projectFiles(id)
      setFiles(refreshed)
      setSyncedAt(new Date())
    }catch(error:any){
      setLoadWarning('Sincronização do Drive: '+(error?.message||'não foi possível atualizar os arquivos.'))
    }finally{
      syncLock.current=false
      setSyncingFiles(false)
    }
  }

  useEffect(()=>{
    if(projectTab!=='arquivos'||!project?.id)return
    void syncDriveFiles()
    const onVisible=()=>{if(document.visibilityState==='visible')void syncDriveFiles()}
    const timer=window.setInterval(onVisible,90000)
    document.addEventListener('visibilitychange',onVisible)
    return ()=>{
      window.clearInterval(timer)
      document.removeEventListener('visibilitychange',onVisible)
    }
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

  async function deliverStage(stageId:string){
    if(!project||project.project_type==='internal')return
    const stage=(project.stages||[]).find((item:any)=>item.id===stageId)
    if(!stage||stage.status==='completed'){
      toast('Esta entrega já foi concluída.','error')
      return
    }
    const members=(project.tasks||[]).filter((task:any)=>task.stage_id===stageId)
    if(!members.length||members.some((task:any)=>task.status!=='completed')){
      toast('Conclua todos os materiais desta produção antes de preparar a entrega.','error')
      return
    }
    const associated=new Set(members.map((task:any)=>task.id))
    const stageFiles=files.filter((file:any)=>
      file.storage_provider==='google_drive'&&
      (associated.has(file.task_id)||(!file.task_id&&file.stage_id===stageId))&&
      ['preview','delivery'].includes(file.drive_folder_kind)
    )
    const pending=stageFiles.filter((file:any)=>file.drive_folder_kind==='preview')
    const delivery=folderDirectory.standard.find((row:any)=>row.folder_kind==='delivery')
    if(!delivery?.drive_folder_id){toast('Pasta Entregas não encontrada no Drive.','error');return}
    if(!stageFiles.length){toast('Não há arquivos vinculados a esta produção.','error');return}
    if(stageFiles.some((file:any)=>!file.client_visible)){
      toast('Antes do disparo, libere os arquivos desta entrega para o destinatário autorizado.','error')
      return
    }
    if(!stage.client_visible){
      toast('Torne esta produção visível para o destinatário antes de concluir.','error')
      return
    }
    if(!window.confirm('Finalizar esta entrega? '+pending.length+' arquivo(s) serão movidos para Entregas e uma única atualização será preparada para cada destinatário autorizado. Confirme antes que os links do Google Drive são acessíveis.'))return
    try{
      for(const file of pending)await fileManagementApi.move(file.id,'delivery')
      // Stage status notification is the single completion event. Updating it
      // only after every move succeeds avoids notices for incomplete deliveries.
      await portalApi.saveStage({status:'completed'},stageId)
      await load()
      toast('Entrega concluída. Atualização preparada para os destinatários autorizados.','success')
    }catch(error:any){
      await load()
      toast('Entrega não confirmada: '+(error?.message||'verifique os arquivos')+'. Confira antes de repetir.','error')
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
  const effectiveFileStage=selectedFileTask?.stage_id||(fileStage==='__general__'?null:fileStage||(project?.project_type==='internal'?sortedStages[0]?.id:null))

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

  function openStatusLabels(){
    setStatusLabelDraft({...((project?.status_labels||{}) as Record<string,string>)})
    setShowStatusLabels(true)
  }
  async function saveStatusLabels(){
    const allowed=new Set([
      ...projectStatuses.map(value=>'project.'+value),
      ...stageStatuses.map(value=>'stage.'+value),
      ...taskStatuses.map(value=>'task.'+value),
    ])
    const payload:Record<string,string>={}
    for(const [key,value] of Object.entries(statusLabelDraft)){
      if(allowed.has(key)&&value.trim())payload[key]=value.trim().slice(0,48)
    }
    try{
      await portalApi.saveProject({status_labels:payload},id)
      setProject((current:any)=>({...current,status_labels:payload}))
      setShowStatusLabels(false)
      toast('Rótulos atualizados neste projeto.','success')
    }catch(error:any){toast(error?.message||'Não foi possível salvar os rótulos.','error')}
  }
  const statusLabel=(scope:'project'|'stage'|'task',value:string)=>{
    const overrides=project?.status_labels as Record<string,string>|undefined
    const defaults=scope==='project'?statusProjeto:scope==='stage'?statusEtapa:statusTarefa
    return overrides?.[scope+'.'+value]||rotulo(defaults,value)
  }

  async function renameStage(stage:any){
    const next=window.prompt('Novo nome da etapa',stage.name)?.trim()
    if(!next||next===stage.name)return
    try{
      await portalApi.saveStage({name:next},stage.id)
      await load()
      toast('Etapa renomeada.','success')
    }catch(error:any){toast(error?.message||'Não foi possível renomear a etapa.','error')}
  }

  async function renameTask(task:any){
    const next=window.prompt('Novo título da tarefa',task.title)?.trim()
    if(!next||next===task.title)return
    try{
      await portalApi.saveTask({title:next},task.id)
      await load()
      toast('Tarefa renomeada.','success')
    }catch(error:any){toast(error?.message||'Não foi possível renomear a tarefa.','error')}
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

  async function deleteProjectRootFolder(folderId:string,folderName:string){
    if(!window.confirm('Excluir a pasta vazia "'+folderName+'"? A pasta será movida para a lixeira do Google Drive.'))return
    try{
      await portalApi.deleteCustomDriveFolder(id,folderId)
      setFolderDirectory(await portalApi.projectDriveFolderDirectory(id))
      toast('Pasta vazia movida para a lixeira.','success')
    }catch(error:any){toast(error?.message||'Não foi possível excluir a pasta.','error')}
  }

  async function addProjectRootFolder(){
    if(project.project_type==='internal'){
      toast('Pastas extras na raiz ainda não estão disponíveis para projetos internos.','error')
      return
    }
    const name=window.prompt('Nome da pasta do projeto (ex.: Logos, Fotos, Imagens)')
    if(!name?.trim())return
    try{
      await portalApi.createCustomDriveFolder({project_id:id,parent_kind:'root',name:name.trim(),client_visible:false})
      setFolderDirectory(await portalApi.projectDriveFolderDirectory(id))
      toast('Pasta criada no Google Drive.','success')
    }catch(error:any){toast(error?.message||'Não foi possível criar a pasta.','error')}
  }

  async function addReceivedFolder(){
    if(project.project_type==='internal')return
    const name=window.prompt('Nome da subpasta em 01 — Recebidos (ex.: Pautas — Outubro/Novembro 2026)')
    if(!name?.trim())return
    setCreatingReceivedFolder(true)
    try{
      const created=await portalApi.createCustomDriveFolder({
        project_id:id,parent_kind:'received',name:name.trim(),client_visible:false,
      })
      setFileFolder('received')
      setFileCustomFolder(created.id)
      setFolderDirectory(await portalApi.projectDriveFolderDirectory(id))
      toast('Subpasta criada no Drive. Agora você pode adicionar os arquivos.','success')
    }catch(error:any){toast(error?.message||'Não foi possível criar a subpasta.','error')}
    finally{setCreatingReceivedFolder(false)}
  }

  async function uploadProjectFile(event:React.ChangeEvent<HTMLInputElement>){
    const picked=Array.from(event.target.files||[])
    event.target.value=''
    if(!picked.length||!user||uploading)return
    if(picked.some(file=>file.size>50*1024*1024*1024)){
      toast('Cada arquivo do Google Drive pode ter até 50 GB.','error')
      return
    }
    setUploading(true)
    setFileProgress(0)
    setFileProgressName('Preparando envio...')
    let saved=0
    try{
      await portalApi.ensureProjectDriveFolder(id)
      for(let index=0;index<picked.length;index++){
        const file=picked[index]
        setFileProgressName(file.name)
        const uploaded=await portalApi.uploadDriveFile({
          project_id:id,
          task_id:fileTask||null,
          stage_id:effectiveFileStage,
          folder_kind:fileFolder,
          custom_folder_id:project.project_type==='internal'?null:(fileCustomFolder||null),
          client_visible:false,
        },file,value=>setFileProgress(Math.min(95,Math.round(((index+value/100)/picked.length)*100))))
        if(!uploaded?.id)throw new Error('O arquivo chegou ao Drive, mas não foi confirmado no painel.')
        saved++
        // Optional metadata reconciliation must not turn a successful upload into an error.
        if(fileTask||effectiveFileStage){
          try{
            if(fileTask)await portalApi.assignClientFileTask(uploaded.id,fileTask)
            else if(project.project_type!=='internal'&&effectiveFileStage)await portalApi.assignClientFileStage(uploaded.id,effectiveFileStage)
          }catch(error:any){
            toast('Arquivo salvo. Confira o vínculo com a tarefa/etapa: '+(error?.message||'não confirmado'),'error')
          }
        }
      }
      setFileProgress(100)
      setFileProgressName('Envio concluído')
      toast(saved===1?'Arquivo enviado com sucesso.':saved+' arquivos enviados com sucesso.','success')
    }catch(error:any){
      toast((saved?saved+' arquivo(s) já salvo(s). ':'')+(error?.message||'Não foi possível confirmar o envio.')+' Confira a lista antes de reenviar.','error')
    }finally{
      setUploading(false)
      try{await load()}catch{toast('Envio finalizado. Atualize a lista para conferir os arquivos.','error')}
    }
  }

  async function uploadTaskFile(event:React.ChangeEvent<HTMLInputElement>,task:any){
    const picked=Array.from(event.target.files||[])
    event.target.value=''
    if(!picked.length||!user||taskUploadingId)return
    if(project.project_type==='internal'&&!task.stage_id){
      toast('Vincule uma etapa à tarefa antes de enviar arquivos neste projeto interno.','error')
      return
    }
    if(picked.some(file=>file.size>50*1024*1024*1024)){
      toast('Cada arquivo do Google Drive pode ter até 50 GB.','error')
      return
    }
    setTaskUploadingId(task.id)
    setTaskUploadProgress({taskId:task.id,name:picked[0].name,percent:0,done:0,total:picked.length,status:'uploading'})
    let completed=0
    try{
      await portalApi.ensureProjectDriveFolder(id)
      for(const file of picked){
        setTaskUploadProgress({taskId:task.id,name:file.name,percent:0,done:completed,total:picked.length,status:'uploading'})
        const uploaded=await portalApi.uploadDriveFile({
          project_id:id,
          task_id:task.id,
          stage_id:task.stage_id||null,
          folder_kind:project.project_type==='internal'?'production':'preview',
          client_visible:false,
        },file,percent=>setTaskUploadProgress({taskId:task.id,name:file.name,percent,done:completed,total:picked.length,status:'uploading'}))
        if(!uploaded?.id)throw new Error('O arquivo chegou ao Drive, mas não foi confirmado no painel.')
        await portalApi.assignClientFileTask(uploaded.id,task.id)
        if(project.project_type!=='internal'&&task.stage_id){
          await portalApi.assignClientFileStage(uploaded.id,task.stage_id)
        }
        completed++
        setTaskUploadProgress({taskId:task.id,name:file.name,percent:100,done:completed,total:picked.length,status:'uploading'})
      }
      await load()
      setTaskUploadProgress({taskId:task.id,name:picked[picked.length-1].name,percent:100,done:completed,total:picked.length,status:'done'})
      toast(completed===1?'Arquivo vinculado à tarefa com sucesso.':completed+' arquivos vinculados à tarefa.','success')
    }catch(error:any){
      setTaskUploadProgress({taskId:task.id,name:picked[Math.min(completed,picked.length-1)].name,percent:0,done:completed,total:picked.length,status:'error'})
      toast((error?.message||'Falha no envio ou na associação.')+' Confira o arquivo antes de reenviar.','error')
      try{await load()}catch{}
    }finally{setTaskUploadingId(null)}
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
        stage_id:previousFile.stage_id||tasks.find((task:any)=>task.id===previousFile.task_id)?.stage_id||(project.project_type==='internal'?effectiveFileStage:null),
        folder_kind:'preview',
        client_visible:project.project_type==='internal'?false:true,
      },file,setFileProgress)
      await portalApi.linkFileVersion(uploaded.id,previousFile.id)
      if(project.project_type!=='internal'&&uploaded?.id){
        const stageId=previousFile.stage_id||tasks.find((task:any)=>task.id===previousFile.task_id)?.stage_id||null
        if(stageId)await portalApi.assignClientFileStage(uploaded.id,stageId)
      }
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

  async function moveProjectFile(file:any,destination:string){
    if(movingFile||file.storage_provider!=='google_drive'||!file.drive_file_id)return
    const isCustom=destination.startsWith('custom:')
    const folder=isCustom?folderDirectory.custom.find((row:any)=>row.id===destination.slice(7)):folderDirectory.standard.find((row:any)=>row.folder_kind===destination)
    if(!folder)return toast('Pasta de destino indisponível. Atualize a lista.','error')
    if(file.drive_folder_id===folder.drive_folder_id)return toast('Arquivo já está nessa pasta.','success')
    const folderName=isCustom?folder.name:folder.folder_name
    if(!window.confirm('Mover "'+file.name+'" para "'+folderName+'" no Google Drive? A etapa, tarefa e visibilidade serão preservadas.'))return
    setMovingFile(file.id)
    try{
      if(isCustom)await fileManagementApi.moveToCustom(file.id,folder.id)
      else await fileManagementApi.move(file.id,destination)
      toast('Arquivo movido para '+folderName+'.','success')
      setFileMenu(null)
      await load()
    }catch(error:any){toast(error?.message||'Não foi possível mover o arquivo.','error')}
    finally{setMovingFile(null)}
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

  const fileGroups=adminProjectFolderGroups(files,folderDirectory.standard,folderDirectory.custom,folderDirectory.stages,project.drive_folder_id)
  const foldersWithFiles=fileGroups.filter(group=>group.files.length>0).length
  const publishedFiles=files.filter(file=>file.client_visible).length
  const primaryCustomer=customers.find((item:any)=>item.id===project.customer_id)
  const primaryCustomerName=project.customer_id
    ? ([primaryCustomer?.first_name,primaryCustomer?.last_name].filter(Boolean).join(' ')||'Cliente vinculado')
    : 'Não vinculado'
  const additionalViewerNames=projectViewers.map((access:any)=>{
    const client=customers.find((item:any)=>item.id===access.customer_id)
    return [client?.first_name,client?.last_name].filter(Boolean).join(' ')||'Cliente cadastrado'
  })

  return <div>
    <FilePreviewModal file={previewFile} onClose={()=>setPreviewFile(null)}/>
    {loadWarning&&<div role="alert" className="mb-4 rounded-xl border border-amber-500/30 bg-amber-500/10 px-4 py-3 text-sm text-amber-200">{loadWarning} <button type="button" className="ml-2 underline" onClick={()=>void load()}>Tentar novamente</button></div>}
    <Link to="/admin/projetos" className="inline-flex min-h-8 items-center text-xs text-gray-400 hover:text-white">← Projetos</Link>

    <section className="pm-surface relative z-20 mt-1 px-3 py-3 sm:px-4" aria-label="Resumo do projeto">
      <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
            <h1 className="min-w-0 text-xl font-bold leading-tight sm:text-2xl">{project.title}</h1>
            <span className="shrink-0 rounded-md border border-white/10 bg-white/[.04] px-2 py-1 text-[10px] font-medium text-gray-400">{rotulo(tipoProjeto,project.project_type)}</span>
          </div>
          <div className="mt-2 flex flex-wrap items-center gap-2">
            <label className="inline-flex items-center gap-1.5 text-[11px] text-gray-500">
              <span>Andamento</span>
              <select aria-label="Andamento do projeto" value={project.status} onChange={e=>void updateProject({status:e.target.value})}
                className="h-8 max-w-[160px] rounded-lg border border-white/10 bg-[#171719] px-2 text-xs font-medium text-gray-100 focus-visible:outline-2 focus-visible:outline-[#A65A2A]">
                {projectStatuses.map(value=><option key={value} value={value}>{statusLabel('project',value)}</option>)}
              </select>
            </label>
            <button type="button" onClick={openStatusLabels} title="Personalizar nomes dos status deste projeto" className="h-8 rounded-lg border border-white/15 px-2 text-xs text-gray-400 hover:text-white">Editar status</button>
            <label className="inline-flex items-center gap-1.5 text-[11px] text-gray-500">
              <span>Prioridade</span>
              <select aria-label="Prioridade do projeto" value={project.priority} onChange={e=>void updateProject({priority:e.target.value})}
                className="h-8 max-w-[116px] rounded-lg border border-white/10 bg-[#171719] px-2 text-xs font-medium text-gray-100 focus-visible:outline-2 focus-visible:outline-[#A65A2A]">
                {priorities.map(value=><option key={value} value={value}>{rotulo(prioridade,value)}</option>)}
              </select>
            </label>
            {project.due_date&&<span className="text-[11px] text-gray-500">Entrega {new Date(project.due_date+'T12:00').toLocaleDateString('pt-BR')}</span>}
          </div>
        </div>
        <details className="group relative shrink-0 self-start">
          <summary className="flex min-h-9 cursor-pointer list-none items-center gap-2 rounded-lg border border-white/15 bg-white/[.04] px-3 text-xs font-semibold text-gray-200 hover:bg-white/[.08] focus-visible:outline-2 focus-visible:outline-[#A65A2A]">
            <span aria-hidden="true">⋯</span> Ações <span aria-hidden="true" className="text-gray-500 transition-transform group-open:rotate-180">▾</span>
          </summary>
          <div className="absolute right-0 top-full z-30 mt-1 w-56 rounded-xl border border-white/15 bg-[#111114] p-1.5 shadow-2xl">
            <button type="button" onClick={()=>exportProjectReportSpreadsheet(project,team)} className="w-full rounded-lg px-3 py-2.5 text-left text-xs text-gray-200 hover:bg-white/[.07]">Exportar planilha (.xls)</button>
            <button type="button" onClick={()=>printProjectReportPdf(project,team)} className="w-full rounded-lg px-3 py-2.5 text-left text-xs text-gray-200 hover:bg-white/[.07]">Gerar relatório PDF</button>
            {user?.role==='admin'&&<>
              <div className="my-1 border-t border-white/10"/>
              <button type="button" onClick={()=>void deleteProject()} className="w-full rounded-lg px-3 py-2.5 text-left text-xs text-red-300 hover:bg-red-500/10">Excluir projeto</button>
            </>}
          </div>
        </details>
      </div>

      <div className="mt-3 flex flex-wrap items-center gap-x-3 gap-y-2 border-t border-white/[.07] pt-3">
        <span className="shrink-0 text-[11px] text-gray-400">Progresso <strong className="ml-1 text-xs text-white">{progress(project)}%</strong></span>
        <div className="h-1.5 min-w-[105px] flex-1 overflow-hidden rounded-full bg-white/[.08]" role="progressbar" aria-label="Progresso do projeto" aria-valuemin={0} aria-valuemax={100} aria-valuenow={progress(project)}>
          <div className={"h-full rounded-full transition-[width] duration-300 "+(project.status==='completed'?'bg-emerald-500':'bg-[#A65A2A]')} style={{width:progress(project)+'%'}}/>
        </div>
        <details className="group relative shrink-0 text-xs text-gray-400">
          <summary className="flex cursor-pointer list-none items-center gap-1 rounded-md px-1 py-1 hover:text-white focus-visible:outline-2 focus-visible:outline-[#A65A2A]">
            Informações <span aria-hidden="true" className="transition-transform group-open:rotate-180">▾</span>
          </summary>
          <div className="absolute right-0 top-full z-30 mt-2 w-[min(22rem,82vw)] space-y-2 rounded-xl border border-white/15 bg-[#111114] p-4 text-xs leading-5 text-gray-300 shadow-2xl">
            <p className="whitespace-pre-wrap break-words">{project.description||'Sem descrição.'}</p>
            <p>Início: {project.start_date?new Date(project.start_date+'T12:00').toLocaleDateString('pt-BR'):'—'} · Prazo: {project.due_date?new Date(project.due_date+'T12:00').toLocaleDateString('pt-BR'):'—'}</p>
            {project.drive_folder_url&&<a href={project.drive_folder_url} target="_blank" rel="noopener noreferrer" className="inline-block text-[#F1C19D] hover:underline">Abrir pasta no Drive ↗</a>}
          </div>
        </details>
      </div>
    </section>

    <section className="pm-surface mt-2 px-3 py-2 sm:px-4" aria-label="Clientes com acesso ao projeto">
      {project.project_type==='internal'
        ? <div className="flex min-h-9 flex-wrap items-center gap-3 text-xs">
            <span className="font-semibold text-gray-200">Acessos</span>
            <span className="rounded-lg bg-white/[.05] px-2.5 py-1.5 text-gray-400">Somente equipe · projeto interno</span>
          </div>
        : <details className="group">
            <summary className="flex min-h-9 cursor-pointer list-none flex-wrap items-center gap-x-3 gap-y-2 focus-visible:outline-2 focus-visible:outline-[#A65A2A]">
              <span className="shrink-0 text-xs font-semibold text-gray-200">Acessos</span>
              <span className="min-w-0 max-w-full rounded-lg border border-white/10 bg-white/[.035] px-2.5 py-1.5 text-xs text-gray-200">
                <span className="mr-1.5 text-[10px] text-gray-500">Principal</span>
                <span className="font-medium">{primaryCustomerName}</span>
              </span>
              {projectViewers.length>0&&<span className="min-w-0 max-w-full truncate rounded-lg border border-white/10 bg-white/[.035] px-2.5 py-1.5 text-xs text-gray-300" title={additionalViewerNames.join(', ')}>
                <span className="mr-1.5 text-[10px] text-gray-500">+{projectViewers.length} acesso{projectViewers.length===1?'':'s'}</span>
                {additionalViewerNames.slice(0,2).join(', ')}{projectViewers.length>2?'…':''}
              </span>}
              <span className="ml-auto inline-flex shrink-0 items-center gap-2 text-xs font-medium text-[#F1C19D]">
                Gerenciar <span aria-hidden="true" className="transition-transform group-open:rotate-180">▾</span>
              </span>
            </summary>
            <div className="mt-3 grid grid-cols-1 gap-3 border-t border-white/[.07] pt-3 lg:grid-cols-2">
              <div className="min-w-0 rounded-xl border border-white/[.07] bg-black/15 p-3">
                <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
                  <h2 className="text-xs font-semibold text-white">Cliente principal</h2>
                  {project.customer_id&&<Link to={'/admin/clientes/'+project.customer_id} className="text-[11px] text-[#F1C19D] hover:underline">Ver cadastro ↗</Link>}
                </div>
                <div className="flex flex-col gap-2 sm:flex-row lg:flex-col xl:flex-row">
                  <select aria-label="Cliente principal do projeto" value={customerDraft} onChange={e=>setCustomerDraft(e.target.value)} disabled={savingCustomer}
                    className="min-h-10 min-w-0 flex-1 rounded-lg border border-white/10 bg-black px-3 text-xs text-gray-100 disabled:opacity-50">
                    <option value="">Sem cliente vinculado</option>
                    {customers.map((client:any)=><option key={client.id} value={client.id} disabled={client.status!=='active'}>
                      {[client.first_name,client.last_name].filter(Boolean).join(' ')} — {client.email}{client.status!=='active'?' (conta inativa)':''}
                    </option>)}
                  </select>
                  <Button type="button" disabled={savingCustomer||(project.customer_id||'')===customerDraft} onClick={()=>void saveCustomerLink()}>
                    {savingCustomer?'Salvando...':project.customer_id?'Trocar':'Vincular'}
                  </Button>
                </div>
                {customers.length===0&&<p className="mt-2 text-xs text-amber-300">Nenhum cliente ativo disponível. Cadastre ou ative um cliente primeiro.</p>}
                <p className="mt-2 text-[11px] leading-4 text-gray-500">Somente o cliente principal pode enviar arquivos e aprovar entregas.</p>
              </div>

              <div className="min-w-0 rounded-xl border border-white/[.07] bg-black/15 p-3">
                <h2 className="mb-2 text-xs font-semibold text-white">Visualizadores adicionais ({projectViewers.length})</h2>
                {projectViewers.length>0&&<div className="mb-2 max-h-36 space-y-1.5 overflow-y-auto">
                  {projectViewers.map((access:any)=>{
                    const client=customers.find((row:any)=>row.id===access.customer_id)
                    return <div key={access.customer_id} className="flex min-w-0 items-center justify-between gap-2 rounded-lg border border-white/[.07] bg-white/[.025] px-2.5 py-1.5">
                      <div className="min-w-0">
                        <p className="truncate text-xs font-medium text-white">{[client?.first_name,client?.last_name].filter(Boolean).join(' ')||'Cliente cadastrado'}</p>
                        <p className="truncate text-[10px] text-gray-500">{client?.email||'Conta vinculada'}{client?.status!=='active'?' · Acesso suspenso':''}</p>
                      </div>
                      <button type="button" disabled={removingViewer===access.customer_id} onClick={()=>void removeViewer(access.customer_id)}
                        className="min-h-8 shrink-0 rounded-lg border border-red-500/20 px-2.5 text-[11px] text-red-300 hover:bg-red-500/10 disabled:opacity-50">Remover</button>
                    </div>
                  })}
                </div>}
                <div className="flex flex-col gap-2 sm:flex-row lg:flex-col xl:flex-row">
                  <select aria-label="Adicionar outro cliente ao projeto" value={viewerDraft} onChange={e=>setViewerDraft(e.target.value)}
                    disabled={savingViewer||!project.customer_id}
                    className="min-h-10 min-w-0 flex-1 rounded-lg border border-white/10 bg-black px-3 text-xs text-gray-100 disabled:opacity-50">
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
                {!project.customer_id&&<p className="mt-2 text-[11px] text-amber-300">Vincule um cliente principal para adicionar visualizadores.</p>}
              </div>
              <p className="text-[11px] text-gray-500 lg:col-span-2">Os clientes visualizam somente conteúdo liberado. As permissões são gerenciadas por projeto.</p>
            </div>
          </details>}
    </section>

    <div className="mt-2 flex gap-2 overflow-x-auto pb-1" aria-label="Seções do projeto"><button type="button" onClick={()=>setProjectTab('execucao')} className={'shrink-0 min-h-10 px-4 rounded-xl text-sm font-semibold border '+(projectTab==='execucao'?'bg-[#A65A2A]/15 text-[#F1C19D] border-[#A65A2A]/30':'bg-white/[.03] text-gray-400 border-white/10')}>Execução</button><button type="button" onClick={()=>setProjectTab('arquivos')} className={'shrink-0 min-h-10 px-4 rounded-xl text-sm font-semibold border '+(projectTab==='arquivos'?'bg-[#A65A2A]/15 text-[#F1C19D] border-[#A65A2A]/30':'bg-white/[.03] text-gray-400 border-white/10')}>Arquivos <span className="ml-1 text-[10px] opacity-70">({files.length})</span></button><Link to="/admin/arquivos" className="shrink-0 min-h-10 px-4 rounded-xl text-sm font-semibold border border-white/10 text-gray-400 flex items-center">Central de Arquivos ↗</Link></div>

    {projectTab==='arquivos'&&<div>
    <section className="mt-8">
      <div className="flex flex-wrap justify-between gap-3 items-end">
        <div>
          <h2 className="text-xl font-bold">Arquivos do projeto</h2>
          <p className="text-sm text-gray-500">Pastas reais do Google Drive. Organize arquivos sem perder os vínculos das etapas e tarefas.</p>
           <p className="mt-1 text-xs text-gray-400">{files.length} arquivo(s) · {foldersWithFiles} pasta(s) com conteúdo · {publishedFiles} liberado(s) ao cliente</p>
        </div>
<div className="flex items-center flex-wrap gap-3">
          <span className="text-[11px] text-gray-500">{syncingFiles?'Atualizando arquivos do Drive...':syncedAt?'Sincronizado às '+syncedAt.toLocaleTimeString('pt-BR',{hour:'2-digit',minute:'2-digit'}):'Sincronização automática ativa'}</span>
          <button type="button" disabled={syncingFiles} onClick={()=>void syncDriveFiles()} className="min-h-9 px-3 rounded-xl border border-white/15 text-xs text-gray-200 disabled:opacity-50">↻ Atualizar agora</button>
          <Link to="/admin/arquivos" className="text-sm text-[#A65A2A]">Abrir Central de Arquivos →</Link>
        </div>
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
            <select value={fileCustomFolder?'custom:'+fileCustomFolder:fileFolder} onChange={e=>{
              const value=e.target.value
              if(value.startsWith('custom:')){
                const custom=folderDirectory.custom.find((folder:any)=>folder.id===value.slice(7))
                if(custom){setFileCustomFolder(custom.id);setFileFolder(custom.parent_kind==='root'?'received':custom.parent_kind)}
              }else{setFileFolder(value);setFileCustomFolder('')}
            }} className="mt-1 w-full px-3 py-2 rounded-xl bg-black border border-white/10">
              <optgroup label="Pastas principais">{driveFolderOptions.map(([value,label])=><option key={value} value={value}>{label}</option>)}</optgroup>
              {folderDirectory.custom.length>0&&<optgroup label="Pastas personalizadas">{folderDirectory.custom.map((folder:any)=><option key={folder.id} value={'custom:'+folder.id}>{folder.name}</option>)}</optgroup>}
            </select>
          </label>}
          {project.project_type!=='internal'&&fileFolder==='received'&&!fileCustomFolder&&<div className="flex items-end gap-2">
            <label className="min-w-0 flex-1 text-sm text-gray-400">Subpasta (opcional)
              <select value={fileCustomFolder} onChange={e=>setFileCustomFolder(e.target.value)} className="mt-1 w-full px-3 py-2 rounded-xl bg-black border border-white/10">
                <option value="">Direto em 01 — Recebidos</option>
                {folderDirectory.custom.filter((folder:any)=>folder.parent_kind==='received').map((folder:any)=><option key={folder.id} value={folder.id}>{folder.name}</option>)}
              </select>
            </label>
            <button type="button" title="Criar subpasta em Recebidos" aria-label="Criar subpasta em Recebidos" disabled={creatingReceivedFolder||uploading} onClick={()=>void addReceivedFolder()} className="h-10 w-10 shrink-0 rounded-xl border border-white/15 text-lg text-[#DFA269] disabled:opacity-50">+</button>
          </div>}
          {project.project_type!=='internal'&&<label className="text-sm text-gray-400">Etapa do arquivo
            <select value={effectiveFileStage||'__general__'} disabled={Boolean(selectedFileTask?.stage_id)} onChange={e=>setFileStage(e.target.value)} className="mt-1 w-full px-3 py-2 rounded-xl bg-black border border-white/10 disabled:opacity-60">
              <option value="__general__">Arquivo geral (sem etapa)</option>
              {sortedStages.map((stage:any)=><option key={stage.id} value={stage.id}>{stage.name}</option>)}
            </select>
          </label>}
          <div className="text-sm text-gray-400">Disponibilização
            <div className="mt-1 w-full px-3 py-2 rounded-xl bg-white/5 border border-white/10 text-gray-300">Rascunho interno · publique após conferir</div>
          </div>
          <label className={'px-4 py-2.5 rounded-xl text-center '+(uploading?'bg-white/10 text-gray-500 cursor-not-allowed':'bg-[#A65A2A] text-white cursor-pointer')}>
            {uploading?'Enviando...':'Adicionar arquivos'}
            <input type="file" multiple disabled={uploading} onChange={uploadProjectFile} className="hidden"/>
          </label>
        </div>

        {(uploading||fileProgress===100)&&fileProgressName&&<div role="status" aria-live="polite" className="mt-4">
          <div className="flex justify-between gap-3 text-xs text-gray-500"><span className="truncate">{fileProgressName||'Upload para o Google Drive'}</span><span>{fileProgress}%</span></div>
          <div className="h-2 rounded bg-white/10 mt-2"><div className="h-2 rounded bg-[#A65A2A]" style={{width:fileProgress+'%'}}/></div>
        </div>}

        

        {project.project_type!=='internal'&&<div className="mt-4 flex justify-end">
          <button type="button" onClick={()=>void addProjectRootFolder()} className="min-h-9 rounded-lg border border-white/15 px-3 text-xs text-gray-300 hover:bg-white/[.06]">+ Nova pasta</button>
        </div>}
        <div className="mt-5 space-y-3" aria-label="Arquivos por pasta no Google Drive">
          {files.length===0&&<p className="text-sm text-gray-500">Nenhum arquivo vinculado a este projeto.</p>}
          {fileGroups.map(group=><details key={group.key} open={group.files.length>0} className="rounded-xl border border-white/10 bg-black/20">
            <summary className="flex min-h-12 cursor-pointer list-none items-center justify-between gap-3 px-3 py-2 text-xs sm:px-4">
              <span className="flex min-w-0 items-center gap-2"><span aria-hidden="true">📁</span><strong className="truncate text-gray-100">{group.name}</strong>{group.parent&&<span className="hidden text-gray-500 sm:inline">· {group.parent}</span>}</span>
              <span className="flex shrink-0 items-center gap-2 text-gray-400">{group.files.length} arquivo(s)
                {group.kind==='custom'&&group.files.length===0&&folderDirectory.custom.some((folder:any)=>group.key==='custom:'+folder.id&&folder.parent_kind==='root')&&<button type="button" title="Excluir pasta vazia" aria-label="Excluir pasta vazia" onClick={e=>{e.preventDefault();e.stopPropagation();const folder=folderDirectory.custom.find((row:any)=>group.key==='custom:'+row.id);if(folder)void deleteProjectRootFolder(folder.id,folder.name)}} className="rounded px-2 py-1 text-red-400 hover:bg-red-500/10">Excluir</button>}
                <span aria-hidden="true">▾</span></span>
            </summary>
            <div className="border-t border-white/10 p-2.5 sm:p-3">
              {group.files.length===0?<p className="py-2 text-xs text-gray-500">Pasta vazia.</p>:<div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
          {group.files.map(file=>{
            const review=reviewBadge(file)
            return <div key={file.id} className="p-3 rounded-xl bg-white/5 border border-white/10">
              <div className="flex gap-3">
                <button type="button" onClick={()=>openFile(file)} title={'Visualizar '+file.name} className="w-12 h-12 shrink-0 rounded-xl bg-black/30 flex items-center justify-center text-2xl overflow-hidden"><DriveFileThumbnail file={file} fallback={projectFileIcon(file)} className="w-full h-full"/></button>
                <button onClick={()=>openFile(file)} className="text-left min-w-0 flex-1">
                  <div className="flex items-center gap-2 min-w-0"><p className="text-sm font-medium truncate" title={file.name}>{file.name}</p><span className="text-[9px] text-[#A65A2A] shrink-0">v{file.version_number||1}</span></div>
                  <p className="text-xs text-gray-500 mt-1">{fileSize(file.file_size)} · {file.client_visible?'Cliente':'Equipe'}</p>
                  <p className="text-[10px] text-gray-400 mt-1">{tasks.find((task:any)=>task.id===file.task_id)?.title?('Tarefa: '+tasks.find((task:any)=>task.id===file.task_id)?.title):'Sem tarefa vinculada'}</p>
                  <p className="text-[10px] text-gray-500 mt-1">Etapa: {tasks.find((task:any)=>task.id===file.task_id)?.stage_id?sortedStages.find((stage:any)=>stage.id===tasks.find((task:any)=>task.id===file.task_id)?.stage_id)?.name||'Não localizada':file.stage?.name||'Não vinculada'}</p>
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
                    <select value={file.task_id||''} onChange={async e=>{try{await portalApi.assignClientFileTask(file.id,e.target.value||null);setFileMenu(null);await load()}catch(error:any){toast(error?.message||'Não foi possível vincular a tarefa.','error')}}} className="mt-1 w-full px-2 py-1.5 rounded-lg bg-black border border-white/10 text-xs">
                      <option value="">Arquivo geral</option>
                      {tasks.map((task:any)=><option key={task.id} value={task.id}>{task.title}</option>)}
                    </select>
                  </label>
                  <label className="block text-[10px] text-gray-500 mt-2">Etapa vinculada
                    <select value={tasks.find((task:any)=>task.id===file.task_id)?.stage_id||file.stage_id||''}
                      disabled={Boolean(file.task_id&&tasks.find((task:any)=>task.id===file.task_id)?.stage_id)}
                      onChange={async e=>{try{await portalApi.assignClientFileStage(file.id,e.target.value||null);setFileMenu(null);await load()}catch(error:any){toast(error?.message||'Não foi possível mudar a etapa do arquivo.','error')}}}
                      className="mt-1 w-full px-2 py-1.5 rounded-lg bg-black border border-white/10 text-xs disabled:opacity-60">
                      <option value="">Arquivo geral (sem etapa)</option>
                      {sortedStages.map((stage:any)=><option key={stage.id} value={stage.id}>{stage.name}</option>)}
                    </select>
                  </label>
                  {file.storage_provider==='google_drive'&&<label className="block text-[10px] text-gray-500 mt-2">Pasta física no Drive
                    <select value={folderDirectory.custom.some((row:any)=>row.drive_folder_id===file.drive_folder_id)?'custom:'+folderDirectory.custom.find((row:any)=>row.drive_folder_id===file.drive_folder_id)?.id:folderDirectory.standard.find((row:any)=>row.drive_folder_id===file.drive_folder_id)?.folder_kind||''}
                      disabled={movingFile===file.id} onChange={e=>{if(e.target.value)void moveProjectFile(file,e.target.value)}}
                      className="mt-1 w-full px-2 py-1.5 rounded-lg bg-black border border-white/10 text-xs disabled:opacity-60">
                      <option value="">Outra pasta / raiz</option>
                      {folderDirectory.standard.map((row:any)=><option key={row.folder_kind} value={row.folder_kind}>{row.folder_name}</option>)}
                      {folderDirectory.custom.length>0&&<optgroup label="Subpastas personalizadas">{folderDirectory.custom.map((row:any)=><option key={row.id} value={'custom:'+row.id}>{row.name}</option>)}</optgroup>}
                    </select>
                    <span className="mt-1 block text-[9px] text-gray-600">Mover não altera etapa, tarefa nem acesso do cliente.</span>
                  </label>}
                </div>}
              </div>
            </div>
          })}
              </div>}
            </div>
          </details>)}
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
            {stage.id!=='sem-etapa'&&<button type="button" onClick={e=>{e.preventDefault();e.stopPropagation();void renameStage(stage)}} className="ml-2 inline-flex h-8 w-8 items-center justify-center rounded-md text-emerald-300/65 hover:bg-white/10 hover:text-emerald-200 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-emerald-400" title="Renomear etapa" aria-label={"Renomear "+stage.name}>✎</button>}
          </summary>
          <div className="px-4 pb-4 space-y-3">
            {stage.id!=='sem-etapa'&&<div className="flex flex-wrap items-center gap-3 text-xs text-gray-400 border-b border-white/10 pb-3">
              <label>Etapa <select value={stage.status} onChange={e=>void changeStageStatus(stage.id,e.target.value)} className="ml-2 pm-control rounded-lg p-2">{stageStatuses.map(value=><option key={value} value={value}>{statusLabel('stage',value)}</option>)}</select></label>
              {stage.client_visible&&<Link to={'/admin/projetos/'+id+'/etapas/'+stage.id} className="inline-flex min-h-9 items-center text-xs font-semibold text-[#DFA269] hover:underline">Ver página da etapa ↗</Link>}
              <label className="flex items-center gap-2"><input type="checkbox" checked={stage.client_visible} onChange={async e=>{await portalApi.saveStage({client_visible:e.target.checked},stage.id);await load()}}/> Visível ao cliente</label>
              <button type="button" className="text-red-400 ml-auto" onClick={async()=>{if(window.confirm('Excluir esta etapa? As tarefas permanecem sem etapa.')){await portalApi.deleteStage(stage.id);await load()}}}>Excluir etapa</button>
            </div>}
            {stage.id!=='sem-etapa'&&project.project_type!=='internal'&&<div className="flex flex-wrap items-center justify-between gap-2">
              <span className="text-xs text-gray-500">Entrega da etapa: {complete}/{stageTasks.length} tarefas concluídas</span>
              <button type="button" disabled={!stageTasks.length||complete!==stageTasks.length} onClick={()=>void deliverStage(stage.id)} className="rounded-lg border border-[#A65A2A]/40 px-3 py-2 text-xs font-semibold text-[#DFA269] disabled:cursor-not-allowed disabled:opacity-35">Migrar prévias para Entregas</button>
            </div>}
            {stageTasks.length===0&&<p className="text-sm text-gray-500">Nenhuma tarefa nesta etapa.</p>}
            {stageTasks.map((task:any)=>{
        const member=team.find(item=>item.id===task.assigned_to)
        const stage=sortedStages.find((item:any)=>item.id===task.stage_id)
        const taskProgress=taskUploadProgress?.taskId===task.id?taskUploadProgress:null
        return <details key={task.id} className={'group/task overflow-hidden rounded-xl border border-l-4 shadow-sm transition-colors '+(task.status==='completed'?'border-[#BBDDC9] border-l-[#15803D] bg-[#EBF7EF] hover:bg-[#F2FBF5]':task.status==='in_progress'?'border-[#E9D7B8] border-l-[#B45309] bg-[#FFF5E7] hover:bg-[#FFF9F0]':task.status==='review'?'border-[#B7D6EF] border-l-[#0369A1] bg-[#EDF6FE] hover:bg-[#F4FAFF]':task.status==='cancelled'?'border-[#D5D5D5] border-l-[#9CA3AF] bg-[#E5E7EB] opacity-60':'border-[#C7CCD3] border-l-[#64748B] bg-[#ECEFF3] hover:bg-[#F6F7F9]')}>
          <summary className="flex min-h-12 cursor-pointer list-none items-center gap-3 px-4 py-3 text-sm font-semibold leading-relaxed text-[#17191D] marker:content-none [&::-webkit-details-marker]:hidden focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-[-2px] focus-visible:outline-[#A65A2A]">
            <span className="min-w-0 flex-1">
              <span className={task.status==='cancelled'?'line-through':''}>{task.title}</span>
              <span className={'ml-2 inline-flex rounded-md px-2 py-0.5 text-[11px] font-semibold '+(task.status==='completed'?'bg-emerald-700/10 text-emerald-900':task.status==='in_progress'?'bg-amber-700/10 text-amber-900':task.status==='review'?'bg-sky-700/10 text-sky-900':'bg-slate-700/10 text-slate-800')}>{statusLabel('task',task.status)}</span>
            </span>
            <span className="inline-flex shrink-0 items-center gap-1.5 rounded-lg border border-slate-300 bg-white/75 px-2.5 py-1.5 text-xs font-semibold text-slate-700">
              <span>Checklist</span>
              <svg aria-hidden="true" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.3" strokeLinecap="round" strokeLinejoin="round" className="h-4 w-4 transition-transform duration-200 group-open/task:rotate-180">
                <path d="m6 9 6 6 6-6" />
              </svg>
            </span>
          </summary>
          <div className="border-t border-black/10 bg-[#151518] px-4 pb-4 pt-3 text-gray-200">
          {stage?.client_visible&&task.client_visible&&<Link to={'/admin/projetos/'+id+'/etapas/'+stage.id+'/tarefas/'+task.id} className="mb-3 inline-flex min-h-10 items-center rounded-lg border border-[#A65A2A]/30 px-3 text-xs font-semibold text-[#DFA269] hover:bg-white/5">Prévia da tarefa para o cliente ↗</Link>}
          <div className="flex flex-wrap justify-between gap-3">
            <div>
              <p className="text-xs text-gray-500">{stage?.name||'Sem etapa'} · {member?member.first_name+' '+member.last_name:'Sem responsável'} · prioridade {rotulo(prioridade,task.priority)}</p>
              {task.due_date&&<p className="text-xs text-gray-500 mt-1">Prazo: {new Date(task.due_date+'T12:00').toLocaleDateString('pt-BR')}</p>}
            </div>
            <div className="flex gap-2 items-start">
              <button type="button" title="Renomear tarefa" aria-label="Renomear tarefa" onClick={()=>void renameTask(task)} className="px-2 py-2 text-xs text-gray-400 hover:text-white">Editar</button>
              <label className="flex items-center gap-2 text-xs text-gray-400 min-h-10">
                <input type="checkbox" checked={Boolean(task.client_visible)} onChange={e=>void changeTaskVisibility(task.id,e.target.checked)}/>
                Visível ao cliente
              </label>
              <select value={task.status} onChange={e=>void changeTaskStatus(task.id,e.target.value)} className={"pm-select-status px-3 py-2 rounded-lg text-sm "+(task.status==="pending"?"pm-state-pending":task.status==="in_progress"?"pm-state-progress":task.status==="review"?"pm-state-review":task.status==="completed"?"pm-state-success":"pm-state-danger")}>{taskStatuses.map(value=><option key={value} value={value}>{statusLabel('task',value)}</option>)}</select>
              <button onClick={async()=>{if(window.confirm('Excluir esta tarefa?')){await portalApi.deleteTask(task.id);await load()}}} className="px-3 py-2 text-xs text-red-400">Excluir</button>
            </div>
          </div>

          <div className="mt-3 flex flex-wrap items-center gap-3">
            <label title="Adicionar arquivos à tarefa" aria-label="Adicionar arquivos à tarefa" className={'inline-flex h-9 w-9 items-center justify-center rounded-lg border border-[#A65A2A]/40 text-lg font-semibold '+(taskUploadingId?'cursor-not-allowed opacity-50':'cursor-pointer hover:bg-[#A65A2A]/10')}>
              <span aria-hidden="true">{taskUploadingId===task.id?'…':'+'}</span>
              <input type="file" multiple className="sr-only" disabled={Boolean(taskUploadingId)} onChange={e=>void uploadTaskFile(e,task)}/>
            </label>
            <span className="text-[11px] text-gray-500">{project.project_type==='internal'?'Equipe · pasta da etapa':'Privado · Revisão'}</span>
          </div>
          {taskProgress&&<div role="status" aria-live="polite" className="mt-2 max-w-lg rounded-lg border border-white/10 bg-black/25 px-3 py-2 text-xs">
            <p className="truncate">{taskProgress.status==='done'?'✓ Envio concluído':taskProgress.status==='error'?'Envio não confirmado — confira antes de reenviar':'Enviando arquivo...'} {taskProgress.name}</p>
            <div className="mt-1 flex items-center justify-between text-gray-400"><span>{taskProgress.done}/{taskProgress.total} concluído(s)</span><span>{taskProgress.percent}%</span></div>
            <div className="mt-1 h-1.5 overflow-hidden rounded bg-white/10"><div className="h-full bg-[#A65A2A]" style={{width:taskProgress.percent+'%'}}/></div>
          </div>}
          {(files.filter((file:any)=>file.task_id===task.id).length>0)&&<div className="mt-4">
            <p className="text-xs font-medium text-gray-400 mb-2">Arquivos ({files.filter((file:any)=>file.task_id===task.id).length})</p>
            <div className="flex flex-wrap gap-2">{files.filter((file:any)=>file.task_id===task.id).map((file:any)=><button key={file.id} onClick={()=>openFile(file)} className="px-3 py-2 rounded-lg bg-white/5 text-xs">{file.name} ↗</button>)}</div>
          </div>}
          <div className="grid lg:grid-cols-2 gap-4 mt-3">
            <div>
              <div className="flex justify-between"><p className="text-xs font-medium text-gray-400">Checklist · {(task.checklist||[]).filter((item:any)=>item.completed).length}/{(task.checklist||[]).length}</p><button onClick={()=>addChecklist(task.id)} title="Adicionar item" aria-label="Adicionar item ao checklist" className="text-xs text-[#A65A2A]">+</button></div>
              <div className="space-y-1 mt-2">{(task.checklist||[]).sort((a:any,b:any)=>a.position-b.position).map((item:any)=><label key={item.id} className="flex items-center gap-2 text-sm"><input type="checkbox" checked={item.completed} onChange={e=>void toggleChecklist(task.id,item.id,e.target.checked)}/><span className={item.completed?'line-through text-gray-500':''}>{item.title}</span><button type="button" onClick={async()=>{await portalApi.deleteChecklistItem(item.id);await load()}} className="ml-auto text-xs text-red-400">×</button></label>)}</div>
            </div>
            <div>
              <div className="flex justify-between"><p className="text-xs font-medium text-gray-400">Links</p><button onClick={()=>addLink(task.id)} title="Adicionar link" aria-label="Adicionar link" className="text-xs text-[#A65A2A]">+</button></div>
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
  {showStatusLabels&&<div role="dialog" aria-modal="true" aria-label="Personalizar status" className="fixed inset-0 z-[80] flex items-center justify-center bg-black/75 p-4">
    <div className="w-full max-w-lg max-h-[85vh] overflow-y-auto rounded-xl border border-white/15 bg-[#171719] p-4 space-y-4">
      <div className="flex items-center justify-between gap-3"><h2 className="font-semibold">Nomes dos status</h2><button type="button" onClick={()=>setShowStatusLabels(false)} aria-label="Fechar">×</button></div>
      <p className="text-xs text-gray-400">Altera somente os nomes exibidos neste projeto. As regras internas, etapas e notificações permanecem inalteradas.</p>
      {([
        {name:'Projeto',scope:'project',values:projectStatuses,defaults:statusProjeto},
        {name:'Etapas',scope:'stage',values:stageStatuses,defaults:statusEtapa},
        {name:'Tarefas',scope:'task',values:taskStatuses,defaults:statusTarefa},
      ] as const).map(section=><div key={section.scope} className="space-y-2">
        <h3 className="text-xs font-semibold text-[#DFA269]">{section.name}</h3>
        {section.values.map(value=><label key={section.scope+'.'+value} className="flex items-center gap-2 text-xs">
          <span className="w-32 shrink-0 text-gray-400">{rotulo(section.defaults,value)}</span>
          <input maxLength={48} value={statusLabelDraft[section.scope+'.'+value]||''} onChange={e=>setStatusLabelDraft(current=>({...current,[section.scope+'.'+value]:e.target.value}))} placeholder="Usar padrão" className="min-w-0 flex-1 rounded-lg border border-white/15 bg-black px-2 py-2"/>
        </label>)}
      </div>)}
      <div className="flex justify-end gap-2"><button type="button" onClick={()=>setShowStatusLabels(false)} className="px-3 py-2 text-xs text-gray-400">Cancelar</button><button type="button" onClick={()=>void saveStatusLabels()} className="rounded-lg bg-[#A65A2A] px-4 py-2 text-xs font-semibold text-white">Salvar nomes</button></div>
    </div>
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
