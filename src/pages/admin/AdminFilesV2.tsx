import { useEffect,useMemo,useState } from 'react'
import { portalApi } from '../../api/portal'
import { fileManagementApi } from '../../api/fileManagement'
import { useAuth } from '../../contexts/AuthContext'
import { useToast } from '../../contexts/ToastContext'
import { Button } from '../../components/ui/Button'
import { settingsApi } from '../../api/settings'

const INTERNAL_LIBRARY_KEY='__internal__'

const folderOptions=[
  ['received','01 - Arquivos recebidos'],
  ['raw','02 - Brutos'],
  ['production','03 - Produção'],
  ['preview','04 - Prévia'],
  ['approved','05 - Aprovados'],
  ['delivery','06 - Entrega final'],
]

function sizeLabel(value:number|null|undefined){
  if(!value)return '—'
  const units=['B','KB','MB','GB','TB']
  let size=value,index=0
  while(size>=1024&&index<units.length-1){size/=1024;index+=1}
  return size.toLocaleString('pt-BR',{maximumFractionDigits:index>=3?2:1})+' '+units[index]
}

function extension(name:string){
  const part=name.split('.').pop()
  return part&&part!==name?part.toUpperCase().slice(0,6):'ARQ'
}

function fileIcon(row:any){
  const type=(row.mime_type||row.file_type||'').toLowerCase()
  const ext=extension(row.name).toLowerCase()
  if(type.startsWith('video/')||['mov','mp4','mkv','avi','webm'].includes(ext))return '🎬'
  if(type.startsWith('image/')||['jpg','jpeg','png','webp','avif','gif'].includes(ext))return '🖼️'
  if(type.startsWith('audio/')||['mp3','wav','aac','flac','m4a'].includes(ext))return '🎵'
  if(type.includes('pdf')||ext==='pdf')return '📄'
  if(type.includes('zip')||['zip','rar','7z'].includes(ext))return '🗜️'
  return '📎'
}

function fileKind(row:any){
  const type=(row.mime_type||row.file_type||'').toLowerCase()
  const ext=extension(row.name).toLowerCase()
  if(type.startsWith('video/')||['mov','mp4','mkv','avi','webm'].includes(ext))return 'video'
  if(type.startsWith('image/')||['jpg','jpeg','png','webp','avif','gif'].includes(ext))return 'image'
  if(type.startsWith('audio/')||['mp3','wav','aac','flac','m4a'].includes(ext))return 'audio'
  if(type.includes('pdf')||ext==='pdf')return 'pdf'
  if(type.includes('zip')||['zip','rar','7z'].includes(ext))return 'archive'
  return 'other'
}

