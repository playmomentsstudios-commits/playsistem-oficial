import { useEffect,useState } from 'react'
import { Link,useParams } from 'react-router-dom'
import { portalApi } from '../../api/portal'
import { OrderStatusBadge } from '../../components/ui/Badge'
import { rotulo,statusPagamento } from '../../lib/labels.ptBR'
import { useAuth } from '../../contexts/AuthContext'
import { useToast } from '../../contexts/ToastContext'

const money=(v:number)=>new Intl.NumberFormat('pt-BR',{style:'currency',currency:'BRL'}).format(v/100)

export function OrderDetailPage(){
  const {id=''}=useParams()
  const {user}=useAuth()
  const toast=useToast()
  const [row,setRow]=useState<any>(null)
  const [loyalty,setLoyalty]=useState<any>(null)
  const [loading,setLoading]=useState(true)
  const [error,setError]=useState('')
  const [applying,setApplying]=useState(false)

  const load=async()=>{
    if(!user)return
    try{
      const [order,loyaltyRow]=await Promise.all([portalApi.order(id),portalApi.customerLoyalty(user.id)])
      setRow(order)
      setLoyalty(loyaltyRow)
    }catch(e:any){setError(e.message)}
    finally{setLoading(false)}
  }

  useEffect(()=>{void load()},[id,user?.id])

  const availableCash=Math.max(0,(loyalty?.unlocked_cash||0)-(loyalty?.used_cash||0))
  const canUsePlayCash=row&&row.payment_status!=='paid'&&row.play_cash_discount===0&&availableCash>0

  async function usePlayCash(){
    if(!row)return
    setApplying(true)
    try{
      const used=await portalApi.applyPlayCash(row.id,null)
      toast('Play Cash aplicado: '+money(used)+'.','success')
      await load()
    }catch(e:any){toast(e.message,'error')}
    finally{setApplying(false)}
  }

  if(loading)return <p className="text-gray-400">Carregando pedido...</p>
  if(error||!row)return <div><p className="text-red-300">{error||'Pedido não encontrado.'}</p><Link to="/app/pedidos" className="text-[#E30613]">Voltar</Link></div>

  return <div>
    <Link to="/app/pedidos" className="text-sm text-[#E30613]">← Pedidos</Link>
    <div className="flex flex-wrap justify-between gap-4 mt-4">
      <div><h1 className="text-2xl font-bold">{row.order_number}</h1><p className="text-sm text-gray-500">{new Date(row.created_at).toLocaleString('pt-BR')}</p></div>
      <OrderStatusBadge status={row.status}/>
    </div>

    <div className="grid lg:grid-cols-[1fr_320px] gap-5 mt-6">
      <div className="p-5 rounded-2xl bg-[#141416] border border-white/10">
        <h2 className="font-bold mb-4">Itens</h2>
        {row.items?.map((item:any)=><div key={item.id} className="flex justify-between gap-4 py-3 border-b border-white/5"><div><p>{item.name_snapshot}</p><p className="text-xs text-gray-500">{item.quantity} × {money(item.unit_price)}</p></div><b>{money(item.total_price)}</b></div>)}
      </div>

      <aside className="space-y-4">
        <div className="p-5 rounded-2xl bg-[#141416] border border-white/10">
          <div className="flex justify-between text-sm"><span>Subtotal</span><span>{money(row.subtotal)}</span></div>
          {row.play_cash_discount>0&&<div className="flex justify-between text-sm text-green-400 mt-2"><span>Play Cash</span><span>- {money(row.play_cash_discount)}</span></div>}
          <div className="flex justify-between mt-3 pt-3 border-t border-white/10"><span>Total</span><b>{money(row.total)}</b></div>
          <p className="text-sm text-gray-500 mt-2">Pagamento: {rotulo(statusPagamento,row.payment_status)}</p>

          {canUsePlayCash&&<div className="mt-4 p-3 rounded-xl bg-white/5">
            <p className="text-xs text-gray-500">Play Cash disponível</p>
            <p className="font-bold text-[#E30613] mt-1">{money(availableCash)}</p>
            <button disabled={applying} onClick={usePlayCash} className="mt-3 w-full px-3 py-2 rounded-lg bg-[#E30613] text-sm disabled:opacity-50">{applying?'Aplicando...':'Usar Play Cash neste pedido'}</button>
          </div>}

          {row.payment_status!=='paid'&&<Link to="/app/pagamentos" className="inline-block mt-4 text-[#E30613]">Efetuar pagamento →</Link>}
        </div>

        {row.projects?.[0]&&<div className="p-5 rounded-2xl bg-[#141416] border border-white/10"><p className="text-xs text-gray-500">Projeto relacionado</p><Link to={'/app/projetos/'+row.projects[0].id} className="font-semibold">{row.projects[0].title}</Link></div>}
        <Link to="/app/conversas" className="block p-4 text-center rounded-xl bg-white/5">Falar sobre este pedido</Link>
      </aside>
    </div>
  </div>
}
