import { useEffect,useState } from 'react'
import { Link } from 'react-router-dom'
import { portalApi } from '../../api/portal'
import { OrderStatusBadge } from '../../components/ui/Badge'
import { useToast } from '../../contexts/ToastContext'
const money=(v:number)=>new Intl.NumberFormat('pt-BR',{style:'currency',currency:'BRL'}).format(v/100)
export function AdminOrders(){
 const [rows,setRows]=useState<any[]>([]),[filter,setFilter]=useState('all'),[loading,setLoading]=useState(true); const toast=useToast()
 const load=()=>portalApi.orders().then(setRows).finally(()=>setLoading(false)); useEffect(()=>{void load()},[])
 const filtered=filter==='all'?rows:rows.filter(o=>o.status===filter)
 async function setStatus(id:string,status:string){try{await portalApi.updateOrder(id,status);toast('Pedido atualizado.','success');await load()}catch(e:any){toast(e.message,'error')}}
 return <div><h1 className="text-2xl font-bold text-white mb-2">Pedidos</h1><p className="text-sm text-gray-500 mb-5">Pedidos reais da plataforma</p>
 <div className="flex gap-2 flex-wrap mb-4">{['all','awaiting_payment','paid','in_production','completed','cancelled'].map(v=><button key={v} onClick={()=>setFilter(v)} className={'px-3 py-1.5 rounded-full text-sm '+(filter===v?'bg-[#E30613]':'bg-white/5')}>{v}</button>)}</div>
 {loading?<p>Carregando...</p>:<div className="space-y-2">{filtered.map(o=><div key={o.id} className="p-4 rounded-2xl bg-[#141416] border border-white/10 flex flex-wrap justify-between gap-4"><div><Link to={'/admin/pedidos/'+o.id} className="text-[#E30613] font-bold">{o.order_number}</Link><p className="text-sm">{o.items?.[0]?.name_snapshot||'Pedido'}</p><p className="text-xs text-gray-500">{new Date(o.created_at).toLocaleString('pt-BR')}</p></div><div className="flex items-center gap-3"><OrderStatusBadge status={o.status}/><b>{money(o.total)}</b><select value={o.status} onChange={e=>setStatus(o.id,e.target.value)} className="bg-black border border-white/10 rounded px-2 py-1 text-sm"><option value="pending">pending</option><option value="awaiting_payment">awaiting_payment</option><option value="paid">paid</option><option value="processing">processing</option><option value="in_production">in_production</option><option value="ready">ready</option><option value="completed">completed</option><option value="cancelled">cancelled</option></select></div></div>)}</div>}</div>
}