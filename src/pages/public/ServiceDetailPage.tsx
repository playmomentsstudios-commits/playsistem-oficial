import { useEffect,useState } from 'react'
import { Link,useNavigate,useParams } from 'react-router-dom'
import { PublicLayout } from '../../layouts/PublicLayout'
import { portalApi } from '../../api/portal'
import { useAuth } from '../../contexts/AuthContext'
import { useToast } from '../../contexts/ToastContext'
import { authLink,conversationLink } from '../../lib/navigation'
import { useSeo } from '../../lib/seo'

const money=(v:number)=>new Intl.NumberFormat('pt-BR',{style:'currency',currency:'BRL'}).format(v/100)

function lines(value:unknown){
 return typeof value==='string' ? value.split(/\r?\n/).map(x=>x.trim()).filter(Boolean) : []
}

function DetailList({title,items,muted=false}:{title:string;items:string[];muted?:boolean}){return <div className="rounded-2xl border border-white/10 p-4 bg-[#111113]"><h3 className="text-sm font-semibold">{title}</h3><ul className="mt-2 space-y-2">{items.map((item,i)=><li key={i} className={`text-xs flex gap-2 ${muted?'text-gray-500':'text-gray-300'}`}><span>{muted?'—':'✓'}</span><span>{item}</span></li>)}</ul></div>}

