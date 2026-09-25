import { useEffect,useMemo,useState } from 'react'
import { Link } from 'react-router-dom'
import { portalApi } from '../../api/portal'
import { useAuth } from '../../contexts/AuthContext'
import { useToast } from '../../contexts/ToastContext'
import { Button } from '../../components/ui/Button'

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

export function AdminFiles(){
  const {user}=useAuth()
  const toast=useToast()
  const [files,setFiles]=useState<any[]>([])
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
  const [folderKind,setFolderKind]=useState('received')
  const [clientVisible,setClientVisible]=useState(false)
  const [name,setName]=useState('')
  const [url,setUrl]=useState('')
  const [file,setFile]=useState<File|null>(null)

  const load=async()=>{
    try{
      setLoading(true)
      const [f,c,p]=await Promise.all([portalApi.files(),portalApi.customers(),portalApi.projects()])
      setFiles(f);setCustomers(c);setProjects(p)
    }finally{setLoading(false)}
  }

  useEffect(()=>{void load()},[])

  const customerProjects=useMemo(()=>projects.filter((p:any)=>p.customer_id===customer),[projects,customer])
  const selectedProject=customerProjects.find((p:any)=>p.id===project)
  const tasks=selectedProject?.tasks||[]
  const recent=files.slice(0,8)

  const grouped=useMemo(()=>{
    const map=new Map<string,{customer:any;projects:Map<string,{project:any;files:any[]}>}>()
    for(const row of files){
      const customerKey=row.customer_id||'sem-cliente'
      if(!map.has(customerKey))map.set(customerKey,{customer:row.customer,projects:new Map()})
      const group=map.get(customerKey)!
      const projectKey=row.project_id||'sem-projeto'
      if(!group.projects.has(projectKey))group.projects.set(projectKey,{project:row.project,files:[]})
      group.projects.get(projectKey)!.files.push(row)
    }
    return Array.from(map.entries())
  },[files])

  async function testDrive(){
    try{
      setTesting(true)
      const result=await portalApi.driveConnectionTest()
      toast('Google Drive conectado: '+(result.account?.emailAddress||result.account?.displayName||'conta autorizada')+'.','success')
    }catch(error:any){toast(error.message||'Falha ao testar Google Drive.','error')}
    finally{setTesting(false)}
  }

  async function save(e:React.FormEvent){
    e.preventDefault()
    if(!user||!customer)return
    try{
      setSaving(true);setProgress(0)
      if(provider==='google_drive'){
        if(!project||!file)throw new Error('Selecione um projeto e um arquivo para enviar ao Google Drive.')
        await portalApi.ensureProjectDriveFolder(project)
        await portalApi.uploadDriveFile({
          project_id:project,
          task_id:task||null,
          folder_kind:folderKind,
          client_visible:clientVisible,
        },file,setProgress)
        toast('Arquivo enviado para o Google Drive e vinculado ao projeto.','success')
      }else if(provider==='supabase'){
        if(!name.trim()||!file)throw new Error('Informe o nome e selecione um arquivo.')
        const storage_path=await portalApi.uploadClientFile(customer,file)
        await portalApi.addClientFile({
          customer_id:customer,project_id:project||null,task_id:task||null,uploaded_by:user.id,
          name:name.trim(),storage_path,file_type:file.type||null,storage_provider:'supabase',
          file_size:file.size,mime_type:file.type||null,client_visible:clientVisible,
        })
        toast('Arquivo enviado ao armazenamento do portal.','success')
      }else{
        if(!name.trim()||!url.trim())throw new Error('Informe o nome e o link externo.')
        await portalApi.addClientFile({
          customer_id:customer,project_id:project||null,task_id:task||null,uploaded_by:user.id,
          name:name.trim(),external_url:url.trim(),storage_provider:'external',client_visible:clientVisible,
        })
        toast('Link externo registrado.','success')
      }
      setName('');setUrl('');setFile(null);setTask('');setProgress(0)
      await load()
    }catch(error:any){toast(error.message||'Não foi possível salvar o arquivo.','error')}
    finally{setSaving(false)}
  }

  async function open(row:any){
    if(row.external_url){window.open(row.external_url,'_blank','noopener');return}
    if(row.storage_path){window.open(await portalApi.fileUrl(row.storage_path),'_blank','noopener')}
  }

  async function remove(row:any){
    if(!window.confirm('Excluir "'+row.name+'"? Esta ação também remove o arquivo do armazenamento quando aplicável.'))return
    try{
      await portalApi.deleteClientFile(row.id)
      toast('Arquivo excluído.','success')
      await load()
    }catch(error:any){toast(error.message||'Não foi possível excluir o arquivo.','error')}
  }

  async function move(row:any,kind:string){
    try{
      await portalApi.moveDriveFile(row.id,kind)
      toast('Arquivo movido no Google Drive.','success')
      await load()
    }catch(error:any){toast(error.message||'Não foi possível mover o arquivo.','error')}
  }

  return <div>
    <div className="flex flex-wrap justify-between gap-4 items-end mb-6">
      <div>
        <h1 className="text-2xl font-bold">Central de Arquivos</h1>
        <p className="text-sm text-gray-500">Cliente → Projeto → Tarefa, com Google Drive para arquivos pesados.</p>
      </div>
      <Button type="button" variant="secondary" loading={testing} onClick={testDrive}>Testar Google Drive</Button>
    </div>

    <form onSubmit={save} className="p-5 rounded-2xl bg-[#141416] border border-white/10 mb-8 space-y-4">
      <div className="grid md:grid-cols-3 gap-3">
        <label className="text-xs text-gray-500">Armazenamento
          <select value={provider} onChange={e=>setProvider(e.target.value as typeof provider)} className="mt-1 w-full px-3 py-2 rounded-xl bg-black border border-white/10">
            <option value="google_drive">Google Drive — recomendado</option>
            <option value="supabase">Portal / Supabase — arquivos pequenos</option>
            <option value="external">Link externo</option>
          </select>
        </label>
        <label className="text-xs text-gray-500">Cliente
          <select value={customer} onChange={e=>{setCustomer(e.target.value);setProject('');setTask('')}} className="mt-1 w-full px-3 py-2 rounded-xl bg-black border border-white/10">
            <option value="">Selecione o cliente</option>
            {customers.map(c=><option key={c.id} value={c.id}>{c.first_name} {c.last_name} — {c.email}</option>)}
          </select>
        </label>
        <label className="text-xs text-gray-500">Projeto
          <select value={project} onChange={e=>{setProject(e.target.value);setTask('')}} className="mt-1 w-full px-3 py-2 rounded-xl bg-black border border-white/10">
            <option value="">Sem projeto</option>
            {customerProjects.map((p:any)=><option key={p.id} value={p.id}>{p.title}</option>)}
          </select>
        </label>
      </div>

      <div className="grid md:grid-cols-3 gap-3">
        <label className="text-xs text-gray-500">Tarefa
          <select value={task} onChange={e=>setTask(e.target.value)} disabled={!project} className="mt-1 w-full px-3 py-2 rounded-xl bg-black border border-white/10 disabled:opacity-40">
            <option value="">Arquivo geral do projeto</option>
            {tasks.map((t:any)=><option key={t.id} value={t.id}>{t.title}</option>)}
          </select>
        </label>
        {provider==='google_drive'&&<label className="text-xs text-gray-500">Pasta do projeto
          <select value={folderKind} onChange={e=>setFolderKind(e.target.value)} className="mt-1 w-full px-3 py-2 rounded-xl bg-black border border-white/10">
            {folderOptions.map(([value,label])=><option key={value} value={value}>{label}</option>)}
          </select>
        </label>}
        <label className="text-xs text-gray-500">Visibilidade
          <select value={clientVisible?'client':'internal'} onChange={e=>setClientVisible(e.target.value==='client')} className="mt-1 w-full px-3 py-2 rounded-xl bg-black border border-white/10">
            <option value="client">Visível ao cliente</option>
            <option value="internal">Somente equipe</option>
          </select>
        </label>
      </div>

      {provider==='external'?<div className="grid md:grid-cols-2 gap-3">
        <input value={name} onChange={e=>setName(e.target.value)} placeholder="Nome do arquivo ou material" className="px-3 py-2 rounded-xl bg-white/5 border border-white/10"/>
        <input value={url} onChange={e=>setUrl(e.target.value)} placeholder="https://..." className="px-3 py-2 rounded-xl bg-white/5 border border-white/10"/>
      </div>:<div className="grid md:grid-cols-2 gap-3">
        {provider==='supabase'&&<input value={name} onChange={e=>setName(e.target.value)} placeholder="Nome exibido ao cliente" className="px-3 py-2 rounded-xl bg-white/5 border border-white/10"/>}
        <input type="file" onChange={e=>{
          const selected=e.target.files?.[0]||null
          if(selected&&provider==='google_drive'&&selected.size>1024*1024*1024){
            toast('O limite por arquivo no Google Drive é 1 GB.','error');e.currentTarget.value='';setFile(null);return
          }
          setFile(selected)
        }} className="px-3 py-2 rounded-xl bg-white/5 border border-white/10"/>
      </div>}

      {provider==='google_drive'&&<p className="text-xs text-gray-500">Arquivos de até 1 GB são enviados diretamente ao Google Drive em partes de 16 MB, com retomada automática.</p>}
      {saving&&progress>0&&<div><div className="flex justify-between text-xs text-gray-500"><span>Enviando ao Google Drive</span><span>{progress}%</span></div><div className="h-2 rounded bg-white/10 mt-2"><div className="h-2 rounded bg-[#E30613]" style={{width:progress+'%'}}/></div></div>}
      <Button type="submit" loading={saving}>{provider==='google_drive'?'Enviar para o Google Drive':'Salvar arquivo'}</Button>
    </form>

    <section className="mb-9">
      <div className="flex items-end justify-between mb-3"><div><h2 className="text-lg font-bold">Adicionados recentemente</h2><p className="text-xs text-gray-500">Últimos 8 arquivos registrados</p></div></div>
      {loading?<p className="text-gray-500">Carregando...</p>:recent.length===0?<p className="text-sm text-gray-500">Nenhum arquivo ainda.</p>:<div className="grid grid-cols-2 md:grid-cols-4 xl:grid-cols-8 gap-3">
        {recent.map(row=><button key={row.id} type="button" onClick={()=>open(row)} className="text-left p-3 rounded-2xl bg-[#141416] border border-white/10 hover:border-white/20 min-w-0">
          <div className="h-16 rounded-xl bg-white/5 flex items-center justify-center text-3xl mb-3">{fileIcon(row)}</div>
          <div className="text-[10px] text-[#E30613] font-bold">{extension(row.name)}</div>
          <div className="text-xs font-semibold truncate mt-1" title={row.name}>{row.name}</div>
          <div className="text-[10px] text-gray-500 mt-1 truncate">{row.customer?.first_name||'Sem cliente'}{row.project?.title?' · '+row.project.title:''}</div>
          <div className="text-[10px] text-gray-600 mt-1">{sizeLabel(row.file_size)}</div>
        </button>)}
      </div>}
    </section>

    <section>
      <div className="mb-4"><h2 className="text-lg font-bold">Biblioteca por cliente</h2><p className="text-xs text-gray-500">Organização visual semelhante à estrutura do Drive.</p></div>
      {loading?<p className="text-gray-500">Carregando...</p>:grouped.length===0?<p className="text-sm text-gray-500">Nenhum arquivo registrado.</p>:<div className="space-y-5">
        {grouped.map(([customerId,group])=><div key={customerId} className="rounded-2xl border border-white/10 bg-[#101012] overflow-hidden">
          <div className="px-5 py-4 bg-white/[0.03] border-b border-white/10 flex items-center gap-3">
            <span className="text-xl">📁</span>
            <div><h3 className="font-bold">{group.customer?[group.customer.first_name,group.customer.last_name].filter(Boolean).join(' '):'Sem cliente'}</h3><p className="text-xs text-gray-500">{group.customer?.email||''}</p></div>
          </div>
          <div className="p-4 space-y-4">
            {Array.from(group.projects.entries()).map(([projectId,projectGroup])=><div key={projectId}>
              <div className="flex items-center justify-between mb-2">
                <div className="flex items-center gap-2"><span>📂</span><b className="text-sm">{projectGroup.project?.title||'Arquivos gerais'}</b><span className="text-[10px] text-gray-600">{projectGroup.files.length} arquivo(s)</span></div>
                {projectGroup.project&&<Link to={'/admin/projetos/'+projectGroup.project.id} className="text-xs text-[#E30613]">Abrir projeto →</Link>}
              </div>
              <div className="grid sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3">
                {projectGroup.files.map(row=><div key={row.id} className="p-3 rounded-xl bg-[#17171a] border border-white/10">
                  <div className="flex gap-3">
                    <div className="w-12 h-12 shrink-0 rounded-xl bg-white/5 flex items-center justify-center text-2xl">{fileIcon(row)}</div>
                    <div className="min-w-0 flex-1">
                      <div className="flex gap-2 items-center"><span className="text-[10px] text-[#E30613] font-bold">{extension(row.name)}</span><span className="text-[10px] text-gray-600">{sizeLabel(row.file_size)}</span></div>
                      <p className="text-sm font-medium truncate mt-1" title={row.name}>{row.name}</p>
                      <p className="text-[10px] text-gray-500 truncate">{row.task?.title||'Arquivo geral do projeto'}</p>
                    </div>
                  </div>
                  <div className="mt-3 flex flex-wrap gap-2">
                    {(row.external_url||row.storage_path)&&<button type="button" onClick={()=>open(row)} className="px-2.5 py-1.5 rounded-lg bg-white/5 text-xs">Abrir</button>}
                    {row.storage_provider==='google_drive'&&row.project_id&&<select defaultValue="" onChange={e=>{if(e.target.value){void move(row,e.target.value);e.currentTarget.value=''}}} className="px-2 py-1.5 rounded-lg bg-black border border-white/10 text-xs">
                      <option value="">Mover...</option>
                      {folderOptions.map(([value,label])=><option key={value} value={value}>{label}</option>)}
                    </select>}
                    <button type="button" onClick={()=>remove(row)} className="px-2.5 py-1.5 rounded-lg bg-red-500/10 text-red-400 text-xs">Excluir</button>
                  </div>
                </div>)}
              </div>
            </div>)}
          </div>
        </div>)}
      </div>}
    </section>
  </div>
}
