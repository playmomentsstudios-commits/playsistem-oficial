import { useEffect,useMemo,useState } from 'react'
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
  const [clientVisible,setClientVisible]=useState(true)
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

  const customerProjects=useMemo(
    ()=>projects.filter((p:any)=>p.customer_id===customer),
    [projects,customer],
  )
  const selectedProject=customerProjects.find((p:any)=>p.id===project)
  const tasks=selectedProject?.tasks||[]

  async function testDrive(){
    try{
      setTesting(true)
      const result=await portalApi.driveConnectionTest()
      toast('Google Drive conectado: '+(result.account?.emailAddress||result.account?.displayName||'conta autorizada')+'.','success')
    }catch(error:any){
      toast(error.message||'Falha ao testar Google Drive.','error')
    }finally{setTesting(false)}
  }

  async function save(e:React.FormEvent){
    e.preventDefault()
    if(!user||!customer)return
    try{
      setSaving(true)
      setProgress(0)

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
          customer_id:customer,
          project_id:project||null,
          task_id:task||null,
          uploaded_by:user.id,
          name:name.trim(),
          storage_path,
          file_type:file.type||null,
          client_visible:clientVisible,
        })
        toast('Arquivo enviado ao armazenamento do portal.','success')
      }else{
        if(!name.trim()||!url.trim())throw new Error('Informe o nome e o link externo.')
        await portalApi.addClientFile({
          customer_id:customer,
          project_id:project||null,
          task_id:task||null,
          uploaded_by:user.id,
          name:name.trim(),
          external_url:url.trim(),
          client_visible:clientVisible,
        })
        toast('Link externo registrado.','success')
      }

      setName('');setUrl('');setFile(null);setTask('');setProgress(0)
      await load()
    }catch(error:any){
      toast(error.message||'Não foi possível salvar o arquivo.','error')
    }finally{setSaving(false)}
  }

  async function open(row:any){
    if(row.external_url){
      window.open(row.external_url,'_blank','noopener')
      return
    }
    if(row.storage_path){
      window.open(await portalApi.fileUrl(row.storage_path),'_blank','noopener')
    }
  }

  return <div>
    <div className="flex flex-wrap justify-between gap-4 items-end mb-6">
      <div>
        <h1 className="text-2xl font-bold">Central de Arquivos</h1>
        <p className="text-sm text-gray-500">Cliente → Projeto → Tarefa, com Google Drive para arquivos pesados.</p>
      </div>
      <Button type="button" variant="secondary" loading={testing} onClick={testDrive}>Testar Google Drive</Button>
    </div>

    <form onSubmit={save} className="p-5 rounded-2xl bg-[#141416] border border-white/10 mb-6 space-y-4">
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
        <input type="file" onChange={e=>setFile(e.target.files?.[0]||null)} className="px-3 py-2 rounded-xl bg-white/5 border border-white/10"/>
      </div>}

      {provider==='google_drive'&&<p className="text-xs text-gray-500">Arquivos grandes são enviados diretamente do navegador ao Google Drive em partes de 8 MB. Eles não ocupam o Storage do Supabase.</p>}

      {saving&&progress>0&&<div>
        <div className="flex justify-between text-xs text-gray-500"><span>Enviando ao Google Drive</span><span>{progress}%</span></div>
        <div className="h-2 rounded bg-white/10 mt-2"><div className="h-2 rounded bg-[#E30613]" style={{width:progress+'%'}}/></div>
      </div>}

      <Button type="submit" loading={saving}>{provider==='google_drive'?'Enviar para o Google Drive':'Salvar arquivo'}</Button>
    </form>

    {loading?<p>Carregando...</p>:<div className="space-y-2">{files.map(row=><div key={row.id} className="p-4 rounded-2xl bg-[#141416] border border-white/10 flex flex-wrap justify-between gap-4">
      <div className="min-w-0">
        <div className="flex flex-wrap items-center gap-2">
          <b className="truncate">{row.name}</b>
          <span className="text-[10px] px-2 py-1 rounded-full bg-white/5 text-gray-400">
            {row.storage_provider==='google_drive'?'Google Drive':row.storage_provider==='external'?'Externo':'Supabase'}
          </span>
        </div>
        <p className="text-xs text-gray-500 mt-1">
          {row.customer?.first_name} {row.customer?.last_name}
          {row.project?.title?' · '+row.project.title:''}
          {row.task?.title?' · '+row.task.title:''}
        </p>
        <p className="text-xs text-gray-600 mt-1">{sizeLabel(row.file_size)} · {new Date(row.created_at).toLocaleString('pt-BR')}</p>
      </div>
      <div className="flex items-center gap-3">
        <span className={row.client_visible?'text-sm text-emerald-400':'text-sm text-yellow-400'}>{row.client_visible?'Cliente':'Interno'}</span>
        {(row.external_url||row.storage_path)&&<button type="button" onClick={()=>open(row)} className="px-3 py-2 rounded-lg bg-white/5 text-sm">Abrir</button>}
      </div>
    </div>)}</div>}
  </div>
}
