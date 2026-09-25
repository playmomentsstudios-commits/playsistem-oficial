import { useEffect,useMemo,useState } from 'react'
import { Link } from 'react-router-dom'
import { portalApi } from '../../api/portal'
import { Badge } from '../../components/ui/Badge'
export function AdminCustomers(){
 const [rows,setRows]=useState<any[]>([]),[search,setSearch]=useState(''),[loading,setLoading]=useState(true)
 useEffect(()=>{portalApi.customers().then(setRows).finally(()=>setLoading(false))},[])
 const filtered=useMemo(()=>rows.filter(c=>((c.first_name||'')+' '+(c.last_name||'')+' '+c.email).toLowerCase().includes(search.toLowerCase())),[rows,search])
 return <div><div className="mb-6"><h1 className="text-2xl font-bold text-white">Clientes</h1><p className="text-sm text-gray-500">{rows.length} cadastrados</p></div>
 <input value={search} onChange={e=>setSearch(e.target.value)} placeholder="Buscar por nome ou e-mail..." className="mb-4 w-full max-w-sm px-4 py-2.5 rounded-xl bg-white/5 border border-white/10"/>
 {loading?<p>Carregando...</p>:<div className="space-y-2">{filtered.map(c=><Link key={c.id} to={'/admin/clientes/'+c.id} className="flex justify-between items-center gap-4 p-4 rounded-2xl bg-[#141416] border border-white/10"><div><p className="font-semibold">{c.first_name} {c.last_name}</p><p className="text-xs text-gray-500">{c.email}</p><p className="text-xs text-gray-600">{c.phone||'Sem telefone'}</p></div><Badge variant={c.status==='active'?'success':'default'}>{c.status}</Badge></Link>)}</div>}</div>
}