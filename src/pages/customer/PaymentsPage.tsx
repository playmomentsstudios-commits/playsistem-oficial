import { useEffect,useState } from 'react'
import { portalApi } from '../../api/portal'
import { useAuth } from '../../contexts/AuthContext'
import { useToast } from '../../contexts/ToastContext'
import { EmptyState } from '../../components/ui/EmptyState'
const money=(v:number)=>new Intl.NumberFormat('pt-BR',{style:'currency',currency:'BRL'}).format(v/100)
export function PaymentsPage(){
 const {user}=useAuth(),toast=useToast(); const [rows,setRows]=useState<any[]>([]),[settings,setSettings]=useState<any>(null),[loading,setLoading]=useState(true)
 const load=async()=>{const [p,s]=await Promise.all([portalApi.payments(),portalApi.paymentSettings()]);setRows(p);setSettings(s);setLoading(false)}
 useEffect(()=>{void load()},[])
 async function upload(payment:any,file:File){if(!user)return;try{await portalApi.uploadReceipt(payment.id,user.id,file);toast('Comprovante enviado para análise.','success');await load()}catch(e:any){toast(e.message,'error')}}
 return <div><div className="mb-6"><h1 className="text-2xl font-bold text-white">Pagamentos</h1><p className="text-sm text-gray-500">Pague por PIX e acompanhe a confirmação</p></div>
 {loading?<p className="text-gray-400">Carregando...</p>:!rows.length?<EmptyState icon="💳" title="Nenhum pagamento pendente"/>:<div className="space-y-4">{rows.map(p=><div key={p.id} className="p-5 rounded-2xl bg-[#141416] border border-white/10"><div className="flex flex-wrap justify-between gap-3"><div><p className="font-semibold text-white">{p.order?.order_number||'Pagamento Play Moments'}</p><p className="text-sm text-gray-400">{money(p.amount)}</p></div><span className="text-sm px-3 py-1 rounded-full bg-white/5">{p.status}</span></div>
 {p.status!=='paid'&&settings&&<div className="mt-4 p-4 rounded-xl bg-white/5 text-sm space-y-2"><p><b>Beneficiário:</b> {settings.beneficiary_name||'Não configurado'}</p><p><b>Banco:</b> {settings.bank_name||'Não configurado'}</p><p className="break-all"><b>Chave PIX:</b> {settings.pix_key||'Não configurada'}</p>{settings.pix_key&&<button onClick={()=>navigator.clipboard.writeText(settings.pix_key)} className="text-[#E30613]">Copiar chave PIX</button>}<p className="text-gray-400">{settings.instructions}</p>
 <label className="inline-block px-3 py-2 rounded-lg bg-[#E30613] text-white cursor-pointer">Enviar comprovante<input type="file" accept="image/*,application/pdf" className="hidden" onChange={e=>e.target.files?.[0]&&upload(p,e.target.files[0])}/></label></div>}
 {p.status==='paid'&&<p className="mt-3 text-emerald-400">✓ Pagamento recebido</p>}</div>)}</div>}</div>
}