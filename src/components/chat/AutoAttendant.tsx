import { useEffect, useMemo, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { crmApi } from '../../api/crm'
import { autoattendantApi, AutoSolution } from '../../api/autoattendant'
import { portalApi } from '../../api/portal'

type Props={onHuman:(summary:string)=>Promise<void>;busy?:boolean}

type Flow='home'|'faq'|'custom'|'support'|'finder'

const FAQ=[
  {q:'Como acompanho meu projeto?',a:'Na Área do Cliente, abra Projetos. Ali ficam status e acompanhamento do trabalho.',href:'/app/projetos',cta:'Ver projetos'},
  {q:'Onde vejo pagamentos?',a:'Pagamentos e situação financeira ficam centralizados no seu portal.',href:'/app/pagamentos',cta:'Ver pagamentos'},
  {q:'Onde encontro meus arquivos?',a:'Use a Central de Arquivos para acessar materiais disponibilizados no seu atendimento ou projeto.',href:'/app/arquivos',cta:'Ver arquivos'},
  {q:'Como acesso a Academia?',a:'Seus cursos e conteúdos ficam na Academia Play Moments.',href:'/app/academia',cta:'Abrir Academia'},
]

export function AutoAttendant({onHuman,busy=false}:Props){
 const navigate=useNavigate()
 const [flow,setFlow]=useState<Flow>('home')
 const [faq,setFaq]=useState<number|null>(null)
 const [custom,setCustom]=useState({type:'',goal:'',deadline:'',budget:''})
 const [support,setSupport]=useState({topic:'',detail:''})
 const [sent,setSent]=useState(false)
 const [query,setQuery]=useState('')
 const [solutions,setSolutions]=useState<AutoSolution[]>([])
 const [services,setServices]=useState<any[]>([])
 useEffect(()=>{
  autoattendantApi.list().then(data=>setSolutions(data.filter(item=>item.active))).catch(()=>setSolutions([]))
  portalApi.services().then(setServices).catch(()=>setServices([]))
 },[])
 const serviceMatches=useMemo(()=>{
  const normalized=query.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g,'')
  const words=normalized.split(/\s+/).filter(w=>w.length>2)
  if(!words.length)return []
  return services.map(service=>{
   const haystack=[service.name,service.category,service.short_description,service.description,...(service.deliverables||[]),...(service.included_items||[])].filter(Boolean).join(' ').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g,'')
   const score=words.reduce((total,word)=>total+(haystack.includes(word)?1:0),0)
   return {service,score}
  }).filter(x=>x.score>0).sort((a,b)=>b.score-a.score).slice(0,3)
 },[query,services])
 const matches=useMemo(()=>{
  const words=query.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g,'').split(/\s+/).filter(w=>w.length>2)
  if(!words.length)return []
  return solutions.map(item=>{
   const keys=item.keywords.map(k=>k.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g,''))
   const score=keys.reduce((total,key)=>total+(words.some(word=>key.includes(word)||word.includes(key))?1:0),0)
   return {item,score}
  }).filter(x=>x.score>0).sort((a,b)=>b.score-a.score||b.item.priority-a.item.priority).slice(0,3)
 },[query,solutions])

 async function crmEvent(event:'service_interest'|'product_interest'|'custom_project'|'support_request',detail?:string){
  try{await crmApi.customerAutoEvent(event,detail)}catch{ /* CRM must never block customer service. */ }
 }

 async function go(path:string,event:'service_interest'|'product_interest'){
  await crmEvent(event)
  navigate(path)
 }

 async function handoff(summary:string,event:'custom_project'|'support_request',detail?:string){
  await crmEvent(event,detail)

  await onHuman('[Autoatendimento Play Moments]\n'+summary)
  setSent(true)
 }

 if(sent)return <div className="mx-4 my-4 p-4 rounded-2xl border border-emerald-500/20 bg-emerald-500/[0.06]">
  <p className="font-semibold text-sm">Tudo certo. Sua necessidade foi registrada.</p>
  <p className="text-xs text-gray-400 mt-1">A equipe já recebe o contexto acima. Você não precisa explicar tudo novamente.</p>
 </div>

 return <div className="p-4 overflow-auto">
  <div className="rounded-2xl border border-white/10 bg-white/[0.035] p-4">
   <p className="text-xs uppercase tracking-[.14em] text-[#ff6b7a] font-semibold">Autoatendimento</p>
   <h3 className="font-semibold mt-1">O que você precisa resolver?</h3>
   <p className="text-xs text-gray-400 mt-1">Escolha um caminho. Se precisar de algo personalizado, eu organizo as informações antes de chamar a equipe.</p>
  </div>

  {flow==='home'&&<div className="grid grid-cols-2 gap-2 mt-3">
   <button type="button" onClick={()=>setFlow('finder')} className="min-h-20 p-3 rounded-xl border border-white/10 bg-white/[0.035] text-left"><b className="text-sm block">Encontrar uma solução</b><span className="text-[11px] text-gray-500">Descreva o que você precisa</span></button>
   <button type="button" onClick={()=>void go('/produtos','product_interest')} className="min-h-20 p-3 rounded-xl border border-white/10 bg-white/[0.035] text-left"><b className="text-sm block">Comprar produto</b><span className="text-[11px] text-gray-500">Produtos e equipamentos</span></button>
   <Link to="/app/academia" className="min-h-20 p-3 rounded-xl border border-white/10 bg-white/[0.035]"><b className="text-sm block">Academia</b><span className="text-[11px] text-gray-500">Cursos e conteúdos</span></Link>
   <button onClick={()=>setFlow('faq')} className="min-h-20 p-3 rounded-xl border border-white/10 bg-white/[0.035] text-left"><b className="text-sm block">Dúvidas rápidas</b><span className="text-[11px] text-gray-500">Projetos, arquivos e pagamentos</span></button>
   <button onClick={()=>setFlow('custom')} className="col-span-2 min-h-16 p-3 rounded-xl border border-[#E30613]/40 bg-[#E30613]/10 text-left"><b className="text-sm block">Tenho um projeto personalizado</b><span className="text-[11px] text-gray-400">Organizar briefing antes de falar com a equipe</span></button>
   <button onClick={()=>setFlow('support')} className="col-span-2 min-h-11 text-xs text-gray-400 underline underline-offset-4">Não encontrei o que preciso</button>
  </div>}

  {flow==='finder'&&<div className="mt-3 space-y-3">
   <label className="block text-xs text-gray-400">Conte em poucas palavras o que você precisa
    <textarea autoFocus rows={3} value={query} onChange={e=>setQuery(e.target.value)} placeholder="Ex.: preciso criar uma logo para minha empresa" className="mt-1 w-full p-3 rounded-xl bg-black border border-white/10 text-white resize-none"/>
   </label>
   {query.trim().length>2&&<div className="space-y-2">
    {(serviceMatches.length||matches.length)?<>
     {serviceMatches.map(({service})=><div key={'service-'+service.id} className="rounded-xl border border-[#E30613]/25 bg-[#E30613]/[0.05] p-3">
      <div className="flex items-start justify-between gap-2"><div><span className="text-[10px] uppercase tracking-wider text-[#ff6b7a]">Serviço disponível</span><b className="text-sm block mt-0.5">{service.name}</b></div>{service.estimated_deadline&&<span className="text-[10px] text-gray-500 text-right">Prazo estimado<br/>{service.estimated_deadline}</span>}</div>
      <p className="text-xs text-gray-400 mt-1">{service.short_description||service.description}</p>
      {Array.isArray(service.deliverables)&&service.deliverables.length>0&&<p className="text-[11px] text-gray-500 mt-2">Inclui: {service.deliverables.slice(0,3).join(' · ')}</p>}
      {Array.isArray(service.customer_requirements)&&service.customer_requirements.length>0&&<p className="text-[11px] text-gray-500 mt-1">Para começar: {service.customer_requirements.slice(0,2).join(' · ')}</p>}
      <div className="flex gap-3 mt-2"><button type="button" onClick={()=>void crmEvent('service_interest',service.name).then(()=>navigate('/servicos/'+service.slug))} className="text-xs text-[#ff6b7a] underline">Ver esta solução</button><button type="button" onClick={()=>{setCustom(v=>({...v,type:service.category||service.name,goal:query}));setFlow('custom')}} className="text-xs text-gray-400 underline">Preciso adaptar</button></div>
     </div>)}
     {serviceMatches.length===0&&matches.map(({item})=><div key={item.id} className="rounded-xl border border-white/10 bg-white/[0.025] p-3">
     <b className="text-sm">{item.name}</b><p className="text-xs text-gray-400 mt-1">{item.response}</p>
     {item.question&&<p className="text-xs text-gray-300 mt-2"><span className="text-[#ff6b7a]">Para direcionar melhor:</span> {item.question}</p>}
     <div className="flex gap-3 mt-2">{item.route&&<button type="button" onClick={()=>void crmEvent((item.crm_event==='product_interest'?'product_interest':'service_interest'),item.name).then(()=>navigate(item.route!))} className="text-xs text-[#ff6b7a] underline">Ver solução</button>}<button type="button" onClick={()=>{setCustom(v=>({...v,type:item.name,goal:query}));setFlow('custom')}} className="text-xs text-gray-400 underline">Quero algo personalizado</button></div>
    </div>)}</>:<div className="rounded-xl border border-white/10 p-3"><p className="text-xs text-gray-400">Ainda não encontrei uma solução suficientemente próxima. Posso organizar seu pedido para a equipe.</p><button onClick={()=>{setCustom(v=>({...v,goal:query}));setFlow('custom')}} className="mt-2 text-xs text-[#ff6b7a] underline">Continuar como projeto personalizado</button></div>}
   </div>}
   <button onClick={()=>setFlow('home')} className="min-h-11 text-xs text-gray-400">← Voltar</button>
  </div>}

  {flow==='faq'&&<div className="mt-3 space-y-2">
   {FAQ.map((item,i)=><div key={item.q} className="rounded-xl border border-white/10 overflow-hidden">
    <button onClick={()=>setFaq(faq===i?null:i)} className="w-full min-h-12 px-3 text-left text-sm font-medium bg-white/[0.025]">{item.q}</button>
    {faq===i&&<div className="p-3 border-t border-white/10"><p className="text-xs text-gray-400">{item.a}</p><Link to={item.href} className="inline-flex min-h-10 items-center mt-1 text-xs text-[#ff6b7a] underline">{item.cta}</Link></div>}
   </div>)}
   <button onClick={()=>setFlow('home')} className="min-h-11 text-xs text-gray-400">← Voltar</button>
  </div>}

  {flow==='custom'&&<div className="mt-3 space-y-3">
   <label className="block text-xs text-gray-400">Área do projeto
    <select value={custom.type} onChange={e=>setCustom({...custom,type:e.target.value})} className="mt-1 w-full min-h-11 px-3 rounded-xl bg-black border border-white/10 text-white">
     <option value="">Selecione</option><option>Design e identidade visual</option><option>Site e tecnologia</option><option>Vídeo e audiovisual</option><option>Áudio e produção musical</option><option>Comunicação e conteúdo</option><option>Outro / multidisciplinar</option>
    </select>
   </label>
   <label className="block text-xs text-gray-400">O que você quer realizar?
    <textarea rows={3} value={custom.goal} onChange={e=>setCustom({...custom,goal:e.target.value})} placeholder="Explique em poucas palavras o resultado que precisa." className="mt-1 w-full p-3 rounded-xl bg-black border border-white/10 text-white resize-none"/>
   </label>
   <div className="grid grid-cols-2 gap-2">
    <label className="block text-xs text-gray-400">Prazo desejado<input value={custom.deadline} onChange={e=>setCustom({...custom,deadline:e.target.value})} placeholder="Ex.: 30 dias" className="mt-1 w-full min-h-11 px-3 rounded-xl bg-black border border-white/10 text-white"/></label>
    <label className="block text-xs text-gray-400">Faixa de investimento<input value={custom.budget} onChange={e=>setCustom({...custom,budget:e.target.value})} placeholder="Opcional" className="mt-1 w-full min-h-11 px-3 rounded-xl bg-black border border-white/10 text-white"/></label>
   </div>
   <button disabled={busy||!custom.type||custom.goal.trim().length<8} onClick={()=>void handoff(`Tipo: Projeto personalizado\nÁrea: ${custom.type}\nObjetivo: ${custom.goal.trim()}\nPrazo desejado: ${custom.deadline||'Não informado'}\nFaixa de investimento: ${custom.budget||'Não informada'}\nEncaminhamento: atendimento humano solicitado.`,'custom_project',`${custom.type}: ${custom.goal.trim()}`)} className="w-full min-h-12 rounded-xl bg-[#E30613] font-semibold disabled:opacity-40">{busy?'Registrando...':'Enviar briefing para a equipe'}</button>
   <button onClick={()=>setFlow('home')} className="min-h-11 text-xs text-gray-400">← Voltar</button>
  </div>}

  {flow==='support'&&<div className="mt-3 space-y-3">
   <label className="block text-xs text-gray-400">Assunto
    <select value={support.topic} onChange={e=>setSupport({...support,topic:e.target.value})} className="mt-1 w-full min-h-11 px-3 rounded-xl bg-black border border-white/10 text-white">
     <option value="">Selecione</option><option>Pedido ou compra</option><option>Pagamento</option><option>Projeto em andamento</option><option>Arquivos</option><option>Acesso ou conta</option><option>Academia</option><option>Outro</option>
    </select>
   </label>
   <label className="block text-xs text-gray-400">O que aconteceu?<textarea rows={3} value={support.detail} onChange={e=>setSupport({...support,detail:e.target.value})} className="mt-1 w-full p-3 rounded-xl bg-black border border-white/10 text-white resize-none" placeholder="Descreva somente o essencial."/></label>
   <button disabled={busy||!support.topic||support.detail.trim().length<5} onClick={()=>void handoff(`Tipo: Suporte / exceção do autoatendimento\nAssunto: ${support.topic}\nRelato: ${support.detail.trim()}\nEncaminhamento: atendimento humano solicitado.`,'support_request',`${support.topic}: ${support.detail.trim()}`)} className="w-full min-h-12 rounded-xl bg-[#E30613] font-semibold disabled:opacity-40">{busy?'Registrando...':'Encaminhar para a equipe'}</button>
   <button onClick={()=>setFlow('home')} className="min-h-11 text-xs text-gray-400">← Voltar</button>
  </div>}
 </div>
}