export function ServiceDetailPage(){
 const {slug}=useParams(),{user,role}=useAuth(),toast=useToast(),navigate=useNavigate()
 const [service,setService]=useState<any>(null),[loading,setLoading]=useState(true),[submitting,setSubmitting]=useState(false)
 useEffect(()=>{portalApi.services().then(rows=>setService(rows.find((x:any)=>x.slug===slug)||null)).finally(()=>setLoading(false))},[slug])
 useSeo({title:service?.name||'Serviço',description:(service?.short_description||service?.description||'Serviço profissional Play Moments.').slice(0,160),canonicalPath:'/servicos/'+(slug||''),noindex:!loading&&!service,jsonLd:service?{'@context':'https://schema.org','@type':'Service',name:service.name,description:service.short_description||service.description||undefined,provider:{'@type':'Organization',name:'Play Moments'}}:null})
 async function hire(){
  if(!service||submitting)return
  if(!user){navigate(authLink('/cadastro','/servicos/'+service.slug));return}
  setSubmitting(true)
  try{
   await portalApi.requestService(service.id)
   toast(service.price_type==='fixed'?'Pedido criado.':'Solicitação de proposta criada.','success')
   navigate(service.price_type==='fixed'?'/app/pedidos':'/app/orcamentos')
  }catch(e:any){toast(e.message,'error')}finally{setSubmitting(false)}
 }
 if(loading)return <PublicLayout><div className="mx-auto px-4 py-16 text-center text-gray-400" style={{maxWidth:900}}>Carregando serviço...</div></PublicLayout>
 if(!service)return <PublicLayout><div className="mx-auto px-4 py-16" style={{maxWidth:900}}><h1 className="text-2xl font-bold">Serviço não encontrado</h1><Link to="/servicos" className="inline-flex min-h-11 items-center text-[#E30613]">← Voltar aos serviços</Link></div></PublicLayout>

 const description=lines(service.description)
 const summary=service.short_description||description[0]||'Solução profissional Play Moments.'
 const isFixed=service.price_type==='fixed'
 const deliverables=Array.isArray(service.deliverables)?service.deliverables:[]
 const requirements=Array.isArray(service.customer_requirements)?service.customer_requirements:[]
 const included=Array.isArray(service.included_items)?service.included_items:[]
 const excluded=Array.isArray(service.excluded_items)?service.excluded_items:[]
 return <PublicLayout>
  <main className="mx-auto px-4 py-10 sm:py-14" style={{maxWidth:1000}}>
   <Link to="/servicos" className="inline-flex min-h-11 items-center text-sm text-gray-400">← Todos os serviços</Link>

   <div className="grid lg:grid-cols-[1fr_340px] gap-7 lg:gap-10 mt-3">
    <div>
     <p className="text-xs uppercase tracking-widest font-semibold text-[#ff6b7a]">{service.category||'Serviço Play Moments'}</p>
     <h1 className="text-3xl sm:text-5xl font-bold mt-2 leading-tight">{service.name}</h1>
     <p className="text-base sm:text-lg text-gray-400 mt-4 leading-relaxed">{summary}</p>

     <section className="mt-8">
      <h2 className="text-xl font-bold">O que você recebe</h2>
      <div className="mt-3 rounded-2xl bg-[#141416] border border-white/10 p-5">
       {description.length>1?<ul className="space-y-3">{description.map((item,i)=><li key={i} className="flex gap-3 text-sm text-gray-300"><span className="text-[#E30613] font-bold">✓</span><span>{item}</span></li>)}</ul>:<p className="text-sm text-gray-300 whitespace-pre-wrap">{service.description||summary}</p>}
      </div>
     </section>

     {(deliverables.length||requirements.length||included.length||excluded.length||service.estimated_deadline||service.delivery_format||service.revision_count!==null)&&<section className="mt-7 space-y-4">
      <h2 className="text-xl font-bold">Detalhes da solução</h2>
      <div className="grid sm:grid-cols-3 gap-3">
       {service.estimated_deadline&&<div className="rounded-xl border border-white/10 p-4"><p className="text-xs text-gray-500">Prazo estimado</p><p className="text-sm font-semibold mt-1">{service.estimated_deadline}</p></div>}
       {service.revision_count!==null&&service.revision_count!==undefined&&<div className="rounded-xl border border-white/10 p-4"><p className="text-xs text-gray-500">Revisões incluídas</p><p className="text-sm font-semibold mt-1">{service.revision_count} {service.revision_count===1?'rodada':'rodadas'}</p></div>}
       {service.delivery_format&&<div className="rounded-xl border border-white/10 p-4"><p className="text-xs text-gray-500">Formato de entrega</p><p className="text-sm font-semibold mt-1">{service.delivery_format}</p></div>}
      </div>
      <div className="grid sm:grid-cols-2 gap-3">
       {deliverables.length>0&&<DetailList title="Entregáveis" items={deliverables}/>}
       {included.length>0&&<DetailList title="Incluído" items={included}/>}
       {requirements.length>0&&<DetailList title="O que precisamos de você" items={requirements}/>}
       {excluded.length>0&&<DetailList title="Não incluído" items={excluded} muted/>}
      </div>
     </section>}

     <section className="mt-7 grid sm:grid-cols-3 gap-3">
      <div className="rounded-2xl border border-white/10 p-4 bg-[#111113]"><p className="text-xs text-gray-500">1</p><p className="font-semibold mt-1">Escolha</p><p className="text-xs text-gray-400 mt-1">Confira se esta solução atende ao que você precisa.</p></div>
      <div className="rounded-2xl border border-white/10 p-4 bg-[#111113]"><p className="text-xs text-gray-500">2</p><p className="font-semibold mt-1">{isFixed?'Contrate':'Peça a proposta'}</p><p className="text-xs text-gray-400 mt-1">{isFixed?'O pedido entra no seu portal.':'A solicitação entra organizada no seu portal.'}</p></div>
      <div className="rounded-2xl border border-white/10 p-4 bg-[#111113]"><p className="text-xs text-gray-500">3</p><p className="font-semibold mt-1">Acompanhe</p><p className="text-xs text-gray-400 mt-1">Status, arquivos, pagamentos e comunicação ficam centralizados.</p></div>
     </section>

     <section className="mt-8 border-t border-white/10 pt-6">
      <h2 className="font-bold">Precisa de algo diferente?</h2>
      <p className="text-sm text-gray-400 mt-1">Se o escopo desta solução não atende ao projeto, envie uma necessidade personalizada. Você só fala com a equipe quando realmente for necessário.</p>
      <Link to={conversationLink(role,'orcamento')} className="inline-flex min-h-11 items-center mt-2 text-sm text-[#ff6b7a] underline underline-offset-4">Enviar projeto personalizado</Link>
     </section>
    </div>

    <aside className="lg:sticky lg:top-24 lg:self-start rounded-2xl bg-[#141416] border border-white/10 p-5">
     <p className="text-xs text-gray-500">{isFixed?'Contratação direta':service.price_type==='starting_at'?'Valor inicial':'Projeto sob medida'}</p>
     <p className="text-2xl font-bold mt-1">{service.price_type==='quote'?'Orçamento personalizado':(service.price_type==='starting_at'?'A partir de ':'')+money(service.price??service.starting_price??0)}</p>
     <p className="text-xs text-gray-400 mt-3">{isFixed?'Depois da contratação, você acompanha tudo pela Área do Cliente.':'Você envia a solicitação pela plataforma e recebe a proposta no seu portal.'}</p>
     <button onClick={hire} disabled={submitting} className="w-full min-h-12 mt-5 px-5 py-3 rounded-xl bg-[#E30613] font-semibold disabled:opacity-60">{submitting?'Enviando...':isFixed?'Contratar pela plataforma':'Pedir proposta'}</button>
     {!user&&<p className="text-xs text-gray-500 mt-3 text-center">Você cria ou acessa sua conta antes de concluir.</p>}
     <div className="mt-5 pt-4 border-t border-white/10 space-y-2 text-xs text-gray-400">
      <p>✓ Solicitação registrada</p><p>✓ Histórico no portal</p><p>✓ Acompanhamento centralizado</p>
     </div>
    </aside>
   </div>
  </main>
 </PublicLayout>
}