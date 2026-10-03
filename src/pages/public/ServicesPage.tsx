import { useEffect,useMemo,useState } from 'react'
import { Link,useNavigate } from 'react-router-dom'
import { PublicLayout } from '../../layouts/PublicLayout'
import { portalApi } from '../../api/portal'
import { useAuth } from '../../contexts/AuthContext'
import { useToast } from '../../contexts/ToastContext'
import { authLink,conversationLink } from '../../lib/navigation'
import {
  listPublicServiceOffers,
  serviceOfferMatchesArea,
  type PublicCatalogArea,
  type PublicServiceOffer,
} from '../../services/publicCatalog'

const money=(v:number)=>new Intl.NumberFormat('pt-BR',{style:'currency',currency:'BRL'}).format(v/100)

type ServicesPageProps={
  initialCategory?:string
  embedded?:boolean
  title?:string
  subtitle?:string
  area?:PublicCatalogArea
}

export function ServicesPage({
  initialCategory='Todos',
  embedded=false,
  title='O que você precisa realizar?',
  subtitle='Escolha uma área, veja exatamente o que entregamos e contrate pela plataforma. Atendimento humano fica para projetos que realmente precisam de uma solução personalizada.',
  area,
}:ServicesPageProps={}){
 const {user,role}=useAuth(),toast=useToast(),navigate=useNavigate()
 const [rows,setRows]=useState<PublicServiceOffer[]>([])
 const [loading,setLoading]=useState(true)
 const [error,setError]=useState('')
 const [category,setCategory]=useState(initialCategory)

 useEffect(()=>{
  let active=true
  setLoading(true)
  setError('')
  listPublicServiceOffers()
    .then(data=>{if(active)setRows(data)})
    .catch(err=>{console.error(err);if(active)setError('Não foi possível carregar o catálogo agora.')})
    .finally(()=>{if(active)setLoading(false)})
  return()=>{active=false}
 },[])

 const scoped=useMemo(
  ()=>area?rows.filter(row=>serviceOfferMatchesArea(row,area)):rows,
  [rows,area],
 )
 const categories=useMemo(
  ()=>['Todos',...Array.from(new Set(scoped.map(s=>s.category).filter((x):x is string=>Boolean(x))))],
  [scoped],
 )
 const norm=(value:string)=>value.normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase()
 const visible=useMemo(()=>{
  if(category==='Todos')return scoped
  return scoped.filter(s=>{
   const current=norm(String(s.category||'')),wanted=norm(category)
   return current===wanted||current.includes(wanted.split(' ')[0])||wanted.includes(current)
  })
 },[scoped,category])

 useEffect(()=>{
  if(category!=='Todos'&&!categories.includes(category))setCategory('Todos')
 },[categories,category])

 async function hire(s:PublicServiceOffer){
   if(s.source==='catalog'){
     navigate('/servicos/'+s.slug)
     return
   }
   if(!user){navigate(authLink('/cadastro','/servicos/'+s.slug));return}
   try{
     await portalApi.requestService(s.id)
     toast(s.price_type==='fixed'?'Pedido criado.':'Solicitação de orçamento enviada.','success')
     navigate(s.price_type==='fixed'?'/app/pedidos':'/app/orcamentos')
   }catch(e:any){toast(e.message,'error')}
 }

 const content=<div className="mx-auto px-4 py-10 sm:py-14" style={{maxWidth:1100}}>
   <div className="max-w-2xl mb-8">
    <p className="text-xs uppercase tracking-widest text-[#E30613] mb-2">Serviços Play Moments</p>
    <h1 className="text-3xl sm:text-4xl font-bold">{title}</h1>
    <p className="text-sm sm:text-base text-gray-400 mt-3">{subtitle}</p>
   </div>

   {!loading&&scoped.length>0&&<div className="grid sm:grid-cols-3 gap-3 mb-7">
    <div className="rounded-2xl border border-white/10 bg-[#141416] p-4"><p className="text-2xl font-bold">{scoped.length}</p><p className="text-xs text-gray-500 mt-1">soluções publicadas</p></div>
    <div className="rounded-2xl border border-white/10 bg-[#141416] p-4"><p className="text-2xl font-bold">{categories.length-1}</p><p className="text-xs text-gray-500 mt-1">áreas do catálogo</p></div>
    <div className="rounded-2xl border border-white/10 bg-[#141416] p-4"><p className="text-2xl font-bold">{scoped.filter(x=>x.price_type==='fixed').length}</p><p className="text-xs text-gray-500 mt-1">opções com preço fechado</p></div>
   </div>}

   {!loading&&categories.length>1&&<div className="flex gap-2 overflow-x-auto pb-3 mb-5" aria-label="Filtrar serviços por categoria">
    {categories.map(c=><button key={c} onClick={()=>setCategory(c)} className="shrink-0 px-4 py-2 rounded-full text-sm font-semibold transition-colors" style={{background:category===c?'#E30613':'#171719',color:category===c?'#fff':'#b0b0ba',border:'1px solid '+(category===c?'#E30613':'rgba(255,255,255,.08)')}}>{c}</button>)}
   </div>}

   {loading?<CatalogSkeleton/>:error?
    <CatalogState title="Catálogo temporariamente indisponível" text={error} role={role}/>:
    visible.length===0?
    <CatalogState title={area?'Ainda não há uma oferta publicada nesta área.':'Nenhum serviço publicado no momento.'} text="A página continua útil: explore o restante do catálogo ou envie uma necessidade personalizada." role={role}/>:
    <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-5">{visible.map(s=>
     <article key={s.source+'-'+s.id} className="p-5 rounded-2xl bg-[#141416] border border-white/10 flex flex-col">
      <div className="flex items-start justify-between gap-3">
       <p className="text-xs font-semibold text-[#ff6b7a]">{s.category||'Serviço'}</p>
       {s.source==='catalog'&&<span className="text-[10px] px-2 py-1 rounded-full border border-white/10 text-gray-500">Catálogo</span>}
      </div>
      <h2 className="font-bold text-lg mt-1">{s.name}</h2>
      <p className="text-sm text-gray-400 mt-2 flex-1">{s.short_description||s.description}</p>
      <div className="mt-5 pt-4 border-t border-white/10">
       <p className="text-xs text-gray-500 mb-1">{s.price_type==='quote'?'Projeto sob medida':'Contratação direta'}</p>
       <p className="font-semibold">{s.price_type==='quote'?'Orçamento personalizado':(s.price_type==='starting_at'?'A partir de ':'')+money(s.price??s.starting_price??0)}</p>
       <div className="flex items-center gap-3 mt-4">
        <Link to={'/servicos/'+s.slug} className="min-h-11 inline-flex items-center text-sm text-gray-300 underline underline-offset-4">Ver detalhes</Link>
        <button onClick={()=>hire(s)} className="ml-auto min-h-11 px-4 py-2 rounded-xl bg-[#E30613] text-sm font-semibold">{s.source==='catalog'?'Ver e contratar':s.price_type==='fixed'?'Contratar':'Pedir proposta'}</button>
       </div>
      </div>
     </article>)}</div>}

   <section className="mt-10 rounded-2xl border border-white/10 p-5 sm:p-6 flex flex-col sm:flex-row sm:items-center gap-4" style={{background:'linear-gradient(135deg,rgba(227,6,19,.09),rgba(255,255,255,.02))'}}>
    <div className="flex-1"><p className="font-bold">Seu projeto não cabe em uma opção pronta?</p><p className="text-sm text-gray-400 mt-1">Conte somente o essencial. A equipe recebe a necessidade já contextualizada.</p></div>
    <Link to={conversationLink(role,'orcamento')} className="min-h-11 inline-flex items-center justify-center px-5 py-3 rounded-xl border border-[#E30613] text-[#ff6b7a] font-semibold">Projeto personalizado</Link>
   </section>
  </div>
 return embedded?content:<PublicLayout>{content}</PublicLayout>
}

