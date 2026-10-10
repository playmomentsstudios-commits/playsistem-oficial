import { useEffect,useState } from 'react'
import { Link,useParams } from 'react-router-dom'
import { portalApi } from '../../api/portal'
import { useToast } from '../../contexts/ToastContext'
import { Button } from '../../components/ui/Button'
import { CompactPageHeader } from '../../components/ui/CompactWorkspace'
import { rotulo,statusOrcamento } from '../../lib/labels.ptBR'
const money=(v:number)=>new Intl.NumberFormat('pt-BR',{style:'currency',currency:'BRL'}).format(v/100)
export function QuoteDetailPage(){
 const {id=''}=useParams();const toast=useToast();const [q,setQ]=useState<any>(null),[loading,setLoading]=useState(true),[busy,setBusy]=useState(false),[error,setError]=useState('')
 const load=()=>{setError('');return portalApi.quote(id).then(setQ).catch((e:any)=>setError(e.message||'Não foi possível carregar o orçamento.')).finally(()=>setLoading(false))};useEffect(()=>{void load()},[id])
 async function decide(status:'accepted'|'rejected'){try{setBusy(true);await portalApi.decideQuote(id,status);toast(status==='accepted'?'Orçamento aceito.':'Orçamento recusado.','success');await load()}catch(e:any){toast(e.message,'error')}finally{setBusy(false)}}
 if(loading)return <p>Carregando...</p>
 if(error)return <div><p className="text-red-300">{error}</p><Link to="/app/orcamentos" className="text-[#A65A2A]">Voltar</Link></div>
 if(!q)return <div>Orçamento não encontrado. <Link to="/app/orcamentos" className="text-[#A65A2A]">Voltar</Link></div>
 return <div><CompactPageHeader title={q.title} eyebrow={q.quote_number} backTo="/app/orcamentos" backLabel="Orçamentos" />{q.description&&<p className="mb-2 whitespace-pre-wrap text-xs leading-5 text-gray-400">{q.description}</p>}<div className="mt-3 grid gap-3 lg:grid-cols-[1fr_300px]"><div className="pm-compact-card"><h2 className="font-bold mb-3">Itens do orçamento</h2>{q.items?.length?q.items.map((i:any)=><div key={i.id} className="flex justify-between gap-4 py-3 border-b border-white/5"><div><p>{i.description}</p><p className="text-xs text-gray-500">{i.quantity} × {money(i.unit_price)}</p></div><b>{money(i.total_price)}</b></div>):<p className="text-sm text-gray-500">Sem itens detalhados.</p>}</div><aside className="pm-compact-card h-fit"><p className="text-sm text-gray-500">Status</p><p className="font-semibold">{rotulo(statusOrcamento,q.status)}</p><div className="flex justify-between mt-4 pt-4 border-t border-white/10"><span>Total</span><b>{money(q.total)}</b></div>{q.valid_until&&<p className="text-xs text-gray-500 mt-2">Válido até {new Date(q.valid_until+'T12:00').toLocaleDateString('pt-BR')}</p>}{['sent','viewed'].includes(q.status)&&<div className="grid grid-cols-2 gap-2 mt-5"><Button disabled={busy} onClick={()=>decide('accepted')}>Aceitar</Button><Button variant="danger" disabled={busy} onClick={()=>decide('rejected')}>Recusar</Button></div>}</aside></div></div>
}