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

  useEffect(()=>{
    if(!user)return
    void portalApi.ensureClientDriveFolder(user.id).catch(()=>undefined)
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
    }).catch(()=>undefined)
  },[user?.id])

  const cards=[
    ['Projetos ativos',data.projects,'/app/projetos','text-blue-300'],
    ['Pedidos ativos',data.orders,'/app/pedidos','text-blue-300'],
    ['Pagamentos pendentes',data.payments,'/app/pagamentos',data.payments?'text-amber-300':'text-emerald-300'],
    ['Orçamentos aguardando você',data.quotes,'/app/orcamentos',data.quotes?'text-violet-300':'text-gray-300'],
    ['Mensagens não lidas',data.messages,'/app/conversas',data.messages?'text-emerald-300':'text-gray-300'],
    ['Notificações',data.notifications,'/app/notificacoes',data.notifications?'text-amber-300':'text-gray-300'],
  ]

  const available=Math.max(0,(loyalty?.unlocked_cash||0)-(loyalty?.used_cash||0))
  const nextThreshold=loyalty?.level==='bronze'?settings?.silver_threshold:loyalty?.level==='silver'?settings?.gold_threshold:null
  const currentFloor=loyalty?.level==='silver'?(settings?.silver_threshold||0):0
  const progress=nextThreshold?Math.min(100,Math.max(0,((loyalty?.lifetime_service_spend||0)-currentFloor)/(nextThreshold-currentFloor)*100)):100

  return <div>
    <p className="text-[11px] uppercase tracking-[.18em] text-[#E30613] font-semibold">Minha Play Moments</p>
    <h1 className="text-2xl font-bold text-white mt-1">Olá, {user?.name}</h1>
    <p className="text-sm text-gray-500 mt-1 mb-6">Veja primeiro o que precisa da sua atenção.</p>

    {(data.payments+data.quotes+data.messages+data.notifications)>0&&<section className="mb-5 p-4 rounded-2xl bg-amber-500/[0.04] border border-amber-500/15">
      <div className="flex flex-wrap items-center justify-between gap-3"><div><p className="text-sm font-semibold text-amber-100">Você tem ações pendentes</p><p className="text-xs text-gray-500 mt-1">Pagamentos, propostas, mensagens ou notificações aguardando sua atenção.</p></div><div className="flex flex-wrap gap-2">{data.payments>0&&<Link to="/app/pagamentos" className="px-3 py-2 rounded-lg bg-amber-500/10 text-amber-200 text-xs">{data.payments} pagamento(s)</Link>}{data.quotes>0&&<Link to="/app/orcamentos" className="px-3 py-2 rounded-lg bg-violet-500/10 text-violet-200 text-xs">{data.quotes} orçamento(s)</Link>}{data.messages>0&&<Link to="/app/conversas" className="px-3 py-2 rounded-lg bg-emerald-500/10 text-emerald-200 text-xs">{data.messages} mensagem(ns)</Link>}</div></div>
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
