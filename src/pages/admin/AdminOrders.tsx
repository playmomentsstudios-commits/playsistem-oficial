import { useEffect,useState } from 'react'
import { Link } from 'react-router-dom'
import { portalApi } from '../../api/portal'
import { settingsApi } from '../../api/settings'
import { OrderStatusBadge } from '../../components/ui/Badge'
import { useToast } from '../../contexts/ToastContext'
import { rotulo,statusPedido } from '../../lib/labels.ptBR'
const money=(v:number)=>new Intl.NumberFormat('pt-BR',{style:'currency',currency:'BRL'}).format(v/100)
const statusOptions=['pending','awaiting_payment','paid','processing','in_production','ready','completed','cancelled']
export function AdminOrders(){
 const [rows,setRows]=useState<any[]>([]),[filter,setFilter]=useState('all'),[loading,setLoading]=useState(true); const toast=useToast()
 const load=()=>portalApi.orders().then(setRows).finally(()=>setLoading(false)); useEffect(()=>{void settingsApi.appSettings().then(s=>{if(s)setFilter(s.orders_default_filter)}).catch(()=>{}).finally(()=>{void load()})},[])
 const filtered=filter==='all'?rows:rows.filter(o=>o.status===filter)
 async function setStatus(id:string,status:string){try{await portalApi.updateOrder(id,status);toast('Pedido atualizado.','success');await load()}catch(e:any){toast(e.message,'error')}}
 const counts={waiting:rows.filter(o=>['pending','awaiting_payment'].includes(o.status)).length,paid:rows.filter(o=>o.status==='paid').length,production:rows.filter(o=>['processing','in_production','ready'].includes(o.status)).length,completed:rows.filter(o=>o.status==='completed').length}
 return <div><div className="mb-6"><p className="text-[11px] uppercase tracking-[.18em] text-[#E30613] font-semibold">Comercial</p><h1 className="text-2xl font-bold text-white mt-1">Pedidos</h1><p className="text-sm text-gray-500 mt-1">Do pagamento à produção e conclusão.</p></div>
 <div className="grid grid-cols-2 xl:grid-cols-4 gap-3 mb-5">{[['Aguardando',counts.waiting,'text-amber-300'],['Pagos',counts.paid,'text-emerald-300'],['Em produção',counts.production,'text-blue-300'],['Concluídos',counts.completed,'text-emerald-300']].map(([l,v,t])=><div key={String(l)} className="p-4 rounded-2xl bg-[#141416] border border-white/10"><p className="text-[10px] uppercase tracking-[.12em] text-gray-500">{l}</p><p className={'text-xl font-bold mt-2 '+t}>{v}</p></div>)}</div>
 <div className="flex gap-2 flex-wrap mb-4"><button onClick={()=>setFilter('all')} className={'px-3 py-2 rounded-xl text-xs border '+(filter==='all'?'bg-[#E30613]/15 text-red-200 border-[#E30613]/30':'bg-white/[0.03] border-white/10 text-gray-400')}>Todos</button>{['awaiting_payment','paid','in_production','completed','cancelled'].map(v=><button key={v} onClick={()=>setFilter(v)} className={'px-3 py-2 rounded-xl text-xs border '+(filter===v?'bg-[#E30613]/15 text-red-200 border-[#E30613]/30':'bg-white/[0.03] border-white/10 text-gray-400')}>{rotulo(statusPedido,v)}</button>)}</div>
 {loading?<p>Carregando...</p>:<div className="space-y-2">{filtered.map(o=><div key={o.id} className="p-4 rounded-2xl bg-[#141416] border border-white/10 flex flex-wrap justify-between gap-4 hover:border-white/20 transition-colors"><div><Link to={'/admin/pedidos/'+o.id} className="text-[#E30613] font-bold">{o.order_number}</Link><p className="text-sm">{o.items?.[0]?.name_snapshot||'Pedido'}</p><p className="text-xs text-gray-500">{new Date(o.created_at).toLocaleString('pt-BR')}</p></div><div className="flex items-center gap-3"><OrderStatusBadge status={o.status}/><b>{money(o.total)}</b><select value={o.status} onChange={e=>setStatus(o.id,e.target.value)} className="bg-black border border-white/10 rounded px-2 py-1 text-sm">{statusOptions.map(s=><option key={s} value={s}>{rotulo(statusPedido,s)}</option>)}</select></div></div>)}</div>}</div>
}