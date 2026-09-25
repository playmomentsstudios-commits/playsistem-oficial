import { useEffect,useMemo,useState } from 'react'
import { portalApi } from '../../api/portal'
import { EmptyState } from '../../components/ui/EmptyState'

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

export function FilesPage(){
  const [rows,setRows]=useState<any[]>([])
  const [projects,setProjects]=useState<any[]>([])
  const [loading,setLoading]=useState(true)
  const [projectId,setProjectId]=useState<string|null>(null)
  const [uploading,setUploading]=useState(false)
  const [uploadFiles,setUploadFiles]=useState<File[]>([])
  const [uploadProgress,setUploadProgress]=useState(0)
  const [uploadName,setUploadName]=useState('')

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

  const selected=projectId?groups.find(([id])=>id===projectId)?.[1]||null:null

  async function uploadToProject(){
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
      await load()
    }finally{setUploading(false)}
  }

  async function open(file:any){
    if(file.external_url){window.open(file.external_url,'_blank','noopener');return}
    if(file.storage_path){window.open(await portalApi.fileUrl(file.storage_path),'_blank','noopener');return}
    if(file.drive_file_id){window.open('https://drive.google.com/file/d/'+file.drive_file_id+'/view','_blank','noopener')}
  }

  return <div>
    <div className="mb-6">
      <h1 className="text-2xl font-bold text-white">Meus Arquivos</h1>
      <p className="text-sm text-gray-500">Organizados por projeto, como uma biblioteca de pastas.</p>
    </div>

    {loading?<p className="text-gray-400">Carregando...</p>:!rows.length?<EmptyState icon="📁" title="Nenhum arquivo ainda"/>:<>
      <section>
        <div className="mb-4">
          <h2 className="text-sm font-semibold text-white">Projetos</h2>
          <p className="text-xs text-gray-500">Entre em uma pasta para ver somente os arquivos daquele projeto.</p>
        </div>

        <div className="grid grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-2.5 sm:gap-3">
          {groups.map(([id,group])=><button key={id} type="button" onClick={()=>{setProjectId(id);setUploadFiles([]);setUploadProgress(0)}} className="group text-left p-3 sm:p-4 min-h-[112px] rounded-2xl border border-white/8 bg-[#121214] hover:bg-[#171719] hover:border-white/15 transition-all">
            <div className="flex items-start gap-3">
              <div className="w-11 h-11 rounded-xl bg-[#E30613]/10 text-[#E30613] flex items-center justify-center shrink-0">
                <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M4 6h6l2 2h8v10H4z"/><path d="M8 12h8"/></svg>
              </div>
              <div className="min-w-0 flex-1">
                <p className="text-sm font-semibold truncate">{group.project?.title||'Arquivos gerais'}</p>
                <p className="text-[10px] text-gray-500 mt-1">{group.files.length} arquivo(s)</p>
                <p className="text-[10px] text-gray-600 mt-2">Atualizado em {new Date(group.files[0]?.created_at).toLocaleDateString('pt-BR')}</p>
              </div>
              <span className="text-gray-600 group-hover:text-[#E30613] transition-colors">›</span>
            </div>
          </button>)}
        </div>
      </section>
    </>}

    {projectId&&selected&&<div className="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm flex items-end sm:items-center justify-center sm:p-4" onMouseDown={event=>{if(event.currentTarget===event.target&&!uploading)setProjectId(null)}}>
      <div className="w-full max-w-5xl h-[92vh] sm:h-auto sm:max-h-[86vh] rounded-t-2xl sm:rounded-2xl border border-white/10 bg-[#111113] shadow-2xl overflow-hidden flex flex-col">
        <div className="h-14 px-4 sm:px-5 border-b border-white/10 flex items-center gap-3 shrink-0">
          <button type="button" onClick={()=>setProjectId(null)} className="w-8 h-8 rounded-lg bg-white/[0.04] hover:bg-white/[0.08] flex items-center justify-center text-gray-300" aria-label="Voltar">←</button>
          <div className="min-w-0 flex-1">
            <p className="text-sm font-semibold truncate">{selected.project?.title||'Arquivos gerais'}</p>
            <p className="text-[10px] text-gray-500">{selected.files.length} arquivo(s) disponíveis</p>
          </div>
          {projectId!=='general'&&<label className="min-h-10 px-3 rounded-xl bg-[#E30613] text-white text-xs font-semibold flex items-center justify-center cursor-pointer">
            <input type="file" multiple className="sr-only" disabled={uploading} onChange={event=>{
              const picked=Array.from(event.target.files||[])
              const invalid=picked.find(file=>file.size>10*1024*1024*1024)
              if(invalid){event.currentTarget.value='';setUploadFiles([]);return}
              setUploadFiles(picked)
            }}/>
            + Enviar
          </label>}
          <button type="button" disabled={uploading} onClick={()=>setProjectId(null)} className="w-10 h-10 rounded-xl bg-white/[0.04] hover:bg-white/[0.08] flex items-center justify-center text-gray-400 text-lg" aria-label="Fechar">×</button>
        </div>

        <div className="p-3 sm:p-5 overflow-y-auto">
          {uploadFiles.length>0&&projectId!=='general'&&<div className="mb-4 p-3 rounded-2xl border border-white/10 bg-white/[0.03]">
            <div className="flex items-center justify-between gap-3">
              <div className="min-w-0">
                <p className="text-sm font-semibold">{uploadFiles.length} arquivo(s) selecionado(s)</p>
                <p className="text-[10px] text-gray-500 truncate mt-1">{uploading?(uploadName||'Enviando...'):'Até 10 GB por arquivo · enviados para Arquivos recebidos'}</p>
              </div>
              <button type="button" disabled={uploading} onClick={()=>void uploadToProject()} className="min-h-11 px-4 rounded-xl bg-[#E30613] text-white text-xs font-semibold shrink-0">{uploading?uploadProgress+'%':'Enviar agora'}</button>
            </div>
            {uploading&&<div className="h-2 bg-white/10 rounded-full overflow-hidden mt-3"><div className="h-full bg-[#E30613] transition-[width]" style={{width:uploadProgress+'%'}}/></div>}
          </div>}
          <div className="grid grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-2.5 sm:gap-3">
            {selected.files.map(file=><button key={file.id} type="button" onClick={()=>void open(file)} className="text-left p-2.5 sm:p-3 min-h-[150px] rounded-xl bg-[#171719] border border-white/8 hover:border-white/15 transition-colors">
              <div className="h-24 rounded-lg bg-white/[0.035] flex items-center justify-center text-3xl">{fileIcon(file)}</div>
              <div className="mt-2 flex items-center justify-between gap-2">
                <span className="text-[9px] font-bold text-[#E30613]">{extension(file.name)}</span>
                <span className="text-[9px] text-gray-600">{sizeLabel(file.file_size)}</span>
              </div>
              <p className="text-xs font-semibold truncate mt-1" title={file.name}>{file.name}</p>
              <p className="text-[9px] text-gray-500 mt-1">{new Date(file.created_at).toLocaleDateString('pt-BR')}</p>
            </button>)}
          </div>
        </div>
      </div>
    </div>}
  </div>
}
