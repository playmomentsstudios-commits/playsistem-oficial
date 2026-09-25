import { useEffect,useState } from 'react'
import { portalApi } from '../../api/portal'
const money=(v:number)=>new Intl.NumberFormat('pt-BR',{style:'currency',currency:'BRL'}).format(v/100)
export function AdminQuotes(){const [rows,setRows]=useState<any[]>([]);useEffect(()=>{portalApi.quotes().then(setRows)},[]);return <div><h1 className="text-2xl font-bold text-white mb-2">Orçamentos</h1><p className="text-sm text-gray-500 mb-6">Solicitações e propostas</p><div className="space-y-2">{rows.map(q=><div key={q.id} className="p-4 rounded-2xl bg-[#141416] border border-white/10 flex justify-between gap-4"><div><b className="text-[#E30613]">{q.quote_number}</b><p>{q.title}</p></div><div><b>{money(q.total)}</b><p className="text-xs text-gray-500">{q.status}</p></div></div>)}</div></div>}