export function AdminFilesV2(){
  const {user}=useAuth()
  const toast=useToast()
  const [files,setFiles]=useState<any[]>([])
  const [uploadOpen,setUploadOpen]=useState(false)
  const [customers,setCustomers]=useState<any[]>([])
  const [projects,setProjects]=useState<any[]>([])
  const [loading,setLoading]=useState(true)
  const [saving,setSaving]=useState(false)
  const [testing,setTesting]=useState(false)
  const [progress,setProgress]=useState(0)
  const [provider,setProvider]=useState<'google_drive'|'supabase'|'external'>('google_drive')
  const [customer,setCustomer]=useState('')
  const [project,setProject]=useState('')
  const [task,setTask]=useState('')
  const [stage,setStage]=useState('')
  const [folderKind,setFolderKind]=useState('received')
  const [customFolders,setCustomFolders]=useState<any[]>([])
  const [customFolder,setCustomFolder]=useState('')
  const [creatingFolder,setCreatingFolder]=useState(false)
  const [clientVisible,setClientVisible]=useState(false)
  const [driveLimitGb,setDriveLimitGb]=useState(50)
  const [name,setName]=useState('')
  const [url,setUrl]=useState('')
  const [selectedFiles,setSelectedFiles]=useState<File[]>([])
  const [currentFileName,setCurrentFileName]=useState('')
  const [completedFiles,setCompletedFiles]=useState(0)
  const [uploadResult,setUploadResult]=useState<{count:number;names:string[]}|null>(null)
  const [libraryCustomer,setLibraryCustomer]=useState<string|null>(null)
  const [libraryProject,setLibraryProject]=useState<string|null>(null)
  const [libraryCustomFolders,setLibraryCustomFolders]=useState<any[]>([])
  const [librarySearch,setLibrarySearch]=useState('')
  const [libraryType,setLibraryType]=useState('all')
  const [libraryReview,setLibraryReview]=useState('all')
  const [libraryFolder,setLibraryFolder]=useState('all')
  const [customerSearch,setCustomerSearch]=useState('')
  const [menuFile,setMenuFile]=useState<string|null>(null)
  const [reviewingFile,setReviewingFile]=useState<string|null>(null)
  const [versioningFile,setVersioningFile]=useState<any|null>(null)
  const [versionFile,setVersionFile]=useState<File|null>(null)
  const [versionProgress,setVersionProgress]=useState(0)
  const [reviewDetailsFile,setReviewDetailsFile]=useState<any|null>(null)
  const [reviewDetails,setReviewDetails]=useState<any[]>([])
  const [reviewDetailsLoading,setReviewDetailsLoading]=useState(false)

  const load=async()=>{
    try{
      setLoading(true)
      const [f,c,p]=await Promise.all([portalApi.files(),portalApi.customers(),portalApi.projects()])
      setFiles(f);setCustomers(c);setProjects(p)
    }finally{setLoading(false)}
  }

  useEffect(()=>{
    void load()
    settingsApi.appSettings().then(settings=>{
      if(!settings)return
      setClientVisible(settings.default_client_file_visibility)
      setDriveLimitGb(Math.min(50,Math.max(1,settings.drive_upload_limit_gb||50)))
    }).catch(()=>undefined)
  },[])

  const customerProjects=useMemo(()=>customer===INTERNAL_LIBRARY_KEY
    ? projects.filter((p:any)=>p.project_type==='internal')
    : projects.filter((p:any)=>p.customer_id===customer&&p.project_type!=='internal'),[projects,customer])
  const selectedProject=customerProjects.find((p:any)=>p.id===project)
  const selectedProjectIsInternal=selectedProject?.project_type==='internal'
  const tasks=selectedProject?.tasks||[]
  const stages=useMemo(()=>[...(selectedProject?.stages||[])].sort((a:any,b:any)=>a.position-b.position),[selectedProject])
  const selectedTask=tasks.find((item:any)=>item.id===task)
  const effectiveStage=selectedTask?.stage_id||stage||stages[0]?.id||null
  const foldersForKind=customFolders.filter((item:any)=>item.parent_kind===folderKind)

  useEffect(()=>{
    if(selectedProjectIsInternal&&!stage&&stages[0]?.id)setStage(stages[0].id)
  },[selectedProjectIsInternal,stage,stages])

  useEffect(()=>{
    setCustomFolder('')
    if(!project){setCustomFolders([]);return}
    portalApi.customDriveFolders(project)
      .then(setCustomFolders)
      .catch(()=>setCustomFolders([]))
  },[project])

  const grouped=useMemo(()=>{
    const map=new Map<string,{customer:any;label:string;internal:boolean;projects:Map<string,{project:any;files:any[]}>}>()
    for(const customerRow of customers){
      map.set(customerRow.id,{
        customer:customerRow,
        label:[customerRow.first_name,customerRow.last_name].filter(Boolean).join(' ')||customerRow.email||'Cliente',
        internal:false,
        projects:new Map(),
      })
    }

    const projectById=new Map(projects.map((item:any)=>[item.id,item]))

    for(const projectRow of projects){
      const internal=projectRow.project_type==='internal'
      const key=internal?INTERNAL_LIBRARY_KEY:(projectRow.customer_id||'__unassigned__')
      if(!map.has(key)){
        map.set(key,{
          customer:null,
          label:internal?'Projetos internos Play Moments':'Arquivos sem vínculo',
          internal,
          projects:new Map(),
        })
      }
      map.get(key)!.projects.set(projectRow.id,{project:projectRow,files:[]})
    }

    for(const row of files){
      const projectRow=projectById.get(row.project_id)||row.project||null
      const internal=projectRow?.project_type==='internal'
      const key=internal?INTERNAL_LIBRARY_KEY:(row.customer_id||projectRow?.customer_id||'__unassigned__')
      if(!map.has(key)){
        map.set(key,{
          customer:row.customer||null,
          label:internal?'Projetos internos Play Moments':'Arquivos sem vínculo',
          internal,
          projects:new Map(),
        })
      }
      const group=map.get(key)!
      const projectKey=row.project_id||'sem-projeto'
      if(!group.projects.has(projectKey))group.projects.set(projectKey,{project:projectRow||null,files:[]})
      group.projects.get(projectKey)!.files.push(row)
    }

    return Array.from(map.entries()).filter(([,group])=>group.projects.size>0)
  },[files,customers,projects])

  const selectedLibraryGroup=libraryCustomer
    ? grouped.find(([customerId])=>customerId===libraryCustomer)?.[1]||null
    : null
  const selectedLibraryProject=selectedLibraryGroup&&libraryProject
    ? selectedLibraryGroup.projects.get(libraryProject)||null
    : null

  const filteredGrouped=useMemo(()=>grouped.filter(([,group])=>{
    if(!customerSearch.trim())return true
    const q=customerSearch.trim().toLowerCase()
    const customerText=[
      group.label,
      group.customer?.first_name,
      group.customer?.last_name,
      group.customer?.email,
    ].filter(Boolean).join(' ').toLowerCase()
    if(customerText.includes(q))return true
    return Array.from(group.projects.values()).some(item=>
      (item.project?.title||'').toLowerCase().includes(q)
      || item.files.some((file:any)=>(file.name||'').toLowerCase().includes(q))
    )
  }),[grouped,customerSearch])

  const filteredLibraryFiles=useMemo(()=>{
    if(!selectedLibraryProject)return []
    const q=librarySearch.trim().toLowerCase()
    return selectedLibraryProject.files.filter((row:any)=>{
      const matchesSearch=!q||[
        row.name,
        row.task?.title,
        row.custom_folder?.name,
        row.project?.title,
        row.mime_type,
      ].filter(Boolean).join(' ').toLowerCase().includes(q)
      const matchesType=libraryType==='all'||fileKind(row)===libraryType
      const matchesReview=libraryReview==='all'
        ||(libraryReview==='none'&&!row.review_required)
        ||row.review_status===libraryReview
      const matchesFolder=libraryFolder==='all'
        ||(libraryFolder==='root'&&!row.custom_folder_id)
        ||row.custom_folder_id===libraryFolder
      return matchesSearch&&matchesType&&matchesReview&&matchesFolder
    })
  },[selectedLibraryProject,librarySearch,libraryType,libraryReview,libraryFolder])

  useEffect(()=>{
    if(!libraryProject||libraryProject==='sem-projeto'){setLibraryCustomFolders([]);return}
    portalApi.customDriveFolders(libraryProject)
      .then(setLibraryCustomFolders)
      .catch(()=>setLibraryCustomFolders([]))
  },[libraryProject])

  async function testDrive(){
    try{
      setTesting(true)
      const result=await portalApi.driveConnectionTest()
      toast('Google Drive conectado: '+(result.account?.emailAddress||result.account?.displayName||'conta autorizada')+'.','success')
    }catch(error:any){toast(error.message||'Falha ao testar Google Drive.','error')}
    finally{setTesting(false)}
  }

  async function createFolder(){
    if(!project)return toast('Selecione um projeto primeiro.','error')
    const folderName=window.prompt('Nome da nova pasta dentro de "'+(folderOptions.find(([value])=>value===folderKind)?.[1]||folderKind)+'":')
    if(!folderName?.trim())return
    try{
      setCreatingFolder(true)
      const folder=await portalApi.createCustomDriveFolder({
        project_id:project,
        parent_kind:folderKind,
        name:folderName.trim(),
        client_visible:clientVisible,
      })
      const rows=await portalApi.customDriveFolders(project)
      setCustomFolders(rows)
      setCustomFolder(folder.id)
      toast('Pasta criada no Google Drive.','success')
    }catch(error:any){toast(error.message||'Não foi possível criar a pasta.','error')}
    finally{setCreatingFolder(false)}
  }

  async function save(e:React.FormEvent){
    e.preventDefault()
    if(!user||!customer)return
    try{
      setSaving(true);setProgress(0);setCompletedFiles(0);setCurrentFileName('');setUploadResult(null)
      if(provider==='google_drive'){
        if(!project||!selectedFiles.length)throw new Error('Selecione um projeto e um ou mais arquivos para enviar ao Google Drive.')
        await portalApi.ensureProjectDriveFolder(project)
        for(let index=0;index<selectedFiles.length;index+=1){
          const current=selectedFiles[index]
          setCurrentFileName(current.name)
          await portalApi.uploadDriveFile({
            project_id:project,
            task_id:task||null,
            folder_kind:folderKind,
            custom_folder_id:customFolder||null,
            client_visible:clientVisible,
          },current,value=>setProgress(Math.round(((index+(value/100))/selectedFiles.length)*100)))
          setCompletedFiles(index+1)
        }
        setUploadResult({count:selectedFiles.length,names:selectedFiles.map(file=>file.name)})
        toast(selectedFiles.length===1?'Arquivo enviado para o Google Drive.':selectedFiles.length+' arquivos enviados para o Google Drive.','success')
      }else if(provider==='supabase'){
        if(!selectedFiles.length)throw new Error('Selecione um ou mais arquivos.')
        for(let index=0;index<selectedFiles.length;index+=1){
          const current=selectedFiles[index]
          setCurrentFileName(current.name)
          const storage_path=await portalApi.uploadClientFile(customer,current)
          await portalApi.addClientFile({
            customer_id:customer,project_id:project||null,task_id:task||null,uploaded_by:user.id,
            name:selectedFiles.length===1&&name.trim()?name.trim():current.name,
            storage_path,file_type:current.type||null,storage_provider:'supabase',
            file_size:current.size,mime_type:current.type||null,client_visible:clientVisible,
          })
          setCompletedFiles(index+1)
          setProgress(Math.round(((index+1)/selectedFiles.length)*100))
        }
        toast(selectedFiles.length===1?'Arquivo enviado ao portal.':selectedFiles.length+' arquivos enviados ao portal.','success')
      }else{
        if(!name.trim()||!url.trim())throw new Error('Informe o nome e o link externo.')
        await portalApi.addClientFile({
          customer_id:customer,project_id:project||null,task_id:task||null,uploaded_by:user.id,
          name:name.trim(),external_url:url.trim(),storage_provider:'external',client_visible:clientVisible,
        })
        toast('Link externo registrado.','success')
      }
      setName('');setUrl('');setSelectedFiles([]);setTask('');setProgress(0);setCompletedFiles(0);setCurrentFileName('')
      await load()
    }catch(error:any){toast(error.message||'Não foi possível salvar o arquivo.','error')}
    finally{setSaving(false)}
  }
  async function open(row:any){
    if(row.storage_provider==='google_drive'&&row.drive_file_id){
      const blobUrl=await portalApi.driveFileBlobUrl(row.id)
      window.open(blobUrl,'_blank','noopener')
      window.setTimeout(()=>URL.revokeObjectURL(blobUrl),60000)
      return
    }
    if(row.external_url){window.open(row.external_url,'_blank','noopener');return}
    if(row.storage_path){window.open(await portalApi.fileUrl(row.storage_path),'_blank','noopener')}
  }

  async function remove(row:any){
    if(!window.confirm('Excluir "'+row.name+'"? Esta ação também remove o arquivo do armazenamento quando aplicável.'))return
    try{
      await fileManagementApi.remove(row.id)
      toast('Arquivo excluído.','success')
      await load()
    }catch(error:any){toast(error.message||'Não foi possível excluir o arquivo.','error')}
  }

  async function move(row:any,kind:string){
    try{
      await fileManagementApi.move(row.id,kind)
      toast(kind==='delivery'?'Entrega finalizada e arquivo movido para a pasta de entrega.':'Arquivo movido no Google Drive.','success')
      await load()
    }catch(error:any){toast(error.message||'Não foi possível mover o arquivo.','error')}
  }

  async function organizeIntoProject(row:any,targetProjectId:string){
    try{
      await fileManagementApi.moveToProject(row.id,targetProjectId,'received')
      toast('Arquivo conectado ao projeto e movido para Arquivos recebidos no Google Drive.','success')
      setMenuFile(null)
      await load()
    }catch(error:any){toast(error.message||'Não foi possível organizar o arquivo no projeto.','error')}
  }

  async function moveToCustom(row:any,folderId:string){
    try{
      await fileManagementApi.moveToCustom(row.id,folderId)
      toast('Arquivo movido para a pasta personalizada.','success')
      await load()
    }catch(error:any){toast(error.message||'Não foi possível mover o arquivo.','error')}
  }

  async function rename(row:any){
    const next=window.prompt('Novo nome do arquivo',row.name)
    if(!next?.trim()||next.trim()===row.name)return
    try{
      await fileManagementApi.rename(row.id,next.trim())
      toast('Arquivo renomeado.','success')
      setMenuFile(null)
      await load()
    }catch(error:any){toast(error.message||'Não foi possível renomear o arquivo.','error')}
  }

  async function requestReview(row:any){
    try{
      setReviewingFile(row.id)
      if(row.storage_provider==='google_drive'&&!row.client_visible)await fileManagementApi.publish(row.id)
      await portalApi.requestFileReview(row.id)
      toast('Aprovação solicitada ao cliente.','success')
      setMenuFile(null)
      await load()
    }catch(error:any){toast(error.message||'Não foi possível solicitar aprovação.','error')}
    finally{setReviewingFile(null)}
  }

  async function uploadNewVersion(){
    if(!versioningFile||!versionFile)return
    if(!versioningFile.project_id)return toast('O arquivo precisa estar vinculado a um projeto para receber uma nova versão.','error')
    try{
      setSaving(true);setVersionProgress(0)
      const uploaded=await portalApi.uploadDriveFile({
        project_id:versioningFile.project_id,
        task_id:versioningFile.task_id||null,
        folder_kind:'preview',
        custom_folder_id:versioningFile.custom_folder_id||null,
        client_visible:true,
      },versionFile,setVersionProgress)
      await portalApi.linkFileVersion(uploaded.id,versioningFile.id)
      toast('Nova versão enviada. Agora você pode solicitar a aprovação do cliente.','success')
      setVersioningFile(null);setVersionFile(null);setVersionProgress(0)
      await load()
    }catch(error:any){toast(error.message||'Não foi possível enviar a nova versão.','error')}
    finally{setSaving(false)}
  }

  async function cancelReview(row:any){
    try{
      await portalApi.cancelFileReview(row.id)
      toast('Solicitação de aprovação cancelada.','success')
      setMenuFile(null)
      await load()
    }catch(error:any){toast(error.message||'Não foi possível cancelar a aprovação.','error')}
  }

  async function showReviewDetails(row:any){
    try{
      setReviewDetailsFile(row);setReviewDetailsLoading(true)
      setReviewDetails(await portalApi.fileReviews(row.id))
    }catch(error:any){toast(error.message||'Não foi possível carregar os ajustes.','error');setReviewDetailsFile(null)}
    finally{setReviewDetailsLoading(false)}
  }

  async function openReviewAttachment(path:string){
    try{window.open(await portalApi.fileReviewAttachmentUrl(path),'_blank','noopener')}
    catch(error:any){toast(error.message||'Não foi possível abrir o anexo.','error')}
  }

  function isDelivered(row:any){
    const projectRow=projects.find((item:any)=>item.id===row.project_id)
    const deliveryFolder=projectRow?.drive_folders?.find((folder:any)=>folder.folder_kind==='delivery')
    return Boolean(deliveryFolder?.drive_folder_id&&row.drive_folder_id===deliveryFolder.drive_folder_id)
  }

  function reviewBadge(row:any){
    if(row.review_status==='approved'&&isDelivered(row))return {label:'Entregue',className:'bg-emerald-500/15 text-emerald-300'}
    if(!row.review_required)return null
    if(row.review_status==='pending')return {label:'Aguardando cliente',className:'bg-yellow-500/10 text-yellow-300'}
    if(row.review_status==='approved')return {label:'Aprovado',className:'bg-emerald-500/10 text-emerald-400'}
    if(row.review_status==='changes_requested')return {label:'Ajustes solicitados',className:'bg-orange-500/10 text-orange-400'}
    return null
  }

  return <div>
    <div className="flex flex-wrap justify-between gap-4 items-end mb-6">
      <div>
        <p className="text-[11px] uppercase tracking-[.18em] text-[#E30613] font-semibold">Operação</p>
        <h1 className="text-2xl font-bold mt-1">Central de Arquivos</h1>
        <p className="text-sm text-gray-500 mt-1">Cliente → Projeto → Tarefa → aprovação → entrega.</p>
      </div>
      <div className="flex items-center gap-2"><Button type="button" variant="secondary" loading={testing} onClick={testDrive}>Testar Drive</Button><button type="button" onClick={()=>{setUploadOpen(true);if(libraryCustomer&&libraryCustomer!=='sem-cliente')setCustomer(libraryCustomer);if(libraryProject&&libraryProject!=='sem-projeto')setProject(libraryProject)}} className="min-h-10 px-3.5 rounded-xl bg-[#E30613] hover:bg-[#f01826] text-white text-sm font-bold flex items-center gap-1.5"><span className="text-lg leading-none">＋</span>Novo</button></div>
    </div>

    {uploadResult&&<div className="mb-4 rounded-2xl border border-emerald-500/20 bg-emerald-500/[0.06] p-4 flex items-start gap-3">
      <div className="w-9 h-9 shrink-0 rounded-xl bg-emerald-500/10 text-emerald-300 flex items-center justify-center font-bold">✓</div>
      <div className="min-w-0 flex-1"><p className="text-sm font-bold text-emerald-300">{uploadResult.count} {uploadResult.count===1?'arquivo enviado':'arquivos enviados'} com sucesso</p><p className="text-xs text-gray-500 mt-1 truncate">{uploadResult.names.join(' • ')}</p><p className="text-[10px] text-gray-600 mt-1">A lista abaixo foi atualizada com os arquivos finalizados.</p></div>
      <button type="button" onClick={()=>setUploadResult(null)} className="text-gray-600 hover:text-white">×</button>
    </div>}

    <section>
      <div className="mb-3 flex items-end justify-between gap-3"><div><p className="text-[10px] uppercase tracking-[.16em] text-gray-600">Biblioteca</p><h2 className="text-base font-bold mt-1">Clientes e projetos</h2></div><span className="text-[10px] text-gray-600">{customers.length} clientes · {projects.length} projetos · {files.length} arquivos</span></div>
      <div className="mb-3">
        <input value={customerSearch} onChange={e=>setCustomerSearch(e.target.value)} placeholder="Buscar cliente, projeto ou arquivo..." className="w-full min-h-10 px-3.5 rounded-xl bg-[#141416] border border-white/10 text-sm"/>
      </div>

      {loading?<p className="text-gray-500">Carregando...</p>:filteredGrouped.length===0?<p className="text-sm text-gray-500">Nenhum cliente, projeto ou arquivo encontrado.</p>:<div className="grid sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3">
        {filteredGrouped.map(([customerId,group])=>{
          const totalFiles=Array.from(group.projects.values()).reduce((sum,item)=>sum+item.files.length,0)
          return <button
            key={customerId}
            type="button"
            onClick={()=>{setLibraryCustomer(customerId);setLibraryProject(null);setLibrarySearch('');setLibraryType('all');setLibraryReview('all');setLibraryFolder('all');setMenuFile(null)}}
            className="text-left rounded-xl border border-white/8 bg-[#121214] hover:bg-[#171719] hover:border-white/15 transition-colors p-3"
          >
            <div className="flex items-center gap-3">
              <div className="w-9 h-9 rounded-lg bg-white/[0.05] flex items-center justify-center">📁</div>
              <div className="min-w-0 flex-1">
                <p className="text-sm font-semibold truncate">{group.customer?[group.customer.first_name,group.customer.last_name].filter(Boolean).join(' '):'Sem cliente'}</p>
                <p className="text-[10px] text-gray-500 truncate">{group.customer?.email||''}</p>
              </div>
              <div className="text-right">
                <p className="text-xs font-semibold">{totalFiles}</p>
                <p className="text-[9px] text-gray-600">arquivos</p>
              </div>
            </div>
          </button>
        })}
      </div>}
    </section>

    {reviewDetailsFile&&<div className="fixed inset-0 z-[75] bg-black/80 backdrop-blur-sm flex items-end sm:items-center justify-center sm:p-4">
      <div className="w-full max-w-2xl max-h-[92vh] overflow-y-auto rounded-t-2xl sm:rounded-2xl bg-[#111113] border border-white/10 p-4 sm:p-5">
        <div className="flex items-start justify-between gap-3 mb-5">
          <div><p className="text-[10px] uppercase tracking-widest text-orange-400 font-bold">Revisão do cliente</p><h3 className="text-lg font-bold mt-1">{reviewDetailsFile.name}</h3><p className="text-xs text-gray-500 mt-1">Versão v{reviewDetailsFile.version_number||1}</p></div>
          <button type="button" onClick={()=>setReviewDetailsFile(null)} className="w-9 h-9 rounded-lg bg-white/[0.05]">×</button>
        </div>
        {reviewDetailsLoading?<p className="text-sm text-gray-500 py-8 text-center">Carregando ajustes...</p>:reviewDetails.length===0?<p className="text-sm text-gray-500 py-8 text-center">Nenhum registro de revisão encontrado.</p>:<div className="space-y-3">{reviewDetails.map((review:any)=><div key={review.id} className="rounded-xl border border-white/10 bg-black/30 p-4">
          <div className="flex items-center justify-between gap-3"><span className={'px-2 py-1 rounded-full text-[9px] font-bold '+(review.action==='approved'?'bg-emerald-500/10 text-emerald-300':'bg-orange-500/10 text-orange-300')}>{review.action==='approved'?'Aprovado':'Ajustes solicitados'}</span><span className="text-[10px] text-gray-600">{new Date(review.created_at).toLocaleString('pt-BR')}</span></div>
          {review.subject&&<h4 className="font-bold text-sm mt-3">{review.subject}</h4>}
          {review.comment&&<p className="text-xs text-gray-400 mt-2 whitespace-pre-wrap">{review.comment}</p>}
          {Array.isArray(review.items)&&review.items.length>0&&<div className="mt-4 space-y-2">{review.items.map((item:string,index:number)=><div key={index} className="flex gap-2 text-xs"><span className="w-5 h-5 shrink-0 rounded-full bg-orange-500/10 text-orange-300 flex items-center justify-center text-[9px] font-bold">{index+1}</span><span className="text-gray-300 pt-0.5">{item}</span></div>)}</div>}
          {Array.isArray(review.attachments)&&review.attachments.length>0&&<div className="mt-4"><p className="text-[10px] uppercase tracking-wider text-gray-600 font-bold mb-2">Referências</p><div className="flex flex-wrap gap-2">{review.attachments.map((attachment:any,index:number)=><button key={index} type="button" onClick={()=>void openReviewAttachment(attachment.path)} className="px-3 py-2 rounded-lg border border-white/10 bg-white/[0.03] hover:bg-white/[0.06] text-[10px] text-left"><span className="block font-semibold text-gray-300 max-w-[220px] truncate">{attachment.name}</span><span className="text-gray-600">{Math.max(1,Math.round((attachment.size||0)/1024))} KB</span></button>)}</div></div>}
        </div>)}</div>}
      </div>
    </div>}

    {versioningFile&&<div className="fixed inset-0 z-[70] bg-black/75 backdrop-blur-sm flex items-center justify-center p-4">
      <div className="w-full max-w-md rounded-2xl border border-white/10 bg-[#111113] p-5">
        <div className="flex items-start justify-between gap-3 mb-4">
          <div><h3 className="text-base font-bold">Enviar nova versão</h3><p className="text-xs text-gray-500 mt-1">Versão atual: v{versioningFile.version_number||1} · {versioningFile.name}</p></div>
          <button type="button" onClick={()=>{setVersioningFile(null);setVersionFile(null)}} className="w-8 h-8 rounded-lg bg-white/[0.04]">×</button>
        </div>
        <label className="block p-4 rounded-xl border border-dashed border-white/15 bg-white/[0.025] cursor-pointer">
          <input type="file" className="hidden" onChange={e=>setVersionFile(e.target.files?.[0]||null)}/>
          <span className="text-sm font-semibold">{versionFile?versionFile.name:'Selecionar arquivo da nova versão'}</span>
          <span className="block text-xs text-gray-500 mt-1">A nova versão será vinculada ao mesmo histórico do arquivo.</span>
        </label>
        {saving&&<div className="mt-3"><div className="h-2 rounded-full bg-white/10 overflow-hidden"><div className="h-full bg-[#E30613]" style={{width:versionProgress+'%'}}/></div><p className="text-[10px] text-gray-500 mt-1">{versionProgress}% enviado</p></div>}
        <div className="flex gap-2 mt-4">
          <button type="button" onClick={()=>{setVersioningFile(null);setVersionFile(null)}} className="min-h-10 px-4 rounded-xl border border-white/10 text-xs">Cancelar</button>
          <button type="button" disabled={!versionFile||saving} onClick={()=>void uploadNewVersion()} className="min-h-10 flex-1 px-4 rounded-xl bg-[#E30613] disabled:opacity-40 text-xs font-bold">Enviar nova versão</button>
        </div>
      </div>
    </div>}

    {libraryCustomer&&selectedLibraryGroup&&<div className="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm flex items-center justify-center p-4" onMouseDown={e=>{if(e.currentTarget===e.target){setLibraryCustomer(null);setLibraryProject(null);setMenuFile(null)}}}>
      <div className="w-full max-w-5xl max-h-[86vh] rounded-2xl border border-white/10 bg-[#111113] shadow-2xl overflow-hidden flex flex-col">
        <div className="h-14 px-4 sm:px-5 border-b border-white/10 flex items-center gap-3 shrink-0">
          {libraryProject&&<button type="button" onClick={()=>{setLibraryProject(null);setMenuFile(null)}} className="w-8 h-8 rounded-lg bg-white/[0.04] hover:bg-white/[0.08] flex items-center justify-center text-gray-300" title="Voltar" aria-label="Voltar">←</button>}
          <div className="min-w-0 flex-1">
            <p className="text-sm font-semibold truncate">
              {selectedLibraryGroup.customer?[selectedLibraryGroup.customer.first_name,selectedLibraryGroup.customer.last_name].filter(Boolean).join(' '):'Sem cliente'}
            </p>
            <p className="text-[10px] text-gray-500 truncate">
              {libraryProject&&selectedLibraryProject?.project?.title?selectedLibraryProject.project.title:selectedLibraryGroup.customer?.email||'Biblioteca de arquivos'}
            </p>
          </div>
          <button type="button" onClick={()=>{setUploadOpen(true);if(libraryCustomer&&libraryCustomer!=='sem-cliente')setCustomer(libraryCustomer);if(libraryProject&&libraryProject!=='sem-projeto')setProject(libraryProject)}} className="min-h-8 px-3 rounded-lg bg-[#E30613] hover:bg-[#f01826] text-white text-[10px] font-bold">＋ Novo</button>
          <button type="button" onClick={()=>{setLibraryCustomer(null);setLibraryProject(null);setMenuFile(null)}} className="w-8 h-8 rounded-lg bg-white/[0.04] hover:bg-white/[0.08] flex items-center justify-center text-gray-400 text-lg" title="Fechar" aria-label="Fechar">×</button>
        </div>

        <div className="p-4 sm:p-5 overflow-y-auto">
          {!libraryProject?<div>
            <div className="flex items-center justify-between mb-3">
              <p className="text-[10px] uppercase tracking-[.14em] text-gray-500">Pastas de projetos</p>
              <span className="text-[10px] text-gray-600">{selectedLibraryGroup.projects.size} pasta(s)</span>
            </div>
            <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-3">
              {Array.from(selectedLibraryGroup.projects.entries()).map(([projectId,projectGroup])=><button
                key={projectId}
                type="button"
                onClick={()=>{setLibraryProject(projectId);setLibrarySearch('');setLibraryType('all');setLibraryReview('all');setLibraryFolder('all');setMenuFile(null)}}
                className="text-left p-3 rounded-xl border border-white/8 bg-[#171719] hover:bg-[#1d1d20] hover:border-white/15 transition-colors"
              >
                <div className="flex items-center gap-3">
                  <div className="w-9 h-9 rounded-lg bg-white/[0.05] flex items-center justify-center">📂</div>
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-semibold truncate">{projectGroup.project?.title||'Arquivos gerais'}</p>
                    <p className="text-[10px] text-gray-500 mt-1">{projectGroup.files.length} arquivo(s)</p>
                  </div>
                  <span className="text-gray-600">›</span>
                </div>
              </button>)}
            </div>
          </div>:selectedLibraryProject?<div>
            <div className="flex items-center justify-between mb-3">
              <p className="text-xs uppercase tracking-wide text-gray-500">Arquivos</p>
              <span className="text-[10px] text-gray-600">{filteredLibraryFiles.length} de {selectedLibraryProject.files.length} item(ns)</span>
            </div>

            <div className="grid sm:grid-cols-2 lg:grid-cols-[minmax(180px,1.6fr)_repeat(3,minmax(130px,.8fr))] gap-2 mb-3 p-2 rounded-xl bg-black/20 border border-white/[0.06]">
              <input value={librarySearch} onChange={e=>setLibrarySearch(e.target.value)} placeholder="Buscar arquivo..." className="min-h-10 px-3 rounded-xl bg-black border border-white/10 text-xs"/>
              <select value={libraryType} onChange={e=>setLibraryType(e.target.value)} className="min-h-10 px-3 rounded-xl bg-black border border-white/10 text-xs">
                <option value="all">Todos os formatos</option>
                <option value="image">Imagens</option>
                <option value="video">Vídeos</option>
                <option value="audio">Áudios</option>
                <option value="pdf">PDF</option>
                <option value="archive">Compactados</option>
                <option value="other">Outros</option>
              </select>
              <select value={libraryReview} onChange={e=>setLibraryReview(e.target.value)} className="min-h-10 px-3 rounded-xl bg-black border border-white/10 text-xs">
                <option value="all">Toda aprovação</option>
                <option value="pending">Aguardando cliente</option>
                <option value="approved">Aprovados</option>
                <option value="changes_requested">Ajustes solicitados</option>
                <option value="none">Sem aprovação</option>
              </select>
              <select value={libraryFolder} onChange={e=>setLibraryFolder(e.target.value)} className="min-h-10 px-3 rounded-xl bg-black border border-white/10 text-xs">
                <option value="all">Todas as pastas</option>
                <option value="root">Sem subpasta</option>
                {libraryCustomFolders.map((folder:any)=><option key={folder.id} value={folder.id}>{folder.name}</option>)}
              </select>
            </div>

            {filteredLibraryFiles.length===0?<div className="py-12 text-center text-sm text-gray-600 border border-dashed border-white/8 rounded-2xl">Nenhum arquivo corresponde aos filtros.</div>:<div className="grid sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3">
              {filteredLibraryFiles.map(row=>{
                const review=reviewBadge(row)
                return <div key={row.id} className="relative p-2.5 rounded-xl bg-[#171719] border border-white/8 hover:border-white/15 transition-colors">
                  <button type="button" onClick={()=>open(row)} className="w-full text-left">
                    <div className="h-14 rounded-lg bg-white/[0.035] flex items-center justify-center text-2xl">{fileIcon(row)}</div>
                    <div className="mt-2 flex items-center justify-between gap-2">
                      <span className="text-[9px] font-bold text-[#E30613]">{extension(row.name)} · v{row.version_number||1}</span>
                      <span className="text-[9px] text-gray-600">{sizeLabel(row.file_size)}</span>
                    </div>
                    <p className="text-xs font-semibold truncate mt-1" title={row.name}>{row.name}</p>
                    <p className="text-[9px] text-gray-500 truncate mt-1">{row.custom_folder?.name?('📁 '+row.custom_folder.name):(row.task?.title||'Arquivo geral')}</p>
                    {review&&<span className={'inline-flex mt-2 px-2 py-1 rounded-full text-[9px] font-semibold '+review.className}>{review.label}</span>}
                  </button>

                  <div className="mt-3 flex flex-wrap gap-2">
                    {!row.review_required&&<button type="button" disabled={reviewingFile===row.id} onClick={()=>void requestReview(row)} className="min-h-9 flex-1 px-3 rounded-lg bg-[#E30613] hover:bg-[#c90510] disabled:opacity-50 text-[10px] font-bold text-white">{reviewingFile===row.id?'Solicitando...':'Solicitar aprovação'}</button>}
                    {row.review_required&&row.review_status==='pending'&&<button type="button" onClick={()=>void cancelReview(row)} className="min-h-9 flex-1 px-3 rounded-lg border border-white/10 hover:bg-white/[0.05] text-[10px] font-semibold">Cancelar aprovação</button>}
                    {row.review_required&&row.review_status==='changes_requested'&&<>
                      <button type="button" onClick={()=>void showReviewDetails(row)} className="min-h-9 flex-1 px-3 rounded-lg border border-orange-500/20 bg-orange-500/[0.08] text-orange-300 text-[10px] font-bold">Ver ajustes</button>
                      <button type="button" onClick={()=>{setVersioningFile(row);setVersionFile(null);setVersionProgress(0)}} className="min-h-9 flex-1 px-3 rounded-lg bg-[#E30613] hover:bg-[#c90510] text-[10px] font-bold text-white">Enviar nova versão</button>
                    </>}
                    {row.review_required&&row.review_status==='approved'&&!isDelivered(row)&&<button type="button" onClick={()=>void move(row,'delivery')} className="min-h-9 flex-1 px-3 rounded-lg bg-emerald-500/15 text-emerald-300 hover:bg-emerald-500/20 text-[10px] font-bold">Finalizar entrega</button>}
                  </div>

                  <button
                    type="button"
                    onClick={()=>setMenuFile(menuFile===row.id?null:row.id)}
                    className="absolute top-2 right-2 w-7 h-7 rounded-lg bg-black/45 hover:bg-black/70 flex items-center justify-center text-gray-300"
                    title="Ações"
                    aria-label="Ações do arquivo"
                  >•••</button>

                  {menuFile===row.id&&<div className="absolute z-20 right-2 top-10 w-56 rounded-xl border border-white/10 bg-[#0d0d0f] shadow-2xl p-1.5" onMouseLeave={()=>setMenuFile(null)}>
                    <div className="flex items-center gap-1">
                      {(row.drive_file_id||row.external_url||row.storage_path)&&<button type="button" onClick={()=>{setMenuFile(null);void open(row)}} className="w-9 h-9 rounded-lg hover:bg-white/[0.07] flex items-center justify-center text-sm" title="Abrir" aria-label="Abrir arquivo">↗</button>}
                      <button type="button" onClick={()=>void rename(row)} className="w-9 h-9 rounded-lg hover:bg-white/[0.07] flex items-center justify-center text-sm" title="Renomear" aria-label="Renomear arquivo">✎</button>
                      {row.storage_provider==='google_drive'&&<label className="relative w-9 h-9 rounded-lg hover:bg-white/[0.07] flex items-center justify-center cursor-pointer text-sm" title="Conectar/mover para projeto" aria-label="Conectar arquivo a um projeto">
                        📁
                        <select defaultValue="" onChange={e=>{if(e.target.value)void organizeIntoProject(row,e.target.value)}} className="absolute inset-0 opacity-0 cursor-pointer">
                          <option value="">Organizar em projeto</option>
                          {projects.filter((projectRow:any)=>projectRow.customer_id).map((projectRow:any)=><option key={projectRow.id} value={projectRow.id}>{projectRow.title}</option>)}
                        </select>
                      </label>}
                      {row.storage_provider==='google_drive'&&row.project_id&&<label className="relative w-9 h-9 rounded-lg hover:bg-white/[0.07] flex items-center justify-center cursor-pointer text-sm" title="Mover dentro do projeto" aria-label="Mover arquivo">
                        ⇄
                        <select defaultValue="" onChange={e=>{if(e.target.value){void move(row,e.target.value);setMenuFile(null)}}} className="absolute inset-0 opacity-0 cursor-pointer">
                          <option value="">Mover</option>
                          {folderOptions.map(([value,label])=><option key={value} value={value}>{label}</option>)}
                        </select>
                      </label>}
                      <button type="button" onClick={()=>{setMenuFile(null);void remove(row)}} className="w-9 h-9 rounded-lg hover:bg-red-500/10 text-red-400 flex items-center justify-center text-sm" title="Excluir" aria-label="Excluir arquivo">⌫</button>
                    </div>
                    <div className="mt-1 border-t border-white/8 pt-1">
                      {!row.review_required&&<button type="button" onClick={()=>void requestReview(row)} className="w-full min-h-9 px-2 rounded-lg hover:bg-white/[0.05] text-left text-xs text-gray-300">Solicitar aprovação</button>}
                      {row.review_required&&row.review_status==='pending'&&<button type="button" onClick={()=>void cancelReview(row)} className="w-full min-h-9 px-2 rounded-lg hover:bg-white/[0.05] text-left text-xs text-gray-300">Cancelar aprovação</button>}
                      {row.review_required&&['approved','changes_requested'].includes(row.review_status)&&<button type="button" onClick={()=>void requestReview(row)} className="w-full min-h-9 px-2 rounded-lg hover:bg-white/[0.05] text-left text-xs text-gray-300">Solicitar nova avaliação</button>}
                    </div>
                  </div>}
                </div>
              })}
            </div>}
          </div>:null}
        </div>
      </div>
    </div>}

    {uploadOpen&&<div className="fixed inset-0 z-[80] bg-black/80 backdrop-blur-sm flex items-end sm:items-center justify-center sm:p-4" onMouseDown={e=>{if(e.currentTarget===e.target&&!saving)setUploadOpen(false)}}><div className="w-full max-w-4xl max-h-[92vh] overflow-y-auto rounded-t-2xl sm:rounded-2xl bg-[#111113] border border-white/10 shadow-2xl"><div className="sticky top-0 z-10 h-14 px-4 sm:px-5 bg-[#111113]/95 backdrop-blur border-b border-white/8 flex items-center justify-between gap-3"><div><p className="text-[9px] uppercase tracking-[.16em] text-[#E30613] font-bold">Central de arquivos</p><h2 className="text-base font-bold">Novo arquivo</h2></div><button type="button" disabled={saving} onClick={()=>setUploadOpen(false)} className="w-8 h-8 rounded-lg bg-white/[0.04] hover:bg-white/[0.08] disabled:opacity-40 text-gray-400">×</button></div><div className="p-4 sm:p-5">    <form onSubmit={save} className="space-y-4">
      <div className="grid md:grid-cols-3 gap-3">
        <label className="text-xs text-gray-500">Armazenamento
          <select value={provider} onChange={e=>setProvider(e.target.value as typeof provider)} className="pm-control mt-1 w-full px-3 bg-black">
            <option value="google_drive">Google Drive — recomendado</option>
            <option value="supabase">Portal / Supabase — arquivos pequenos</option>
            <option value="external">Link externo</option>
          </select>
        </label>
        <label className="text-xs text-gray-500">Cliente
          <select value={customer} onChange={e=>{setCustomer(e.target.value);setProject('');setTask('')}} className="pm-control mt-1 w-full px-3 bg-black">
            <option value="">Selecione o cliente</option>
            {customers.map(c=><option key={c.id} value={c.id}>{c.first_name} {c.last_name} — {c.email}</option>)}
          </select>
        </label>
        <label className="text-xs text-gray-500">Projeto
          <select value={project} onChange={e=>{setProject(e.target.value);setTask('');setCustomFolder('')}} className="pm-control mt-1 w-full px-3 bg-black">
            <option value="">Sem projeto</option>
            {customerProjects.map((p:any)=><option key={p.id} value={p.id}>{p.title}</option>)}
          </select>
        </label>
      </div>

      <div className="grid md:grid-cols-3 gap-3">
        <label className="text-xs text-gray-500">Tarefa
          <select value={task} onChange={e=>setTask(e.target.value)} disabled={!project} className="pm-control mt-1 w-full px-3 bg-black disabled:opacity-40">
            <option value="">Arquivo geral do projeto</option>
            {tasks.map((t:any)=><option key={t.id} value={t.id}>{t.title}</option>)}
          </select>
        </label>
        {provider==='google_drive'&&<label className="text-xs text-gray-500">Pasta do projeto
          <select value={folderKind} onChange={e=>{setFolderKind(e.target.value);setCustomFolder('')}} className="pm-control mt-1 w-full px-3 bg-black">
            {folderOptions.map(([value,label])=><option key={value} value={value}>{label}</option>)}
          </select>
        </label>}
        <label className="text-xs text-gray-500">Visibilidade
          <select value={clientVisible?'client':'internal'} onChange={e=>setClientVisible(e.target.value==='client')} className="pm-control mt-1 w-full px-3 bg-black">
            <option value="client">Visível ao cliente</option>
            <option value="internal">Somente equipe</option>
          </select>
        </label>
      </div>

      {provider==='google_drive'&&project&&<div className="grid md:grid-cols-[1fr_auto] gap-3 items-end">
        <label className="text-xs text-gray-500">Subpasta personalizada
          <select value={customFolder} onChange={e=>setCustomFolder(e.target.value)} className="pm-control mt-1 w-full px-3 bg-black">
            <option value="">Sem subpasta — usar {folderOptions.find(([value])=>value===folderKind)?.[1]||'pasta padrão'}</option>
            {foldersForKind.map((folder:any)=><option key={folder.id} value={folder.id}>📁 {folder.name}</option>)}
          </select>
        </label>
        <button type="button" disabled={creatingFolder} onClick={()=>void createFolder()} className="min-h-10 px-3 rounded-xl border border-white/10 bg-white/[0.04] hover:bg-white/[0.08] text-xs font-semibold disabled:opacity-50">+ Criar pasta aqui</button>
      </div>}

      {provider==='external'?<div className="grid md:grid-cols-2 gap-3">
        <input value={name} onChange={e=>setName(e.target.value)} placeholder="Nome do arquivo ou material" className="pm-control px-3 bg-white/[0.03]"/>
        <input value={url} onChange={e=>setUrl(e.target.value)} placeholder="https://..." className="pm-control px-3 bg-white/[0.03]"/>
      </div>:<div className="space-y-3">
        {provider==='supabase'&&<input value={name} onChange={e=>setName(e.target.value)} placeholder="Nome personalizado (opcional quando selecionar 1 arquivo)" className="w-full min-h-11 px-3 py-2 rounded-xl bg-white/5 border border-white/10"/>}
        <label className="block rounded-2xl border border-dashed border-white/15 bg-white/[0.025] p-5 sm:p-6 hover:border-[#E30613]/50 hover:bg-[#E30613]/[0.025] transition-colors cursor-pointer">
          <input type="file" multiple onChange={e=>{
            const picked=Array.from(e.target.files||[])
            const invalid=provider==='google_drive'?picked.find(item=>item.size>driveLimitGb*1024*1024*1024):null
            if(invalid){
              toast('Cada arquivo do Google Drive pode ter até '+driveLimitGb+' GB.','error');e.currentTarget.value='';setSelectedFiles([]);return
            }
            setSelectedFiles(current=>{
              const merged=[...current,...picked]
              return merged.filter((item,index,list)=>list.findIndex(other=>other.name===item.name&&other.size===item.size&&other.lastModified===item.lastModified)===index)
            })
            e.currentTarget.value=''
          }} className="sr-only"/>
          <div className="flex items-center gap-3">
            <div className="w-11 h-11 rounded-xl bg-[#E30613]/10 text-[#E30613] flex items-center justify-center shrink-0">
              <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8"><path d="M12 16V4m0 0-4 4m4-4 4 4M5 14v5h14v-5"/></svg>
            </div>
            <div className="min-w-0">
              <p className="text-sm font-semibold">{selectedFiles.length?selectedFiles.length+' arquivo(s) na fila':'Selecionar vários arquivos'}</p>
              <p className="text-xs text-gray-500 mt-1">{provider==='google_drive'?'Seleção múltipla · até '+driveLimitGb+' GB por arquivo · somente Google Drive':'Você pode selecionar vários arquivos de uma vez'}</p>
            </div>
          </div>
        </label>
        {selectedFiles.length>0&&<div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-2">
          {selectedFiles.slice(0,12).map(item=><div key={item.name+item.lastModified} className="px-3 py-2 rounded-xl bg-black/20 border border-white/8 min-w-0">
            <p className="text-xs font-medium truncate">{item.name}</p>
            <p className="text-[10px] text-gray-500 mt-1">{sizeLabel(item.size)}</p>
          </div>)}
          {selectedFiles.length>12&&<div className="px-3 py-2 rounded-xl bg-black/20 border border-white/8 text-xs text-gray-500">+ {selectedFiles.length-12} arquivo(s)</div>}
        </div>}
      </div>}

      {provider==='google_drive'&&<p className="text-xs text-gray-500">Até {driveLimitGb} GB por arquivo no Google Drive. Os arquivos são enviados em fila, diretamente do navegador para o Drive, em partes de 16 MB.</p>}
      {saving&&<div className="rounded-xl bg-black/30 border border-[#E30613]/20 p-3"><div className="flex justify-between gap-3 text-xs"><span className="truncate text-gray-300">{currentFileName||'Preparando upload...'}</span><span className="shrink-0 text-[#ff6b7a] font-bold">{progress}%</span></div><div className="h-2 rounded bg-white/10 mt-2 overflow-hidden"><div className="h-2 rounded bg-[#E30613] transition-[width] duration-200" style={{width:progress+'%'}}/></div><p className="text-[10px] text-gray-600 mt-2">{completedFiles} de {selectedFiles.length} finalizados · não feche esta página durante o envio.</p></div>}
      <Button type="submit" loading={saving} className="w-full sm:w-auto min-h-12">{provider==='google_drive'?(selectedFiles.length>1?'Enviar '+selectedFiles.length+' arquivos':'Enviar para o Google Drive'):'Salvar arquivo'}</Button>
    </form>

</div></div></div>}
  </div>
}
