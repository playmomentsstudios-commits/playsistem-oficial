import { useEffect,useState } from 'react'
import { portalApi } from '../../api/portal'
import { useToast } from '../../contexts/ToastContext'
import { EmptyState } from '../../components/ui/EmptyState'
import { metodoPagamento,rotulo,statusPagamento } from '../../lib/labels.ptBR'

const money=(v:number)=>new Intl.NumberFormat('pt-BR',{style:'currency',currency:'BRL'}).format(v/100)

export function PaymentsPage(){
  const toast=useToast()
  const [rows,setRows]=useState<any[]>([])
  const [loading,setLoading]=useState(true)
  const [error,setError]=useState('')

  const load=async()=>{
    try{
      setError('')
      setRows(await portalApi.payments())
    }catch(e:any){
      setError(e.message||'Não foi possível carregar seus pagamentos.')
    }finally{
      setLoading(false)
    }
  }

  useEffect(()=>{void load()},[])


  return <div>
    <div className="mb-6">
      <h1 className="text-2xl font-bold text-white">Pagamentos</h1>
      <p className="text-sm text-gray-500">Acompanhe valores, confirmações e suas formas de pagamento</p>
    </div>

    <section className="mb-6 p-5 rounded-2xl bg-[#141416] border border-white/10">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <p className="text-[11px] uppercase tracking-[0.18em] text-[#E30613] font-semibold">Carteira</p>
          <h2 className="font-semibold text-white mt-1">Formas de pagamento</h2>
          <p className="text-xs text-gray-500 mt-1">Seus cartões poderão ser usados nas próximas compras sem preencher tudo novamente.</p>
        </div>
        <button type="button" onClick={()=>toast('O cadastro seguro de cartão será liberado assim que a tokenização do provedor estiver ativa.','info')} className="min-h-11 px-4 rounded-xl bg-white/[0.06] border border-white/10 text-sm font-semibold text-white">
          + Adicionar cartão
        </button>
      </div>
      <div className="mt-4 p-4 rounded-xl bg-black/20 border border-white/5 flex gap-3">
        <span aria-hidden="true">🔒</span>
        <div>
          <p className="text-sm text-white font-medium">Cartão protegido pelo provedor de pagamento</p>
          <p className="text-xs text-gray-500 mt-1">A Play Moments não armazenará número completo do cartão nem código de segurança. O cartão será salvo por tokenização.</p>
        </div>
      </div>
    </section>

    {loading
      ? <p className="text-gray-400">Carregando...</p>
      : error
        ? <div className="p-4 rounded-xl border border-red-500/20 bg-red-500/5"><p className="text-red-300">{error}</p><button onClick={()=>{setLoading(true);void load()}} className="text-sm text-[#E30613] mt-2">Tentar novamente</button></div>
      : !rows.length
        ? <EmptyState icon="💳" title="Nenhum pagamento registrado"/>
        : <div className="space-y-4">{rows.map(payment=>{
          const manualPix=payment.provider==='manual'&&payment.method==='pix_manual'
          const asaasPix=payment.provider==='asaas'&&payment.method==='pix_gateway'?payment.provider_payload?.pixQrCode:null
          return <div key={payment.id} className="p-5 rounded-2xl bg-[#141416] border border-white/10">
            <div className="flex flex-wrap justify-between gap-4">
              <div>
                <p className="font-semibold text-white">{payment.order?.order_number||'Pagamento Play Moments'}</p>
                <p className="text-sm text-gray-400">{money(payment.amount)} · {rotulo(metodoPagamento,payment.method)}</p>
                <p className="text-xs text-gray-600 mt-1">{new Date(payment.created_at).toLocaleString('pt-BR')}</p>
              </div>
              <div className="text-right">
                <span className="inline-flex px-3 py-1 rounded-full bg-white/5 text-sm">{rotulo(statusPagamento,payment.status)}</span>
              </div>
            </div>

            {manualPix&&<p className="mt-4 text-sm text-gray-500">Pagamento PIX manual legado — mantido somente para histórico.</p>}

            {payment.status==='paid'
              ? <p className="mt-4 text-emerald-400">✓ Pagamento recebido e confirmado</p>
              : asaasPix?.payload?<div className="mt-4 p-4 rounded-xl bg-white/5 text-sm space-y-3">
                <p className="font-semibold text-white">PIX Asaas</p>
                {asaasPix.encodedImage&&<img src={'data:image/png;base64,'+asaasPix.encodedImage} alt="QR Code PIX" className="w-48 h-48 bg-white rounded-xl p-2"/>}
                <p className="text-xs text-gray-400">Escaneie o QR Code ou copie o código PIX abaixo.</p>
                <div className="p-3 rounded-lg bg-black/30 break-all text-xs">{asaasPix.payload}</div>
                <button onClick={()=>navigator.clipboard.writeText(asaasPix.payload)} className="px-3 py-2 rounded-lg bg-[#E30613] text-white">Copiar PIX</button>
                {asaasPix.expirationDate&&<p className="text-xs text-gray-500">Expira em {new Date(asaasPix.expirationDate).toLocaleString('pt-BR')}</p>}
              </div>
              : null}
          </div>
        })}</div>}
  </div>
}
