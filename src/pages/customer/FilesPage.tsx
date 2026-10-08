import { useEffect,useMemo,useState } from 'react'
import { portalApi } from '../../api/portal'
import { EmptyState } from '../../components/ui/EmptyState'
import { LoadingState } from '../../components/ui/AsyncState'
import { useToast } from '../../contexts/ToastContext'
import { useAuth } from '../../contexts/AuthContext'
import { FilePreviewModal } from '../../components/files/FilePreviewModal'

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

function fileIcon(file:any){
  const type=(file.mime_type||file.file_type||'').toLowerCase()
  const ext=extension(file.name).toLowerCase()
  if(type.startsWith('video/')||['mov','mp4','mkv','avi','webm'].includes(ext))return '🎬'
  if(type.startsWith('image/')||['jpg','jpeg','png','webp','avif','gif'].includes(ext))return '🖼️'
  if(type.startsWith('audio/')||['mp3','wav','aac','flac','m4a'].includes(ext))return '🎵'
  if(type.includes('pdf')||ext==='pdf')return '📄'
  return '📎'
}

function fileKind(file:any){
  const type=(file.mime_type||file.file_type||'').toLowerCase()
  const ext=extension(file.name).toLowerCase()
  if(type.startsWith('video/')||['mov','mp4','mkv','avi','webm'].includes(ext))return 'video'
  if(type.startsWith('image/')||['jpg','jpeg','png','webp','avif','gif'].includes(ext))return 'image'
  if(type.startsWith('audio/')||['mp3','wav','aac','flac','m4a'].includes(ext))return 'audio'
  if(type.includes('pdf')||ext==='pdf')return 'pdf'
  return 'other'
}

