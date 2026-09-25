import { useEffect,useMemo,useState } from 'react'
import { portalApi } from '../../api/portal'
import { useToast } from '../../contexts/ToastContext'
import { metodoPagamento,rotulo,statusComprovante,statusPagamento } from '../../lib/labels.ptBR'

const money=(v:number)=>new Intl.NumberFormat('pt-BR',{style:'currency',currency:'BRL'}).format(v/100)

export function AdminPayments(){
  const toast=useToast()
  const [rows,setRows]=useState<any[]>([])
  const [settings,setSettings]=useState<any>(null)
  const [loading,setLoading]=useState(true)
  const [statusFilter,setStatusFilter]=useState('todos')
  const [search,setSearch]=useState('')

  const load=async()=>{
    const [payments,config]=await Promise.all([portalApi.payments(),portalApi.paymentSettings()])
    setRows(payments)
    setSettings(config)
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

  async function review(id:string,status:'approved'|'rejected'){
    try{
      const note=status==='rejected'?window.prompt('Informe o motivo da rejeição:')||'':''
      await portalApi.reviewReceipt(id,status,note)
      toast(status==='approved'?'Pagamento confirmado.':'Comprovante rejeitado.','success')
      await load()
    }catch(e:any){
      toast(e.message,'error')
    }
  }

  async function openReceipt(path:string){
    try{
      window.open(await portalApi.paymentReceiptUrl(path),'_blank','noopener')
    }catch(e:any){
      toast(e.message,'error')
    }
  }

  async function saveSettings(){
    if(!settings)return
    try{
      await portalApi.savePaymentSettings({
        pix_key_type:settings.pix_key_type,
        pix_key:settings.pix_key,
        beneficiary_name:settings.beneficiary_name,
        bank_name:settings.bank_name,
        instructions:settings.instructions,
      })
      toast('Dados do PIX salvos.','success')
    }catch(e:any){
      toast(e.message,'error')
    }
  }

  return <div>
    <div className="mb-6">
      <h1 className="text-2xl font-bold text-white">Pagamentos</h1>
      <p className="text-sm text-gray-500">PIX, comprovantes e confirmações de clientes</p>
    </div>

    {settings&&<div className="p-5 mb-6 rounded-2xl bg-[#141416] border border-white/10">
      <h2 className="font-bold mb-4">Configuração do PIX</h2>
      <div className="grid md:grid-cols-2 gap-3">
        <input value={settings.pix_key_type||''} onChange={e=>setSettings({...settings,pix_key_type:e.target.value})} placeholder="Tipo da chave PIX" className="px-3 py-2 rounded-lg bg-white/5 border border-white/10"/>
        <input value={settings.pix_key||''} onChange={e=>setSettings({...settings,pix_key:e.target.value})} placeholder="Chave PIX" className="px-3 py-2 rounded-lg bg-white/5 border border-white/10"/>
        <input value={settings.beneficiary_name||''} onChange={e=>setSettings({...settings,beneficiary_name:e.target.value})} placeholder="Nome do beneficiário" className="px-3 py-2 rounded-lg bg-white/5 border border-white/10"/>
        <input value={settings.bank_name||''} onChange={e=>setSettings({...settings,bank_name:e.target.value})} placeholder="Banco" className="px-3 py-2 rounded-lg bg-white/5 border border-white/10"/>
      </div>
      <textarea value={settings.instructions||''} onChange={e=>setSettings({...settings,instructions:e.target.value})} placeholder="Instruções para o cliente" className="mt-3 w-full px-3 py-2 rounded-lg bg-white/5 border border-white/10"/>
      <button onClick={saveSettings} className="mt-3 px-4 py-2 rounded-lg bg-[#E30613]">Salvar configuração</button>
    </div>}

    <div className="flex flex-wrap gap-3 mb-5">
      <input value={search} onChange={e=>setSearch(e.target.value)} placeholder="Buscar cliente ou pedido..." className="px-4 py-2 rounded-xl bg-white/5 border border-white/10 min-w-64"/>
      <select value={statusFilter} onChange={e=>setStatusFilter(e.target.value)} className="px-3 py-2 rounded-xl bg-black border border-white/10">
        <option value="todos">Todos os status</option>
        <option value="pending">Aguardando pagamento</option>
        <option value="awaiting_confirmation">Comprovante aguardando análise</option>
        <option value="paid">Pagamento recebido</option>
        <option value="rejected">Comprovante recusado</option>
        <option value="cancelled">Cancelado</option>
        <option value="refunded">Reembolsado</option>
      </select>
    </div>

    {loading?<p>Carregando...</p>:!filtered.length?<p className="text-gray-500">Nenhum pagamento encontrado.</p>:<div className="space-y-4">{filtered.map(payment=>{
      const customerName=[payment.customer?.first_name,payment.customer?.last_name].filter(Boolean).join(' ')||'Cliente'
      const receipts=payment.receipt||[]
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
          </div>
        </div>

        {receipts.length>0?<div className="mt-4 space-y-2">{receipts.map((receipt:any)=><div key={receipt.id} className="p-3 rounded-xl bg-white/5 flex flex-wrap justify-between items-center gap-3">
          <div>
            <p className="text-sm font-medium">{receipt.file_name}</p>
            <p className="text-xs text-gray-500">{rotulo(statusComprovante,receipt.status)} · enviado em {new Date(receipt.uploaded_at).toLocaleString('pt-BR')}</p>
            {receipt.admin_note&&<p className="text-xs text-amber-300 mt-1">Observação: {receipt.admin_note}</p>}
          </div>
          <div className="flex flex-wrap gap-2">
            <button onClick={()=>openReceipt(receipt.storage_path)} className="px-3 py-2 rounded-lg bg-white/5 text-sm">Abrir comprovante</button>
            {receipt.status==='pending'&&<>
              <button onClick={()=>review(receipt.id,'approved')} className="px-3 py-2 rounded-lg bg-emerald-950 text-emerald-300 text-sm">Confirmar recebimento</button>
              <button onClick={()=>review(receipt.id,'rejected')} className="px-3 py-2 rounded-lg bg-red-950 text-red-300 text-sm">Rejeitar</button>
            </>}
          </div>
        </div>)}</div>:<p className="mt-4 text-sm text-gray-500">Nenhum comprovante enviado.</p>}
      </div>
    })}</div>}
  </div>
}
