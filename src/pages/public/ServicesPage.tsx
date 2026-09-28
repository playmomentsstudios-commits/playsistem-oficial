import { useEffect,useMemo,useState } from 'react'
import { Link,useNavigate } from 'react-router-dom'
import { PublicLayout } from '../../layouts/PublicLayout'
import { portalApi } from '../../api/portal'
import { useAuth } from '../../contexts/AuthContext'
import { useToast } from '../../contexts/ToastContext'
import { authLink,conversationLink } from '../../lib/navigation'

const money=(v:number)=>new Intl.NumberFormat('pt-BR',{style:'currency',currency:'BRL'}).format(v/100)

export function ServicesPage(){
 const {user,role}=useAuth(),toast=useToast(),navigate=useNavigate()
 const [rows,setRows]=useState<any[]>([]),[loading,setLoading]=useState(true),[category,setCategory]=useState('Todos')
 useEffect(()=>{portalApi.services().then(setRows).finally(()=>setLoading(false))},[])
 const categories=useMemo(()=>['Todos',...Array.from(new Set(rows.map(s=>s.category).filter(Boolean)))],[rows])
 const visible=category==='Todos'?rows:rows.filter(s=>s.category===category)
 async function hire(s:any){
   if(!user){navigate(authLink('/cadastro','/servicos/'+s.slug));return}
   try{
     await portalApi.requestService(s.id)
     toast(s.price_type==='fixed'?'Pedido criado.':'Solicitação de orçamento enviada.','success')
     navigate(s.price_type==='fixed'?'/app/pedidos':'/app/orcamentos')
   }catch(e:any){toast(e.message,'error')}
 }
 return <PublicLayout>
  <div className="mx-auto px-4 py-10 sm:py-14" style={{maxWidth:1100}}>
   <div className="max-w-2xl mb-8">
    <p className="text-xs uppercase tracking-widest text-[#E30613] mb-2">Serviços Play Moments</p>
    <h1 className="text-3xl sm:text-4xl font-bold">O que você precisa realizar?</h1>
    <p className="text-sm sm:text-base text-gray-400 mt-3">Escolha uma área, veja exatamente o que entregamos e contrate pela plataforma. Atendimento humano fica para projetos que realmente precisam de uma solução personalizada.</p>
   </div>

   {!loading&&categories.length>1&&<div className="flex gap-2 overflow-x-auto pb-3 mb-5" aria-label="Filtrar serviços por categoria">
    {categories.map(c=><button key={c} onClick={()=>setCategory(c)} className="shrink-0 px-4 py-2 rounded-full text-sm font-semibold transition-colors" style={{background:category===c?'#E30613':'#171719',color:category===c?'#fff':'#b0b0ba',border:'1px solid '+(category===c?'#E30613':'rgba(255,255,255,.08)')}}>{c}</button>)}
   </div>}

   {loading?<p className="text-center text-gray-400 py-16">Carregando serviços...</p>:visible.length===0?
    <div className="rounded-2xl border border-white/10 bg-[#141416] p-7 text-center"><h2 className="font-bold text-lg">Nenhum serviço nesta categoria ainda.</h2><p className="text-sm text-gray-400 mt-2">Você pode explorar outra área ou enviar um projeto personalizado.</p></div>:
    <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-5">{visible.map(s=>
     <article key={s.id} className="p-5 rounded-2xl bg-[#141416] border border-white/10 flex flex-col">
      <p className="text-xs font-semibold text-[#ff6b7a]">{s.category||'Serviço'}</p>
      <h2 className="font-bold text-lg mt-1">{s.name}</h2>
      <p className="text-sm text-gray-400 mt-2 flex-1">{s.short_description||s.description}</p>
      <div className="mt-5 pt-4 border-t border-white/10">
       <p className="text-xs text-gray-500 mb-1">{s.price_type==='quote'?'Projeto sob medida':'Contratação direta'}</p>
       <p className="font-semibold">{s.price_type==='quote'?'Orçamento personalizado':(s.price_type==='starting_at'?'A partir de ':'')+money(s.price??s.starting_price??0)}</p>
       <div className="flex items-center gap-3 mt-4">
        <Link to={'/servicos/'+s.slug} className="min-h-11 inline-flex items-center text-sm text-gray-300 underline underline-offset-4">Ver o que inclui</Link>
        <button onClick={()=>hire(s)} className="ml-auto min-h-11 px-4 py-2 rounded-xl bg-[#E30613] text-sm font-semibold">{s.price_type==='fixed'?'Contratar':'Pedir proposta'}</button>
       </div>
      </div>
     </article>)}</div>}

   <section className="mt-10 rounded-2xl border border-white/10 p-5 sm:p-6 flex flex-col sm:flex-row sm:items-center gap-4" style={{background:'linear-gradient(135deg,rgba(227,6,19,.09),rgba(255,255,255,.02))'}}>
    <div className="flex-1"><p className="font-bold">Seu projeto não cabe em uma opção pronta?</p><p className="text-sm text-gray-400 mt-1">Conte somente o essencial. A equipe recebe a necessidade já contextualizada.</p></div>
    <Link to={conversationLink(role,'orcamento')} className="min-h-11 inline-flex items-center justify-center px-5 py-3 rounded-xl border border-[#E30613] text-[#ff6b7a] font-semibold">Projeto personalizado</Link>
   </section>
  </div>
 </PublicLayout>
}