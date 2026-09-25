import { useEffect,useState } from 'react'
import { Link,useNavigate } from 'react-router-dom'
import { PublicLayout } from '../../layouts/PublicLayout'
import { portalApi } from '../../api/portal'
import { useAuth } from '../../contexts/AuthContext'
import { useToast } from '../../contexts/ToastContext'
import { authLink } from '../../lib/navigation'
const money=(v:number)=>new Intl.NumberFormat('pt-BR',{style:'currency',currency:'BRL'}).format(v/100)
export function ServicesPage(){
 const {user}=useAuth(),toast=useToast(),navigate=useNavigate(); const [rows,setRows]=useState<any[]>([]),[loading,setLoading]=useState(true)
 useEffect(()=>{portalApi.services().then(setRows).finally(()=>setLoading(false))},[])
 async function hire(s:any){if(!user){navigate(authLink('/cadastro','/servicos'));return}try{const id=await portalApi.requestService(s.id);toast(s.price_type==='fixed'?'Pedido criado.':'Solicitação de orçamento enviada.','success');navigate(s.price_type==='fixed'?'/app/pedidos':'/app/orcamentos')}catch(e:any){toast(e.message,'error')}}
 return <PublicLayout><div className="mx-auto px-4 py-12" style={{maxWidth:1100}}><div className="text-center mb-10"><p className="text-xs uppercase tracking-widest text-[#E30613] mb-2">O que fazemos</p><h1 className="text-4xl font-bold">Nossos Serviços</h1><p className="text-sm text-gray-500 mt-3">Contrate serviços ou solicite orçamento diretamente pelo portal.</p></div>
 {loading?<p className="text-center text-gray-400">Carregando...</p>:<div className="grid md:grid-cols-2 lg:grid-cols-3 gap-5">{rows.map(s=><div key={s.id} className="p-5 rounded-2xl bg-[#141416] border border-white/10 flex flex-col"><p className="text-xs text-[#E30613]">{s.category||'Serviço'}</p><h2 className="font-bold text-lg mt-1">{s.name}</h2><p className="text-sm text-gray-400 mt-2 flex-1">{s.short_description||s.description}</p><div className="mt-5 pt-4 border-t border-white/10"><p className="font-semibold">{s.price_type==='quote'?'Consultar preço':(s.price_type==='starting_at'?'A partir de ':'')+money(s.price??s.starting_price??0)}</p><div className="flex gap-3 mt-3"><Link to={'/servicos/'+s.slug} className="text-sm text-gray-400">Detalhes</Link><button onClick={()=>hire(s)} className="ml-auto px-3 py-2 rounded-lg bg-[#E30613] text-sm">{s.price_type==='fixed'?'Contratar':'Solicitar orçamento'}</button></div></div></div>)}</div>}</div></PublicLayout>
}