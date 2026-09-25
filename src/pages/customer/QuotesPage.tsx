import { useEffect,useState } from 'react'
import { Link } from 'react-router-dom'
import { portalApi } from '../../api/portal'
import { Badge } from '../../components/ui/Badge'
import { EmptyState } from '../../components/ui/EmptyState'
import { useToast } from '../../contexts/ToastContext'
const money=(v:number)=>new Intl.NumberFormat('pt-BR',{style:'currency',currency:'BRL'}).format(v/100)
export function QuotesPage(){
 const [rows,setRows]=useState<any[]>([]),[loading,setLoading]=useState(true); const toast=useToast()
 const load=()=>portalApi.quotes().then(setRows).finally(()=>setLoading(false))
 useEffect(()=>{void load()},[])
 async function decide(id:string,status:'accepted'|'rejected'){try{await portalApi.decideQuote(id,status);toast(status==='accepted'?'Orçamento aceito.':'Orçamento recusado.','success');await load()}catch(e:any){toast(e.message,'error')}}
 return <div><div className="mb-6"><h1 className="text-2xl font-bold text-white">Orçamentos</h1><p className="text-sm text-gray-500">Revise e responda aos seus orçamentos</p></div>
 {loading?<p className="text-gray-400">Carregando...</p>:!rows.length?<EmptyState icon="📋" title="Nenhum orçamento"/>:<div className="space-y-3">{rows.map(q=><div key={q.id} className="p-5 rounded-2xl bg-[#141416] border border-white/10 flex flex-wrap justify-between gap-4">
 <div><Link to={'/app/orcamentos/'+q.id} className="font-bold text-[#E30613]">{q.quote_number}</Link><p className="text-white">{q.title}</p><p className="text-xs text-gray-500">{q.valid_until?'Válido até '+new Date(q.valid_until+'T12:00').toLocaleDateString('pt-BR'):'Sem prazo definido'}</p></div>
 <div className="flex items-center gap-3"><Badge variant={q.status==='accepted'?'success':q.status==='rejected'?'danger':'info'}>{q.status}</Badge><b>{money(q.total)}</b>{['sent','viewed'].includes(q.status)&&<><button onClick={()=>decide(q.id,'accepted')} className="px-3 py-2 rounded-lg bg-emerald-900 text-emerald-300">Aceitar</button><button onClick={()=>decide(q.id,'rejected')} className="px-3 py-2 rounded-lg bg-red-950 text-red-300">Recusar</button></>}</div></div>)}</div>}</div>
}