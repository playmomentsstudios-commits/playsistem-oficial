import { useEffect,useMemo,useState } from 'react'
import { Link } from 'react-router-dom'
import { portalApi } from '../../api/portal'
import { Badge } from '../../components/ui/Badge'
import { motivoStatusCliente,rotulo,statusCliente } from '../../lib/labels.ptBR'

export function AdminCustomers(){
  const [rows,setRows]=useState<any[]>([])
  const [search,setSearch]=useState('')
  const [status,setStatus]=useState('todos')
  const [loading,setLoading]=useState(true)

  useEffect(()=>{portalApi.customers().then(setRows).finally(()=>setLoading(false))},[])

  const filtered=useMemo(()=>rows.filter(customer=>{
    const text=((customer.first_name||'')+' '+(customer.last_name||'')+' '+customer.email).toLowerCase()
    return text.includes(search.toLowerCase())&&(status==='todos'||customer.status===status)
  }),[rows,search,status])

  return <div>
    <div className="mb-6">
      <h1 className="text-2xl font-bold text-white">Clientes</h1>
      <p className="text-sm text-gray-500">{rows.length} cadastrados</p>
    </div>

    <div className="flex flex-wrap gap-3 mb-4">
      <input value={search} onChange={e=>setSearch(e.target.value)} placeholder="Buscar por nome ou e-mail..." className="w-full max-w-sm px-4 py-2.5 rounded-xl bg-white/5 border border-white/10"/>
      <select value={status} onChange={e=>setStatus(e.target.value)} className="px-3 py-2.5 rounded-xl bg-black border border-white/10">
        <option value="todos">Todos os status</option>
        <option value="active">Ativos</option>
        <option value="inactive">Inativos</option>
        <option value="blocked">Bloqueados</option>
      </select>
    </div>

    {loading?<p>Carregando...</p>:<div className="space-y-2">{filtered.map(customer=><Link key={customer.id} to={'/admin/clientes/'+customer.id} className="flex justify-between items-center gap-4 p-4 rounded-2xl bg-[#141416] border border-white/10">
      <div>
        <p className="font-semibold">{customer.first_name} {customer.last_name}</p>
        <p className="text-xs text-gray-500">{customer.email}</p>
        <p className="text-xs text-gray-600">{customer.phone||'Sem telefone'}</p>
        {customer.status_reason_code&&<p className="text-xs text-yellow-300/80 mt-1">{rotulo(motivoStatusCliente,customer.status_reason_code)}</p>}
      </div>
      <Badge variant={customer.status==='active'?'success':'default'}>{rotulo(statusCliente,customer.status)}</Badge>
    </Link>)}</div>}
  </div>
}