function CatalogSkeleton(){
 return <div className="grid md:grid-cols-3 gap-5" aria-label="Carregando serviços">
  {[0,1,2].map(i=><div key={i} className="rounded-2xl border border-white/10 bg-[#141416] p-5 min-h-56"><div className="pm-skeleton h-3 w-24 rounded mb-4"/><div className="pm-skeleton h-6 w-3/4 rounded mb-3"/><div className="pm-skeleton h-16 w-full rounded mb-6"/><div className="pm-skeleton h-10 w-full rounded"/></div>)}
 </div>
}

function CatalogState({title,text,role}:{title:string;text:string;role:Parameters<typeof conversationLink>[0]}){
 return <div className="rounded-3xl border border-white/10 bg-[#141416] p-7 sm:p-10 text-center">
  <div className="mx-auto w-12 h-12 rounded-2xl grid place-items-center text-xl bg-white/5">◆</div>
  <h2 className="font-bold text-xl mt-4">{title}</h2>
  <p className="text-sm text-gray-400 mt-2 max-w-xl mx-auto">{text}</p>
  <div className="flex flex-wrap justify-center gap-3 mt-6">
   <Link to="/produtos" className="min-h-11 inline-flex items-center px-5 py-3 rounded-xl bg-white/5 border border-white/10 font-semibold text-sm">Produtos e equipamentos</Link>
   <Link to={conversationLink(role,'orcamento')} className="min-h-11 inline-flex items-center px-5 py-3 rounded-xl bg-[#E30613] font-semibold text-sm">Pedir solução personalizada</Link>
  </div>
 </div>
}
