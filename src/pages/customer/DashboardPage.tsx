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
    ['Projetos ativos',data.projects,'📈','/app/projetos'],
    ['Pedidos ativos',data.orders,'📦','/app/pedidos'],
    ['Pagamentos pendentes',data.payments,'💳','/app/pagamentos'],
    ['Orçamentos',data.quotes,'📋','/app/orcamentos'],
    ['Mensagens não lidas',data.messages,'💬','/app/conversas'],
    ['Notificações',data.notifications,'🔔','/app/notificacoes'],
  ]

  const available=Math.max(0,(loyalty?.unlocked_cash||0)-(loyalty?.used_cash||0))
  const nextThreshold=loyalty?.level==='bronze'?settings?.silver_threshold:loyalty?.level==='silver'?settings?.gold_threshold:null
  const currentFloor=loyalty?.level==='silver'?(settings?.silver_threshold||0):0
  const progress=nextThreshold?Math.min(100,Math.max(0,((loyalty?.lifetime_service_spend||0)-currentFloor)/(nextThreshold-currentFloor)*100)):100

  return <div>
    <h1 className="text-2xl font-bold text-white">Olá, {user?.name} 👋</h1>
    <p className="text-sm text-gray-500 mt-1 mb-7">Acompanhe seus trabalhos com a Play Moments.</p>

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

    <div className="grid grid-cols-2 lg:grid-cols-3 gap-4">{cards.map(([label,value,icon,href])=><Link key={String(label)} to={String(href)} className="p-5 rounded-2xl bg-[#141416] border border-white/10"><span className="text-2xl">{icon}</span><p className="text-2xl font-bold text-[#E30613] mt-3">{value}</p><p className="text-xs text-gray-500">{label}</p></Link>)}</div>

    <h2 className="font-bold mt-8 mb-3">Ações rápidas</h2>
    <div className="flex flex-wrap gap-3"><Link className="px-4 py-3 rounded-xl bg-[#E30613]" to="/app/conversas">Falar com a Play Moments</Link><Link className="px-4 py-3 rounded-xl bg-white/5" to="/app/projetos">Meus projetos</Link><Link className="px-4 py-3 rounded-xl bg-white/5" to="/app/arquivos">Arquivos</Link></div>
  </div>
}
