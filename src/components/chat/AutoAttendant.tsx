import { useState } from 'react'
import { Link } from 'react-router-dom'

type Props={onHuman:(summary:string)=>Promise<void>;busy?:boolean}

type Flow='home'|'faq'|'custom'|'support'

const FAQ=[
  {q:'Como acompanho meu projeto?',a:'Na Área do Cliente, abra Projetos. Ali ficam status e acompanhamento do trabalho.',href:'/app/projetos',cta:'Ver projetos'},
  {q:'Onde vejo pagamentos?',a:'Pagamentos e situação financeira ficam centralizados no seu portal.',href:'/app/pagamentos',cta:'Ver pagamentos'},
  {q:'Onde encontro meus arquivos?',a:'Use a Central de Arquivos para acessar materiais disponibilizados no seu atendimento ou projeto.',href:'/app/arquivos',cta:'Ver arquivos'},
  {q:'Como acesso a Academia?',a:'Seus cursos e conteúdos ficam na Academia Play Moments.',href:'/app/academia',cta:'Abrir Academia'},
]

export function AutoAttendant({onHuman,busy=false}:Props){
 const [flow,setFlow]=useState<Flow>('home')
 const [faq,setFaq]=useState<number|null>(null)
 const [custom,setCustom]=useState({type:'',goal:'',deadline:'',budget:''})
 const [support,setSupport]=useState({topic:'',detail:''})
 const [sent,setSent]=useState(false)

 async function handoff(summary:string){
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
   <Link to="/servicos" className="min-h-20 p-3 rounded-xl border border-white/10 bg-white/[0.035]"><b className="text-sm block">Contratar serviço</b><span className="text-[11px] text-gray-500">Ver soluções e propostas</span></Link>
   <Link to="/produtos" className="min-h-20 p-3 rounded-xl border border-white/10 bg-white/[0.035]"><b className="text-sm block">Comprar produto</b><span className="text-[11px] text-gray-500">Produtos e equipamentos</span></Link>
   <Link to="/app/academia" className="min-h-20 p-3 rounded-xl border border-white/10 bg-white/[0.035]"><b className="text-sm block">Academia</b><span className="text-[11px] text-gray-500">Cursos e conteúdos</span></Link>
   <button onClick={()=>setFlow('faq')} className="min-h-20 p-3 rounded-xl border border-white/10 bg-white/[0.035] text-left"><b className="text-sm block">Dúvidas rápidas</b><span className="text-[11px] text-gray-500">Projetos, arquivos e pagamentos</span></button>
   <button onClick={()=>setFlow('custom')} className="col-span-2 min-h-16 p-3 rounded-xl border border-[#E30613]/40 bg-[#E30613]/10 text-left"><b className="text-sm block">Tenho um projeto personalizado</b><span className="text-[11px] text-gray-400">Organizar briefing antes de falar com a equipe</span></button>
   <button onClick={()=>setFlow('support')} className="col-span-2 min-h-11 text-xs text-gray-400 underline underline-offset-4">Não encontrei o que preciso</button>
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
   <button disabled={busy||!custom.type||custom.goal.trim().length<8} onClick={()=>void handoff(`Tipo: Projeto personalizado\nÁrea: ${custom.type}\nObjetivo: ${custom.goal.trim()}\nPrazo desejado: ${custom.deadline||'Não informado'}\nFaixa de investimento: ${custom.budget||'Não informada'}\nEncaminhamento: atendimento humano solicitado.`)} className="w-full min-h-12 rounded-xl bg-[#E30613] font-semibold disabled:opacity-40">{busy?'Registrando...':'Enviar briefing para a equipe'}</button>
   <button onClick={()=>setFlow('home')} className="min-h-11 text-xs text-gray-400">← Voltar</button>
  </div>}

  {flow==='support'&&<div className="mt-3 space-y-3">
   <label className="block text-xs text-gray-400">Assunto
    <select value={support.topic} onChange={e=>setSupport({...support,topic:e.target.value})} className="mt-1 w-full min-h-11 px-3 rounded-xl bg-black border border-white/10 text-white">
     <option value="">Selecione</option><option>Pedido ou compra</option><option>Pagamento</option><option>Projeto em andamento</option><option>Arquivos</option><option>Acesso ou conta</option><option>Academia</option><option>Outro</option>
    </select>
   </label>
   <label className="block text-xs text-gray-400">O que aconteceu?<textarea rows={3} value={support.detail} onChange={e=>setSupport({...support,detail:e.target.value})} className="mt-1 w-full p-3 rounded-xl bg-black border border-white/10 text-white resize-none" placeholder="Descreva somente o essencial."/></label>
   <button disabled={busy||!support.topic||support.detail.trim().length<5} onClick={()=>void handoff(`Tipo: Suporte / exceção do autoatendimento\nAssunto: ${support.topic}\nRelato: ${support.detail.trim()}\nEncaminhamento: atendimento humano solicitado.`)} className="w-full min-h-12 rounded-xl bg-[#E30613] font-semibold disabled:opacity-40">{busy?'Registrando...':'Encaminhar para a equipe'}</button>
   <button onClick={()=>setFlow('home')} className="min-h-11 text-xs text-gray-400">← Voltar</button>
  </div>}
 </div>
}
