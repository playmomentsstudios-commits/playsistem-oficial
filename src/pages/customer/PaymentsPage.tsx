import { useEffect,useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import { useCart } from '../../contexts/CartContext'
import { portalApi } from '../../api/portal'
import { useToast } from '../../contexts/ToastContext'
import { EmptyState } from '../../components/ui/EmptyState'
import { LoadingState,ErrorState } from '../../components/ui/AsyncState'
import { metodoPagamento,rotulo,statusPagamento } from '../../lib/labels.ptBR'
import { CompactPageHeader,CompactDisclosure } from '../../components/ui/CompactWorkspace'

const money=(v:number)=>new Intl.NumberFormat('pt-BR',{style:'currency',currency:'BRL'}).format(v/100)

export function PaymentsPage(){
  const toast=useToast()
  const {clearCart}=useCart()
  const [searchParams,setSearchParams]=useSearchParams()
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
  useEffect(()=>{
    if(searchParams.get('checkout')!=='success')return
    clearCart()
    toast('Pagamento enviado. A confirmação final será atualizada pelo Asaas.','success')
    setSearchParams({}, {replace:true})
  },[searchParams,clearCart,setSearchParams,toast])


  return <div>
    <CompactPageHeader title="Pagamentos" description="Cobranças, comprovantes e confirmações." />

    <CompactDisclosure title="Carteira e cartões" summary="Gerenciar formas de pagamento" className="mb-3">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="max-w-xl text-xs text-gray-400">Os cartões poderão ser utilizados após a ativação da tokenização segura pelo provedor.</p>
        <button type="button" onClick={()=>toast('O cadastro seguro de cartão será liberado assim que a tokenização do provedor estiver ativa.','info')} className="pm-compact-tap rounded-lg border border-white/10 bg-white/[.05] px-3 text-xs font-semibold">+ Adicionar cartão</button>
      </div>
      <p className="mt-3 text-[11px] text-gray-500">🔒 A Sagamente não armazena números completos de cartão nem códigos de segurança.</p>
    </CompactDisclosure>

    {loading
      ? <LoadingState />
      : error
        ? <ErrorState message={error} action={<button onClick={()=>{setLoading(true);void load()}} className="min-h-11 px-4 rounded-xl bg-white/5">Tentar novamente</button>}/>
      : !rows.length
        ? <EmptyState icon="💳" title="Nenhum pagamento registrado"/>
        : <div className="space-y-2">{rows.map(payment=>{
          const manualPix=payment.provider==='manual'&&payment.method==='pix_manual'
          const asaasPix=payment.provider==='asaas'&&payment.method==='pix_gateway'?payment.provider_payload?.pixQrCode:null
          const hostedCard=payment.provider==='asaas_checkout'&&payment.method==='card'&&payment.status==='pending'?payment.provider_payload?.checkoutLink:null
          return <div key={payment.id} className="pm-compact-card">
            <div className="flex flex-wrap justify-between gap-2">
              <div>
                <p className="font-semibold text-white">{payment.order?.order_number||'Pagamento Sagamente'}</p>
                <p className="text-sm text-gray-400">{money(payment.amount)} · {rotulo(metodoPagamento,payment.method)}</p>
                <p className="text-xs text-gray-600 mt-1">{new Date(payment.created_at).toLocaleString('pt-BR')}</p>
              </div>
              <div className="text-right">
                <span className="inline-flex px-3 py-1 rounded-full bg-white/5 text-sm">{rotulo(statusPagamento,payment.status)}</span>
              </div>
            </div>

            {manualPix&&<p className="mt-2 text-xs text-gray-500">Pagamento PIX manual legado — mantido somente para histórico.</p>}

            {payment.status==='paid'
              ? <p className="mt-2 text-xs text-emerald-400">✓ Pagamento recebido e confirmado</p>
: hostedCard?<div className="mt-4 p-4 rounded-xl bg-white/5 text-sm space-y-3">
                <p className="font-semibold text-white">Cartão · checkout seguro Asaas</p>
                <p className="text-xs text-gray-400">Continue o pagamento no ambiente seguro do Asaas. Se a sessão tiver expirado, volte ao carrinho para gerar uma nova sessão.</p>
                <a href={hostedCard} className="inline-flex px-3 py-2 rounded-lg bg-[#A65A2A] text-white font-semibold">Continuar pagamento</a>
              </div>
              : asaasPix?.payload?<div className="mt-4 p-4 rounded-xl bg-white/5 text-sm space-y-3">
                <p className="font-semibold text-white">PIX Asaas</p>
                {asaasPix.encodedImage&&<img src={'data:image/png;base64,'+asaasPix.encodedImage} alt="QR Code PIX" className="w-48 h-48 bg-white rounded-xl p-2"/>}
                <p className="text-xs text-gray-400">Escaneie o QR Code ou copie o código PIX abaixo.</p>
                <div className="p-3 rounded-lg bg-black/30 break-all text-xs">{asaasPix.payload}</div>
                <button onClick={()=>navigator.clipboard.writeText(asaasPix.payload)} className="px-3 py-2 rounded-lg bg-[#A65A2A] text-white">Copiar PIX</button>
                {asaasPix.expirationDate&&<p className="text-xs text-gray-500">Expira em {new Date(asaasPix.expirationDate).toLocaleString('pt-BR')}</p>}
              </div>
              : null}
          </div>
        })}</div>}
  </div>
}
