import { useEffect,useState } from 'react'
import { Link } from 'react-router-dom'
import { portalApi } from '../../api/portal'
import { OrderStatusBadge } from '../../components/ui/Badge'
import { EmptyState } from '../../components/ui/EmptyState'
import { LoadingState,ErrorState } from '../../components/ui/AsyncState'
const money=(v:number)=>new Intl.NumberFormat('pt-BR',{style:'currency',currency:'BRL'}).format(v/100)
export function OrdersPage(){
 const [rows,setRows]=useState<any[]>([]),[loading,setLoading]=useState(true),[error,setError]=useState('')
 useEffect(()=>{portalApi.orders().then(setRows).catch(e=>setError(e.message)).finally(()=>setLoading(false))},[])
 return <div><div className="mb-6"><h1 className="text-2xl font-bold text-white">Meus Pedidos</h1><p className="text-sm text-gray-500">Acompanhe seus pedidos reais</p></div>
 {loading?<LoadingState />:error?<ErrorState message={error} action={<button onClick={()=>window.location.reload()} className="min-h-11 px-4 rounded-xl bg-white/5">Tentar novamente</button>}/>:!rows.length?<EmptyState icon="📦" title="Nenhum pedido ainda" description="Quando você contratar um produto ou serviço, ele aparecerá aqui."/>:
 <div className="space-y-3">{rows.map(o=><Link key={o.id} to={'/app/pedidos/'+o.id} className="block p-5 rounded-2xl bg-[#141416] border border-white/10">
  <div className="flex flex-wrap gap-4 justify-between items-center"><div><p className="font-bold text-[#A65A2A]">{o.order_number}</p><p className="text-sm text-white">{o.items?.[0]?.name_snapshot||'Pedido Sagamente'}</p><p className="text-xs text-gray-500">{new Date(o.created_at).toLocaleString('pt-BR')}</p></div>
  <div className="flex items-center gap-4"><OrderStatusBadge status={o.status}/><b className="text-white">{money(o.total)}</b></div></div></Link>)}</div>}</div>
}