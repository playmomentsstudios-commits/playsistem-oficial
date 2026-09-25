import { useEffect,useMemo,useState } from 'react'
import { Link } from 'react-router-dom'
import { portalApi } from '../../api/portal'
import { useAuth } from '../../contexts/AuthContext'
import { useToast } from '../../contexts/ToastContext'
import { rotulo,statusOrcamento } from '../../lib/labels.ptBR'

const money=(v:number)=>new Intl.NumberFormat('pt-BR',{style:'currency',currency:'BRL'}).format((v||0)/100)

export function AdminQuotes(){
  const {user}=useAuth()
  const toast=useToast()
  const [rows,setRows]=useState<any[]>([])
  const [customers,setCustomers]=useState<any[]>([])
  const [showForm,setShowForm]=useState(false)
  const [search,setSearch]=useState('')
  const [status,setStatus]=useState('todos')
  const [form,setForm]=useState({customer_id:'',title:'',description:'',valid_until:'',notes:''})

  const load=async()=>{
    const [quotes,clients]=await Promise.all([portalApi.quotes(),portalApi.customers()])
    setRows(quotes)
    setCustomers(clients.filter((c:any)=>c.status==='active'))
  }

  useEffect(()=>{void load()},[])

  const filtered=useMemo(()=>rows.filter(q=>{
    const text=(q.quote_number+' '+q.title+' '+(q.customer?.first_name||'')+' '+(q.customer?.last_name||'')+' '+(q.customer?.email||'')).toLowerCase()
    return text.includes(search.toLowerCase())&&(status==='todos'||q.status===status)
  }),[rows,search,status])

  async function create(e:React.FormEvent){
    e.preventDefault()
    if(!user||!form.customer_id||!form.title.trim())return
    try{
      const quote=await portalApi.createQuote({
        customer_id:form.customer_id,
        title:form.title.trim(),
        description:form.description.trim()||null,
        valid_until:form.valid_until||null,
        notes:form.notes.trim()||null,
        status:'draft',
        created_by:user.id,
      })
      toast('Orçamento criado.','success')
      window.location.href='/admin/orcamentos/'+quote.id
    }catch(error:any){toast(error.message,'error')}
  }

  return <div>
    <div className="flex flex-wrap justify-between gap-4 items-end mb-6">
      <div><h1 className="text-2xl font-bold text-white">Orçamentos</h1><p className="text-sm text-gray-500">Crie, envie e acompanhe propostas comerciais</p></div>
      <button onClick={()=>setShowForm(v=>!v)} className="px-4 py-2.5 rounded-xl bg-[#E30613]">{showForm?'Fechar':'Novo orçamento'}</button>
    </div>

    {showForm&&<form onSubmit={create} className="p-5 rounded-2xl bg-[#141416] border border-white/10 mb-5 space-y-3">
      <div className="grid md:grid-cols-2 gap-3">
        <select value={form.customer_id} onChange={e=>setForm({...form,customer_id:e.target.value})} className="px-3 py-2 rounded-xl bg-black border border-white/10"><option value="">Selecione o cliente</option>{customers.map(c=><option key={c.id} value={c.id}>{c.first_name} {c.last_name} — {c.email}</option>)}</select>
        <input value={form.title} onChange={e=>setForm({...form,title:e.target.value})} placeholder="Título do orçamento" className="px-3 py-2 rounded-xl bg-white/5 border border-white/10"/>
      </div>
      <textarea rows={3} value={form.description} onChange={e=>setForm({...form,description:e.target.value})} placeholder="Descrição" className="w-full px-3 py-2 rounded-xl bg-white/5 border border-white/10"/>
      <div className="grid md:grid-cols-2 gap-3">
        <label className="text-sm text-gray-400">Validade<input type="date" value={form.valid_until} onChange={e=>setForm({...form,valid_until:e.target.value})} className="mt-1 w-full px-3 py-2 rounded-xl bg-black border border-white/10"/></label>
        <label className="text-sm text-gray-400">Observações<input value={form.notes} onChange={e=>setForm({...form,notes:e.target.value})} className="mt-1 w-full px-3 py-2 rounded-xl bg-white/5 border border-white/10"/></label>
      </div>
      <button type="submit" className="px-4 py-2 rounded-xl bg-[#E30613]">Criar orçamento</button>
    </form>}

    <div className="flex flex-wrap gap-3 mb-4">
      <input value={search} onChange={e=>setSearch(e.target.value)} placeholder="Buscar orçamento ou cliente..." className="px-4 py-2.5 rounded-xl bg-white/5 border border-white/10"/>
      <select value={status} onChange={e=>setStatus(e.target.value)} className="px-3 py-2.5 rounded-xl bg-black border border-white/10"><option value="todos">Todos os status</option>{['draft','sent','viewed','accepted','rejected','expired'].map(value=><option key={value} value={value}>{rotulo(statusOrcamento,value)}</option>)}</select>
    </div>

    <div className="space-y-2">{filtered.map(q=><Link key={q.id} to={'/admin/orcamentos/'+q.id} className="p-4 rounded-2xl bg-[#141416] border border-white/10 flex justify-between gap-4">
      <div><b className="text-[#E30613]">{q.quote_number}</b><p>{q.title}</p><p className="text-xs text-gray-500">{q.customer?q.customer.first_name+' '+q.customer.last_name:'Cliente'}</p></div>
      <div className="text-right"><b>{money(q.total)}</b><p className="text-xs text-gray-500">{rotulo(statusOrcamento,q.status)}</p></div>
    </Link>)}</div>
  </div>
}
