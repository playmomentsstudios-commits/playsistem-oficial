import { useEffect,useMemo,useState } from 'react'
import { Link } from 'react-router-dom'
import { portalApi } from '../../api/portal'
import { useAuth } from '../../contexts/AuthContext'
import { useToast } from '../../contexts/ToastContext'
import { Button } from '../../components/ui/Button'
import { prioridade,rotulo,statusProjeto,tipoProjeto } from '../../lib/labels.ptBR'

const tipos=['internal','product','service','website','design','audiovisual','other']
const prioridades=['low','medium','high','urgent']
const statuses=['planning','active','paused','review','completed','cancelled']

function progress(project:any){
  const tasks=(project.tasks||[]).filter((task:any)=>task.status!=='cancelled')
  if(!tasks.length)return 0
  return Math.round(tasks.filter((task:any)=>task.status==='completed').length/tasks.length*100)
}

export function AdminProjects(){
  const {user}=useAuth()
  const toast=useToast()
  const [rows,setRows]=useState<any[]>([])
  const [customers,setCustomers]=useState<any[]>([])
  const [loading,setLoading]=useState(true)
  const [showForm,setShowForm]=useState(false)
  const [search,setSearch]=useState('')
  const [statusFilter,setStatusFilter]=useState('todos')
  const [form,setForm]=useState({
    title:'',
    description:'',
    project_type:'other',
    customer_id:'',
    status:'planning',
    priority:'medium',
    start_date:'',
    due_date:'',
    drive_folder_url:'',
  })

  const load=async()=>{
    const [projects,clients]=await Promise.all([portalApi.projects(),portalApi.customers()])
    setRows(projects)
    setCustomers(clients)
    setLoading(false)
  }

  useEffect(()=>{void load()},[])

  const filtered=useMemo(()=>rows.filter(project=>{
    const matchesText=!search.trim()||(project.title||'').toLowerCase().includes(search.toLowerCase())
    const matchesStatus=statusFilter==='todos'||project.status===statusFilter
    return matchesText&&matchesStatus
  }),[rows,search,statusFilter])

  async function create(e:React.FormEvent){
    e.preventDefault()
    if(!user||!form.title.trim())return
    try{
      const created=await portalApi.saveProject({
        title:form.title.trim(),
        description:form.description.trim()||null,
        project_type:form.project_type,
        customer_id:form.customer_id||null,
        status:form.status,
        priority:form.priority,
        start_date:form.start_date||null,
        due_date:form.due_date||null,
        drive_folder_url:form.drive_folder_url.trim()||null,
        created_by:user.id,
      })
      toast('Projeto criado com sucesso.','success')
      setShowForm(false)
      setForm({title:'',description:'',project_type:'other',customer_id:'',status:'planning',priority:'medium',start_date:'',due_date:'',drive_folder_url:''})
      window.location.href='/admin/projetos/'+created.id
    }catch(error:any){
      toast(error.message,'error')
    }
  }

  return <div>
    <div className="flex flex-wrap justify-between gap-4 items-end mb-6">
      <div>
        <h1 className="text-2xl font-bold text-white">Projetos</h1>
        <p className="text-sm text-gray-500">Gerencie trabalhos internos e projetos de clientes</p>
      </div>
      <Button onClick={()=>setShowForm(value=>!value)}>{showForm?'Fechar':'Novo projeto'}</Button>
    </div>

    {showForm&&<form onSubmit={create} className="p-5 mb-6 rounded-2xl bg-[#141416] border border-white/10 space-y-4">
      <div className="grid md:grid-cols-2 gap-3">
        <input value={form.title} onChange={e=>setForm({...form,title:e.target.value})} placeholder="Nome do projeto" className="px-3 py-2 rounded-xl bg-white/5 border border-white/10"/>
        <select value={form.customer_id} onChange={e=>setForm({...form,customer_id:e.target.value})} className="px-3 py-2 rounded-xl bg-black border border-white/10">
          <option value="">Projeto interno / sem cliente</option>
          {customers.map(client=><option key={client.id} value={client.id}>{client.first_name} {client.last_name}</option>)}
        </select>
      </div>
      <textarea rows={3} value={form.description} onChange={e=>setForm({...form,description:e.target.value})} placeholder="Descrição do projeto" className="w-full px-3 py-2 rounded-xl bg-white/5 border border-white/10"/>
      <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-3">
        <select value={form.project_type} onChange={e=>setForm({...form,project_type:e.target.value})} className="px-3 py-2 rounded-xl bg-black border border-white/10">{tipos.map(value=><option key={value} value={value}>{rotulo(tipoProjeto,value)}</option>)}</select>
        <select value={form.priority} onChange={e=>setForm({...form,priority:e.target.value})} className="px-3 py-2 rounded-xl bg-black border border-white/10">{prioridades.map(value=><option key={value} value={value}>{rotulo(prioridade,value)}</option>)}</select>
        <select value={form.status} onChange={e=>setForm({...form,status:e.target.value})} className="px-3 py-2 rounded-xl bg-black border border-white/10">{statuses.map(value=><option key={value} value={value}>{rotulo(statusProjeto,value)}</option>)}</select>
        <input value={form.drive_folder_url} onChange={e=>setForm({...form,drive_folder_url:e.target.value})} placeholder="Link da pasta no Drive" className="px-3 py-2 rounded-xl bg-white/5 border border-white/10"/>
      </div>
      <div className="grid sm:grid-cols-2 gap-3">
        <label className="text-sm text-gray-400">Início<input type="date" value={form.start_date} onChange={e=>setForm({...form,start_date:e.target.value})} className="mt-1 w-full px-3 py-2 rounded-xl bg-black border border-white/10"/></label>
        <label className="text-sm text-gray-400">Prazo<input type="date" value={form.due_date} onChange={e=>setForm({...form,due_date:e.target.value})} className="mt-1 w-full px-3 py-2 rounded-xl bg-black border border-white/10"/></label>
      </div>
      <Button type="submit">Criar e abrir projeto</Button>
    </form>}

    <div className="flex flex-wrap gap-3 mb-5">
      <input value={search} onChange={e=>setSearch(e.target.value)} placeholder="Buscar projeto..." className="px-4 py-2 rounded-xl bg-white/5 border border-white/10"/>
      <select value={statusFilter} onChange={e=>setStatusFilter(e.target.value)} className="px-3 py-2 rounded-xl bg-black border border-white/10">
        <option value="todos">Todos os status</option>
        {statuses.map(value=><option key={value} value={value}>{rotulo(statusProjeto,value)}</option>)}
      </select>
      <Link to="/admin/produtividade" className="px-4 py-2 rounded-xl bg-white/5 text-sm flex items-center">Abrir produtividade →</Link>
    </div>

    {loading?<p className="text-gray-400">Carregando...</p>:!filtered.length?<p className="text-gray-500">Nenhum projeto encontrado.</p>:<div className="grid lg:grid-cols-2 gap-4">{filtered.map(project=><Link key={project.id} to={'/admin/projetos/'+project.id} className="p-5 rounded-2xl bg-[#141416] border border-white/10 hover:border-white/20 transition-colors">
      <div className="flex justify-between gap-3">
        <div><b className="text-white">{project.title}</b><p className="text-xs text-gray-500 mt-1">{rotulo(tipoProjeto,project.project_type)} · prioridade {rotulo(prioridade,project.priority)}</p></div>
        <span className="text-sm text-gray-300">{rotulo(statusProjeto,project.status)}</span>
      </div>
      <div className="flex justify-between mt-4 text-sm"><span className="text-gray-500">Progresso</span><b>{progress(project)}%</b></div>
      <div className="h-2 bg-white/10 rounded mt-2"><div className="h-2 bg-[#E30613] rounded" style={{width:progress(project)+'%'}}/></div>
      {project.due_date&&<p className="text-xs text-gray-500 mt-3">Prazo: {new Date(project.due_date+'T12:00').toLocaleDateString('pt-BR')}</p>}
    </Link>)}</div>}
  </div>
}