export function FilesPage(){
  const toast=useToast()
  const {user}=useAuth()
  const [rows,setRows]=useState<any[]>([])
  const [previewFile,setPreviewFile]=useState<any|null>(null)
  const [projects,setProjects]=useState<any[]>([])
  const [loading,setLoading]=useState(true)
  const [projectId,setProjectId]=useState<string|null>(null)
  const [uploading,setUploading]=useState(false)
  const [uploadFiles,setUploadFiles]=useState<File[]>([])
  const [uploadProgress,setUploadProgress]=useState(0)
  const [uploadName,setUploadName]=useState('')
  const [versionGroup,setVersionGroup]=useState<string|null>(null)
  const [reviewing,setReviewing]=useState<string|null>(null)
  const [adjustFile,setAdjustFile]=useState<any|null>(null)
  const [adjustSubject,setAdjustSubject]=useState('')
  const [adjustDescription,setAdjustDescription]=useState('')
  const [adjustItems,setAdjustItems]=useState<string[]>([''])
  const [adjustAttachments,setAdjustAttachments]=useState<File[]>([])
  const [projectSearch,setProjectSearch]=useState('')
  const [fileSearch,setFileSearch]=useState('')
  const [fileType,setFileType]=useState('all')
  const [fileReview,setFileReview]=useState('all')

  async function load(){
    try{
      setLoading(true)
      const [fileRows,projectRows]=await Promise.all([portalApi.files(),portalApi.projects()])
      setRows(fileRows)
      setProjects(projectRows)
    }finally{setLoading(false)}
  }

  useEffect(()=>{void load()},[])

  const groups=useMemo(()=>{
    const map=new Map<string,{project:any;files:any[]}>()
    for(const project of projects){
      map.set(project.id,{project,files:[]})
    }
    for(const file of rows){
      const key=file.project_id||'general'
      if(!map.has(key))map.set(key,{project:file.project||null,files:[]})
      map.get(key)!.files.push(file)
    }
    return Array.from(map.entries())
  },[rows,projects])

  const filteredGroups=useMemo(()=>{
    const q=projectSearch.trim().toLowerCase()
    if(!q)return groups
    return groups.filter(([,group])=>
      (group.project?.title||'Arquivos gerais').toLowerCase().includes(q)
      || group.files.some((file:any)=>(file.name||'').toLowerCase().includes(q))
    )
  },[groups,projectSearch])

  const selected=projectId?groups.find(([id])=>id===projectId)?.[1]||null:null
  const selectedIsPrimary=Boolean(user?.id&&selected?.project?.customer_id===user.id)

  const selectedVersionGroups=useMemo(()=>{
    if(!selected)return []
    const map=new Map<string,any[]>()
    for(const file of selected.files){
      const key=file.version_group_id||file.id
      if(!map.has(key))map.set(key,[])
      map.get(key)!.push(file)
    }
    return Array.from(map.entries()).map(([groupId,versions])=>({
      groupId,
      versions:versions.sort((a,b)=>(b.version_number||1)-(a.version_number||1)),
      latest:versions.sort((a,b)=>(b.version_number||1)-(a.version_number||1))[0],
    }))
  },[selected])

  const filteredVersionGroups=useMemo(()=>{
    const q=fileSearch.trim().toLowerCase()
    return selectedVersionGroups.filter(group=>{
      const file=group.latest
      const matchesSearch=!q||[
        file.name,
        file.custom_folder?.name,
        file.mime_type,
      ].filter(Boolean).join(' ').toLowerCase().includes(q)
      const matchesType=fileType==='all'||fileKind(file)===fileType
      const matchesReview=fileReview==='all'
        ||(fileReview==='pending'&&file.review_status==='pending')
        ||(fileReview==='approved'&&file.review_status==='approved')
        ||(fileReview==='changes_requested'&&file.review_status==='changes_requested')
        ||(fileReview==='none'&&!file.review_required)
      return matchesSearch&&matchesType&&matchesReview
    })
  },[selectedVersionGroups,fileSearch,fileType,fileReview])

  async function uploadToProject(){
    if(!selectedIsPrimary)return toast('Somente o cliente principal pode enviar arquivos ao projeto.','error')
    if(!projectId||projectId==='general'||!uploadFiles.length)return
    try{
      setUploading(true);setUploadProgress(0);setUploadName('')
      await portalApi.ensureProjectDriveFolder(projectId)
      for(let index=0;index<uploadFiles.length;index+=1){
        const current=uploadFiles[index]
        setUploadName(current.name)
        await portalApi.uploadDriveFile({
          project_id:projectId,
          folder_kind:'received',
          client_visible:true,
        },current,value=>setUploadProgress(Math.round(((index+(value/100))/uploadFiles.length)*100)))
      }
      setUploadFiles([]);setUploadProgress(0);setUploadName('')
      toast('Arquivos enviados para a Sagamente.','success')
      await load()
    }catch(error:any){
      toast(error.message||'Não foi possível enviar os arquivos.','error')
    }finally{setUploading(false)}
  }

  function open(file:any){
    setPreviewFile(file)
  }

  async function review(file:any,action:'approved'|'changes_requested'){
    if(file.customer_id!==user?.id)return toast('Aprovações são reservadas ao cliente principal.','error')
    if(action==='changes_requested'){
      setAdjustFile(file);setAdjustSubject('');setAdjustDescription('');setAdjustItems(['']);setAdjustAttachments([])
      return
    }
    const comment=window.prompt('Comentário opcional para a aprovação:')||''
    try{
      setReviewing(file.id)
      await portalApi.submitFileReview(file.id,action,comment)
      toast('Versão aprovada.','success')
      await load()
    }catch(error:any){toast(error.message||'Não foi possível registrar sua avaliação.','error')}
    finally{setReviewing(null)}
  }

  async function submitAdjustments(){
    if(!adjustFile)return
    if(adjustFile.customer_id!==user?.id)return toast('Somente o cliente principal pode solicitar ajustes.','error')
    const items=adjustItems.map(item=>item.trim()).filter(Boolean)
    if(!adjustSubject.trim()&&!adjustDescription.trim()&&!items.length)return toast('Descreva pelo menos um ajuste.','error')
    try{
      setReviewing(adjustFile.id)
      const uploaded=[]
      for(const file of adjustAttachments){
        uploaded.push(await portalApi.uploadFileReviewAttachment(adjustFile.customer_id,adjustFile.id,file))
      }
      await portalApi.submitFileReview(adjustFile.id,'changes_requested',adjustDescription,{
        subject:adjustSubject,items,attachments:uploaded,
      })
      toast('Solicitação de ajustes enviada para a equipe.','success')
      setAdjustFile(null)
      await load()
    }catch(error:any){toast(error.message||'Não foi possível enviar os ajustes.','error')}
    finally{setReviewing(null)}
  }

  function reviewLabel(file:any){
    if(!file.review_required)return null
    if(file.review_status==='pending')return {text:file.customer_id===user?.id?'Aguardando sua aprovação':'Aguardando aprovação do cliente principal',className:'text-yellow-300 bg-yellow-500/10'}
    if(file.review_status==='approved')return {text:'Aprovado',className:'text-emerald-400 bg-emerald-500/10'}
    if(file.review_status==='changes_requested')return {text:'Ajustes solicitados',className:'text-orange-400 bg-orange-500/10'}
    return null
  }

  return <div>
    <FilePreviewModal file={previewFile} onClose={()=>setPreviewFile(null)}/>
    <div className="mb-6">
      <h1 className="text-2xl font-bold text-white">Meus Arquivos</h1>
      <p className="text-sm text-gray-500">Organizados por projeto, como uma biblioteca de pastas.</p>
    </div>

    {loading?<LoadingState label="Organizando seus arquivos..." />:groups.length===0?<EmptyState icon="📁" title="Nenhum projeto ou arquivo ainda"/>:<>
      <section>
        <div className="mb-4">
          <h2 className="text-sm font-semibold text-white">Projetos</h2>
          <p className="text-xs text-gray-500">Entre em uma pasta para ver somente os arquivos daquele projeto.</p>
        </div>
        <input value={projectSearch} onChange={e=>setProjectSearch(e.target.value)} placeholder="Buscar projeto ou arquivo..." className="w-full min-h-11 px-4 rounded-xl bg-[#141416] border border-white/10 text-sm mb-4"/>

        <div className="grid grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-2.5 sm:gap-3">
          {filteredGroups.map(([id,group])=><button key={id} type="button" onClick={()=>{setProjectId(id);setVersionGroup(null);setFileSearch('');setFileType('all');setFileReview('all');setUploadFiles([]);setUploadProgress(0)}} className="group text-left p-3 sm:p-4 min-h-[112px] rounded-2xl border border-white/8 bg-[#121214] hover:bg-[#171719] hover:border-white/15 transition-all">
            <div className="flex items-start gap-3">
              <div className="w-11 h-11 rounded-xl bg-[#A65A2A]/10 text-[#A65A2A] flex items-center justify-center shrink-0">
                <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M4 6h6l2 2h8v10H4z"/><path d="M8 12h8"/></svg>
              </div>
              <div className="min-w-0 flex-1">
                <p className="text-sm font-semibold truncate">{group.project?.title||'Arquivos gerais'}</p>
                <p className="text-[10px] text-gray-500 mt-1">{group.files.length} arquivo(s)</p>
                <p className="text-[10px] text-gray-600 mt-2">{group.files[0]?.created_at?'Atualizado em '+new Date(group.files[0].created_at).toLocaleDateString('pt-BR'):'Sem arquivos ainda'}</p>
              </div>
              <span className="text-gray-600 group-hover:text-[#A65A2A] transition-colors">›</span>
            </div>
          </button>)}
        </div>
      </section>
    </>}

    {projectId&&selected&&<div className="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm flex items-end sm:items-center justify-center sm:p-4" onMouseDown={event=>{if(event.currentTarget===event.target&&!uploading){setProjectId(null);setVersionGroup(null)}}}>
      <div role="dialog" aria-modal="true" aria-label={selected.project?.title||'Arquivos do projeto'} className="w-full max-w-5xl h-[92vh] sm:h-auto sm:max-h-[86vh] rounded-t-2xl sm:rounded-2xl border border-white/10 bg-[#111113] shadow-2xl overflow-hidden flex flex-col">
        <div className="h-14 px-4 sm:px-5 border-b border-white/10 flex items-center gap-3 shrink-0">
          <button type="button" onClick={()=>{setProjectId(null);setVersionGroup(null)}} className="w-8 h-8 rounded-lg bg-white/[0.04] hover:bg-white/[0.08] flex items-center justify-center text-gray-300" aria-label="Voltar">←</button>
          <div className="min-w-0 flex-1">
            <p className="text-sm font-semibold truncate">{selected.project?.title||'Arquivos gerais'}</p>
            <p className="text-[10px] text-gray-500">{selected.files.length} arquivo(s) disponíveis</p>
          </div>
          {projectId!=='general'&&selectedIsPrimary&&<label className="min-h-10 px-3 rounded-xl bg-[#A65A2A] text-white text-xs font-semibold flex items-center justify-center cursor-pointer">
            <input type="file" multiple className="sr-only" disabled={uploading} onChange={event=>{
              const picked=Array.from(event.target.files||[])
              const invalid=picked.find(file=>file.size>50*1024*1024*1024)
              if(invalid){toast('Cada arquivo pode ter no máximo 50 GB.','error');event.currentTarget.value='';setUploadFiles([]);return}
              setUploadFiles(current=>{
                const merged=[...current,...picked]
                return merged.filter((item,index,list)=>list.findIndex(other=>other.name===item.name&&other.size===item.size&&other.lastModified===item.lastModified)===index)
              })
              event.currentTarget.value=''
            }}/>
            + Enviar vários
          </label>}
          <button type="button" disabled={uploading} onClick={()=>{setProjectId(null);setVersionGroup(null)}} className="w-10 h-10 rounded-xl bg-white/[0.04] hover:bg-white/[0.08] flex items-center justify-center text-gray-400 text-lg" aria-label="Fechar">×</button>
        </div>

        <div className="p-3 sm:p-5 overflow-y-auto">
          {uploadFiles.length>0&&projectId!=='general'&&selectedIsPrimary&&<div className="mb-4 p-3 rounded-2xl border border-white/10 bg-white/[0.03]">
            <div className="flex items-center justify-between gap-3">
              <div className="min-w-0">
                <p className="text-sm font-semibold">{uploadFiles.length} arquivo(s) na fila</p>
                <p className="text-[10px] text-gray-500 truncate mt-1">{uploading?(uploadName||'Enviando...'):'Até 50 GB por arquivo · enviados para Arquivos recebidos'}</p>
              </div>
              <button type="button" disabled={uploading} onClick={()=>void uploadToProject()} className="min-h-11 px-4 rounded-xl bg-[#A65A2A] text-white text-xs font-semibold shrink-0">{uploading?uploadProgress+'%':'Enviar agora'}</button>
            </div>
            {uploading&&<div className="h-2 bg-white/10 rounded-full overflow-hidden mt-3"><div className="h-full bg-[#A65A2A] transition-[width]" style={{width:uploadProgress+'%'}}/></div>}
          </div>}
          <div className="grid sm:grid-cols-3 gap-2 mb-4">
            <input value={fileSearch} onChange={e=>setFileSearch(e.target.value)} placeholder="Buscar arquivo..." className="min-h-10 px-3 rounded-xl bg-black border border-white/10 text-xs"/>
            <select value={fileType} onChange={e=>setFileType(e.target.value)} className="min-h-10 px-3 rounded-xl bg-black border border-white/10 text-xs">
              <option value="all">Todos os formatos</option>
              <option value="image">Imagens</option>
              <option value="video">Vídeos</option>
              <option value="audio">Áudios</option>
              <option value="pdf">PDF</option>
              <option value="other">Outros</option>
            </select>
            <select value={fileReview} onChange={e=>setFileReview(e.target.value)} className="min-h-10 px-3 rounded-xl bg-black border border-white/10 text-xs">
              <option value="all">Todos os status</option>
              <option value="pending">Aguardando aprovação</option>
              <option value="approved">Aprovados</option>
              <option value="changes_requested">Ajustes solicitados</option>
              <option value="none">Sem aprovação</option>
            </select>
          </div>

          {filteredVersionGroups.length===0?<div className="py-12 text-center text-sm text-gray-600 border border-dashed border-white/8 rounded-2xl">Nenhum arquivo corresponde aos filtros.</div>:<div className="grid grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-2.5 sm:gap-3">
            {filteredVersionGroups.map(group=>{
              const file=group.latest
              const status=reviewLabel(file)
              return <div key={group.groupId} className="p-2.5 sm:p-3 min-h-[178px] rounded-xl bg-[#171719] border border-white/8">
                <button type="button" onClick={()=>void open(file)} className="w-full text-left">
                  <div className="h-24 rounded-lg bg-white/[0.035] flex items-center justify-center text-3xl">{fileIcon(file)}</div>
                  <div className="mt-2 flex items-center justify-between gap-2">
                    <span className="text-[9px] font-bold text-[#A65A2A]">{extension(file.name)} · v{file.version_number||1}</span>
                    <span className="text-[9px] text-gray-600">{sizeLabel(file.file_size)}</span>
                  </div>
                  <p className="text-xs font-semibold truncate mt-1" title={file.name}>{file.name}</p>
                  <p className="text-[9px] text-gray-500 mt-1">{new Date(file.created_at).toLocaleDateString('pt-BR')}</p>
                </button>
                {status&&<div className={'mt-2 inline-flex px-2 py-1 rounded-full text-[9px] font-semibold '+status.className}>{status.text}</div>}
                <div className="mt-2 flex flex-wrap gap-1.5">
                  {group.versions.length>1&&<button type="button" onClick={()=>setVersionGroup(group.groupId)} className="min-h-8 px-2 rounded-lg bg-white/[0.05] text-[10px] text-gray-300">{group.versions.length} versões</button>}
                  {file.customer_id===user?.id&&file.review_required&&file.review_status==='pending'&&<>
                    <button disabled={reviewing===file.id} type="button" onClick={()=>void review(file,'approved')} className="min-h-8 px-2 rounded-lg bg-emerald-500/10 text-emerald-400 text-[10px] font-semibold disabled:opacity-50">Aprovar</button>
                    <button disabled={reviewing===file.id} type="button" onClick={()=>void review(file,'changes_requested')} className="min-h-8 px-2 rounded-lg bg-orange-500/10 text-orange-400 text-[10px] font-semibold disabled:opacity-50">Pedir ajuste</button>
                  </>}
                </div>
              </div>
            })}
          </div>}
        </div>
      </div>
    </div>}

    {adjustFile&&<div className="fixed inset-0 z-[70] bg-black/80 backdrop-blur-sm flex items-end sm:items-center justify-center sm:p-4">
      <div className="w-full max-w-xl max-h-[92vh] overflow-y-auto rounded-t-2xl sm:rounded-2xl bg-[#111113] border border-white/10 shadow-2xl p-4 sm:p-5">
        <div className="flex items-start justify-between gap-3 mb-5">
          <div><h3 className="text-lg font-bold">Solicitar ajustes</h3><p className="text-xs text-gray-500 mt-1">{adjustFile.name} · v{adjustFile.version_number||1}</p></div>
          <button type="button" onClick={()=>setAdjustFile(null)} className="w-9 h-9 rounded-lg bg-white/[0.05]">×</button>
        </div>
        <div className="space-y-4">
          <label className="block text-xs text-gray-400">Assunto do ajuste
            <input value={adjustSubject} onChange={e=>setAdjustSubject(e.target.value)} placeholder="Ex.: Ajustes na capa e no texto final" className="mt-1.5 w-full min-h-11 px-3 rounded-xl bg-black border border-white/10 text-sm"/>
          </label>
          <label className="block text-xs text-gray-400">Descrição
            <textarea value={adjustDescription} onChange={e=>setAdjustDescription(e.target.value)} rows={4} placeholder="Explique o resultado esperado..." className="mt-1.5 w-full px-3 py-3 rounded-xl bg-black border border-white/10 text-sm resize-y"/>
          </label>
          <div>
            <div className="flex items-center justify-between gap-3 mb-2"><p className="text-xs text-gray-400">Tópicos do ajuste</p><button type="button" onClick={()=>setAdjustItems(items=>[...items,''])} className="text-[10px] font-semibold text-[#A65A2A]">+ Adicionar tópico</button></div>
            <div className="space-y-2">{adjustItems.map((item,index)=><div key={index} className="flex gap-2"><span className="w-6 h-10 flex items-center justify-center text-xs text-gray-600">{index+1}.</span><input value={item} onChange={e=>setAdjustItems(items=>items.map((value,i)=>i===index?e.target.value:value))} placeholder="Descreva uma alteração específica" className="min-h-10 flex-1 px-3 rounded-xl bg-black border border-white/10 text-xs"/>{adjustItems.length>1&&<button type="button" onClick={()=>setAdjustItems(items=>items.filter((_,i)=>i!==index))} className="w-9 rounded-lg bg-white/[0.04] text-gray-500">×</button>}</div>)}</div>
          </div>
          <label className="block p-4 rounded-xl border border-dashed border-white/15 bg-white/[0.025] cursor-pointer">
            <input type="file" multiple accept="image/*,.pdf" className="hidden" onChange={e=>setAdjustAttachments(Array.from(e.target.files||[]))}/>
            <span className="text-sm font-semibold">Anexar referências</span>
            <span className="block text-[10px] text-gray-500 mt-1">Prints, imagens ou PDF · até 10 MB por arquivo</span>
            {adjustAttachments.length>0&&<span className="block text-xs text-[#A65A2A] mt-2">{adjustAttachments.length} anexo(s) selecionado(s)</span>}
          </label>
        </div>
        <div className="flex gap-2 mt-5">
          <button type="button" onClick={()=>setAdjustFile(null)} className="min-h-11 px-4 rounded-xl border border-white/10 text-xs">Cancelar</button>
          <button type="button" disabled={reviewing===adjustFile.id} onClick={()=>void submitAdjustments()} className="min-h-11 flex-1 px-4 rounded-xl bg-orange-500/15 text-orange-300 font-bold text-xs disabled:opacity-50">{reviewing===adjustFile.id?'Enviando...':'Enviar solicitação de ajustes'}</button>
        </div>
      </div>
    </div>}

    {versionGroup&&selected&&<div className="fixed inset-0 z-[60] bg-black/75 backdrop-blur-sm flex items-center justify-center p-4" onMouseDown={e=>{if(e.currentTarget===e.target)setVersionGroup(null)}}>
      <div className="w-full max-w-2xl max-h-[80vh] overflow-hidden rounded-2xl bg-[#111113] border border-white/10 shadow-2xl">
        <div className="h-14 px-4 border-b border-white/10 flex items-center justify-between gap-3">
          <div><p className="font-semibold text-sm">Histórico de versões</p><p className="text-[10px] text-gray-500">Abra qualquer versão anterior sem perder a atual.</p></div>
          <button onClick={()=>setVersionGroup(null)} className="w-9 h-9 rounded-lg bg-white/[0.05]">×</button>
        </div>
        <div className="p-3 sm:p-4 overflow-y-auto max-h-[calc(80vh-56px)] space-y-2">
          {selected.files.filter((file:any)=>(file.version_group_id||file.id)===versionGroup).sort((a:any,b:any)=>(b.version_number||1)-(a.version_number||1)).map((file:any)=>{
            const status=reviewLabel(file)
            return <button key={file.id} onClick={()=>void open(file)} className="w-full text-left p-3 rounded-xl bg-white/[0.035] border border-white/8 hover:border-white/15">
              <div className="flex items-center gap-3">
                <div className="w-11 h-11 rounded-lg bg-black/30 flex items-center justify-center text-xl">{fileIcon(file)}</div>
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2"><p className="text-sm font-semibold truncate">{file.name}</p><span className="text-[10px] text-[#A65A2A]">v{file.version_number||1}</span></div>
                  <p className="text-[10px] text-gray-500 mt-1">{sizeLabel(file.file_size)} · {new Date(file.created_at).toLocaleString('pt-BR')}</p>
                  {status&&<span className={'inline-flex mt-1 px-2 py-0.5 rounded-full text-[9px] '+status.className}>{status.text}</span>}
                </div>
                <span className="text-gray-600">↗</span>
              </div>
            </button>
          })}
        </div>
      </div>
    </div>}
  </div>
}
