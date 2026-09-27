import { useEffect,useMemo,useState } from 'react'
import { portalApi } from '../../api/portal'
import { supabase } from '../../lib/supabase'
import { useToast } from '../../contexts/ToastContext'
import { metodoPagamento,rotulo,statusPagamento } from '../../lib/labels.ptBR'

const money=(v:number)=>new Intl.NumberFormat('pt-BR',{style:'currency',currency:'BRL'}).format(v/100)

export function AdminPayments(){
  const toast=useToast()
  const [rows,setRows]=useState<any[]>([])
  const [loading,setLoading]=useState(true)
  const [statusFilter,setStatusFilter]=useState('todos')
  const [search,setSearch]=useState('')

  const load=async()=>{
    setRows(await portalApi.payments())
    setLoading(false)
  }

  useEffect(()=>{void load()},[])

  const filtered=useMemo(()=>rows.filter(payment=>{
    const customer=((payment.customer?.first_name||'')+' '+(payment.customer?.last_name||'')+' '+(payment.customer?.email||'')).toLowerCase()
    const order=(payment.order?.order_number||'').toLowerCase()
    const matchesSearch=!search.trim()||customer.includes(search.toLowerCase())||order.includes(search.toLowerCase())
    const matchesStatus=statusFilter==='todos'||payment.status===statusFilter
    return matchesSearch&&matchesStatus
  }),[rows,statusFilter,search])


  async function cancelPayment(payment:any){
    if(!window.confirm('Cancelar esta cobrança? Pagamentos Asaas pendentes também serão cancelados no provedor.'))return
    try{
      const {data,error}=await supabase.functions.invoke('asaas-admin-cancel',{body:{payment_id:payment.id}})
      if(error)throw error
      if(!data?.ok)throw new Error(data?.error||'Não foi possível cancelar a cobrança.')
      toast('Cobrança cancelada.','success')
      await load()
    }catch(e:any){toast(e.message||'Não foi possível cancelar a cobrança.','error')}
  }


  return <div>
    <div className="mb-6">
      <h1 className="text-2xl font-bold text-white">Pagamentos</h1>
      <p className="text-sm text-gray-500">Cobranças Asaas e confirmações automáticas</p>
    </div>


    <div className="flex flex-wrap gap-3 mb-5">
      <input value={search} onChange={e=>setSearch(e.target.value)} placeholder="Buscar cliente ou pedido..." className="px-4 py-2 rounded-xl bg-white/5 border border-white/10 min-w-64"/>
      <select value={statusFilter} onChange={e=>setStatusFilter(e.target.value)} className="px-3 py-2 rounded-xl bg-black border border-white/10">
        <option value="todos">Todos os status</option>
        <option value="pending">Aguardando pagamento</option>
        <option value="paid">Pagamento recebido</option>
        <option value="cancelled">Cancelado</option>
        <option value="refunded">Reembolsado</option>
      </select>
    </div>

    {loading?<p>Carregando...</p>:!filtered.length?<p className="text-gray-500">Nenhum pagamento encontrado.</p>:<div className="space-y-4">{filtered.map(payment=>{
      const customerName=[payment.customer?.first_name,payment.customer?.last_name].filter(Boolean).join(' ')||'Cliente'
      return <div key={payment.id} className="p-5 rounded-2xl bg-[#141416] border border-white/10">
        <div className="flex flex-wrap justify-between gap-4">
          <div>
            <b className="text-white">{payment.order?.order_number||'Pagamento'}</b>
            <p className="text-sm text-gray-300 mt-1">{customerName}</p>
            <p className="text-xs text-gray-500">{payment.customer?.email||'Sem e-mail'}</p>
            <p className="text-sm text-gray-400 mt-2">{money(payment.amount)} · {rotulo(metodoPagamento,payment.method)}</p>
          </div>
          <div className="text-right">
            <span className="inline-flex px-3 py-1 rounded-full bg-white/5 text-sm">{rotulo(statusPagamento,payment.status)}</span>
            <p className="text-xs text-gray-600 mt-2">{new Date(payment.created_at).toLocaleString('pt-BR')}</p>
            {!['paid','refunded','cancelled'].includes(payment.status)&&<button onClick={()=>cancelPayment(payment)} className="mt-3 px-3 py-2 rounded-lg bg-red-950 text-red-300 text-xs">Cancelar cobrança</button>}
          </div>
        </div>

        {payment.provider==='manual'&&<p className="mt-4 text-sm text-gray-500">Pagamento manual legado — mantido somente para histórico.</p>}
      </div>
    })}</div>}
  </div>
}
