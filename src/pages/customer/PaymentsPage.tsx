import { useEffect,useState } from 'react'
import { portalApi } from '../../api/portal'
import { useAuth } from '../../contexts/AuthContext'
import { useToast } from '../../contexts/ToastContext'
import { EmptyState } from '../../components/ui/EmptyState'
import { metodoPagamento,rotulo,statusComprovante,statusPagamento } from '../../lib/labels.ptBR'

const money=(v:number)=>new Intl.NumberFormat('pt-BR',{style:'currency',currency:'BRL'}).format(v/100)

export function PaymentsPage(){
  const {user}=useAuth()
  const toast=useToast()
  const [rows,setRows]=useState<any[]>([])
  const [settings,setSettings]=useState<any>(null)
  const [loading,setLoading]=useState(true)
  const [uploading,setUploading]=useState<string|null>(null)

  const load=async()=>{
    const [payments,config]=await Promise.all([portalApi.payments(),portalApi.paymentSettings()])
    setRows(payments)
    setSettings(config)
    setLoading(false)
  }

  useEffect(()=>{void load()},[])

  async function upload(payment:any,file:File){
    if(!user)return
    try{
      setUploading(payment.id)
      await portalApi.uploadReceipt(payment.id,user.id,file)
      toast('Comprovante anexado e enviado para análise.','success')
      await load()
    }catch(e:any){
      toast(e.message,'error')
    }finally{
      setUploading(null)
    }
  }

  async function openReceipt(path:string){
    try{
      window.open(await portalApi.paymentReceiptUrl(path),'_blank','noopener')
    }catch(e:any){
      toast(e.message,'error')
    }
  }

  return <div>
    <div className="mb-6">
      <h1 className="text-2xl font-bold text-white">Pagamentos</h1>
      <p className="text-sm text-gray-500">Acompanhe valores, comprovantes e confirmações</p>
    </div>

    {loading
      ? <p className="text-gray-400">Carregando...</p>
      : !rows.length
        ? <EmptyState icon="💳" title="Nenhum pagamento registrado"/>
        : <div className="space-y-4">{rows.map(payment=>{
          const receipts=payment.receipt||[]
          const latest=receipts[0]
          const canUpload=!['paid','cancelled','refunded'].includes(payment.status)
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

            <div className="mt-4 p-4 rounded-xl bg-white/[0.04] border border-white/5">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div>
                  <p className="text-xs uppercase tracking-wide text-gray-500">Comprovante</p>
                  <p className="text-sm font-semibold mt-1">
                    {latest ? rotulo(statusComprovante,latest.status) : 'Nenhum comprovante anexado'}
                  </p>
                  {latest && <p className="text-xs text-gray-500 mt-1">{latest.file_name} · enviado em {new Date(latest.uploaded_at).toLocaleString('pt-BR')}</p>}
                  {latest?.admin_note && <p className="text-xs text-amber-300 mt-2">Observação: {latest.admin_note}</p>}
                </div>
                {latest?.storage_path && <button onClick={()=>openReceipt(latest.storage_path)} className="px-3 py-2 rounded-lg bg-white/5 text-sm">Ver comprovante</button>}
              </div>
            </div>

            {payment.status==='paid'
              ? <p className="mt-4 text-emerald-400">✓ Pagamento recebido e confirmado</p>
              : canUpload&&settings&&<div className="mt-4 p-4 rounded-xl bg-white/5 text-sm space-y-2">
                <p><b>Beneficiário:</b> {settings.beneficiary_name||'Não configurado'}</p>
                <p><b>Banco:</b> {settings.bank_name||'Não configurado'}</p>
                <p className="break-all"><b>Chave PIX:</b> {settings.pix_key||'Não configurada'}</p>
                {settings.pix_key&&<button onClick={()=>navigator.clipboard.writeText(settings.pix_key)} className="text-[#E30613]">Copiar chave PIX</button>}
                {settings.instructions&&<p className="text-gray-400">{settings.instructions}</p>}
                <label className="inline-block px-3 py-2 rounded-lg bg-[#E30613] text-white cursor-pointer">
                  {uploading===payment.id?'Enviando...':latest?'Enviar novo comprovante':'Enviar comprovante'}
                  <input type="file" accept="image/*,application/pdf" className="hidden" disabled={uploading===payment.id} onChange={e=>e.target.files?.[0]&&upload(payment,e.target.files[0])}/>
                </label>
              </div>}
          </div>
        })}</div>}
  </div>
}
