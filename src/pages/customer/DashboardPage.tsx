import { useEffect,useState } from 'react'
import { Link } from 'react-router-dom'
import { useAuth } from '../../contexts/AuthContext'
import { portalApi } from '../../api/portal'
import { nivelCliente,rotulo } from '../../lib/labels.ptBR'

function money(cents:number|undefined|null){
  return ((cents||0)/100).toLocaleString('pt-BR',{style:'currency',currency:'BRL'})
}

export function DashboardPage(){
  const {user}=useAuth()
  const [data,setData]=useState({orders:0,projects:0,quotes:0,payments:0,messages:0,notifications:0})
  const [loyalty,setLoyalty]=useState<any>(null)
  const [settings,setSettings]=useState<any>(null)
  const [loading,setLoading]=useState(true)
  const [loadError,setLoadError]=useState(false)

  useEffect(()=>{
    if(!user)return
    void portalApi.ensureClientDriveFolder(user.id).catch(()=>undefined)
    setLoadError(false)
    Promise.all([
      portalApi.orders(),
      portalApi.projects(),
      portalApi.quotes(),
      portalApi.payments(),
      portalApi.unreadCounts(user.id),
      portalApi.customerLoyalty(user.id),
      portalApi.loyaltySettings(),
    ]).then(([orders,projects,quotes,payments,counts,loyaltyRow,loyaltySettings])=>{
      setData({
        orders:orders.filter((item:any)=>!['completed','cancelled'].includes(item.status)).length,
        projects:projects.filter((item:any)=>!['completed','cancelled'].includes(item.status)).length,
        quotes:quotes.filter((item:any)=>['sent','viewed'].includes(item.status)).length,
        payments:payments.filter((item:any)=>item.status!=='paid').length,
        messages:counts.messages,
        notifications:counts.notifications,
      })
      setLoyalty(loyaltyRow)
      setSettings(loyaltySettings)
    }).catch(()=>setLoadError(true)).finally(()=>setLoading(false))
  },[user?.id])

  const cards=[
    ['Projetos ativos',data.projects,'/app/projetos','text-blue-300'],
    ['Pedidos ativos',data.orders,'/app/pedidos','text-blue-300'],
    ['Pagamentos pendentes',data.payments,'/app/pagamentos',data.payments?'text-amber-300':'text-emerald-300'],
    ['Orçamentos aguardando você',data.quotes,'/app/orcamentos',data.quotes?'text-violet-300':'text-gray-300'],
    ['Mensagens não lidas',data.messages,'/app/conversas',data.messages?'text-emerald-300':'text-gray-300'],
    ['Notificações',data.notifications,'/app/notificacoes',data.notifications?'text-amber-300':'text-gray-300'],
  ]

  const nextAction=data.payments>0
    ? {label:'Resolver pagamento pendente',detail:`${data.payments} pagamento(s) aguardando você`,href:'/app/pagamentos',tone:'text-amber-200'}
    : data.quotes>0
      ? {label:'Revisar orçamento',detail:`${data.quotes} proposta(s) esperando sua decisão`,href:'/app/orcamentos',tone:'text-violet-200'}
      : data.messages>0
        ? {label:'Responder mensagens',detail:`${data.messages} mensagem(ns) não lida(s)`,href:'/app/conversas',tone:'text-emerald-200'}
        : data.notifications>0
          ? {label:'Ver novas atualizações',detail:`${data.notifications} notificação(ões) nova(s)`,href:'/app/notificacoes',tone:'text-amber-200'}
          : data.projects>0
            ? {label:'Acompanhar projeto',detail:`${data.projects} projeto(s) em andamento`,href:'/app/projetos',tone:'text-blue-200'}
            : {label:'Explorar serviços',detail:'Você está em dia. Veja o que podemos realizar agora.',href:'/servicos',tone:'text-gray-200'}

  const available=Math.max(0,(loyalty?.unlocked_cash||0)-(loyalty?.used_cash||0))
  const nextThreshold=loyalty?.level==='bronze'?settings?.silver_threshold:loyalty?.level==='silver'?settings?.gold_threshold:null
  const currentFloor=loyalty?.level==='silver'?(settings?.silver_threshold||0):0
  const progress=nextThreshold?Math.min(100,Math.max(0,((loyalty?.lifetime_service_spend||0)-currentFloor)/(nextThreshold-currentFloor)*100)):100

  return <div>
    <p className="text-[11px] uppercase tracking-[.18em] text-[#E30613] font-semibold">Minha Play Moments</p>
    <h1 className="text-2xl font-bold text-white mt-1">Olá, {user?.name}</h1>
    <p className="text-sm text-gray-500 mt-1 mb-6">Veja primeiro o que precisa da sua atenção.</p>

    {loading?<section role="status" aria-live="polite" className="mb-5 p-4 rounded-2xl bg-white/[.025] border border-white/10 text-sm text-gray-500">Organizando sua área…</section>:loadError?<section role="alert" className="mb-5 p-4 rounded-2xl bg-red-500/[.04] border border-red-500/15"><p className="text-sm font-semibold text-red-200">Algumas informações não puderam ser atualizadas.</p><p className="text-xs text-gray-500 mt-1">Você pode continuar navegando normalmente e tentar novamente ao recarregar.</p></section>:<section className="mb-5 p-4 rounded-2xl bg-white/[.025] border border-white/10">
      <div className="flex flex-wrap items-center justify-between gap-4"><div><p className="text-[10px] uppercase tracking-[.16em] text-gray-600 font-semibold">Próxima ação</p><p className={"text-base font-semibold mt-1 "+nextAction.tone}>{nextAction.label}</p><p className="text-xs text-gray-500 mt-1">{nextAction.detail}</p></div><Link to={nextAction.href} className="min-h-11 px-4 rounded-xl bg-[#E30613] text-white text-xs font-bold inline-flex items-center justify-center">Continuar →</Link></div>
    </section>}

    <div className="grid grid-cols-2 lg:grid-cols-3 gap-3 mb-6">{cards.map(([label,value,href,tone])=><Link key={String(label)} to={String(href)} className="p-4 rounded-2xl bg-[#141416] border border-white/10 hover:border-white/20 transition-colors"><p className={'text-2xl font-bold '+tone}>{value}</p><p className="text-xs text-gray-500 mt-1">{label}</p></Link>)}</div>

    <section className="mb-6 p-5 rounded-2xl bg-[#141416] border border-white/10">
      <div className="flex flex-wrap justify-between gap-4">
        <div>
          <p className="text-xs text-gray-500 uppercase tracking-wide">Seu nível</p>
          <h2 className="text-2xl font-bold mt-1">{rotulo(nivelCliente,loyalty?.level||'bronze')}</h2>
          <p className="text-sm text-gray-400 mt-1">Gasto acumulado em serviços: {money(loyalty?.lifetime_service_spend)}</p>
        </div>
        <div className="text-right">
          <p className="text-xs text-gray-500 uppercase tracking-wide">Play Cash disponível</p>
          <p className="text-2xl font-bold text-[#E30613] mt-1">{money(available)}</p>
          <p className="text-xs text-gray-500 mt-1">Crédito para descontos dentro da Play Moments</p>
        </div>
      </div>
      {nextThreshold&&<div className="mt-5">
        <div className="flex justify-between text-xs text-gray-500"><span>Progresso para o próximo nível</span><span>{Math.round(progress)}%</span></div>
        <div className="h-2 bg-white/10 rounded mt-2"><div className="h-2 bg-[#E30613] rounded" style={{width:progress+'%'}}/></div>
        <p className="text-xs text-gray-600 mt-2">Próximo nível em {money(nextThreshold)} de serviços pagos.</p>
      </div>}
    </section>

     <h2 className="font-bold mt-8 mb-3">Ações rápidas</h2>
    <div className="flex flex-wrap gap-3"><Link className="px-4 py-3 rounded-xl bg-[#E30613]" to="/app/conversas">Falar com a Play Moments</Link><Link className="px-4 py-3 rounded-xl bg-white/5" to="/app/projetos">Meus projetos</Link><Link className="px-4 py-3 rounded-xl bg-white/5" to="/app/arquivos">Arquivos</Link></div>
  </div>
}
