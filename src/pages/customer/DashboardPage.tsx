import { useEffect,useState } from 'react'
import { Link } from 'react-router-dom'
import { useAuth } from '../../contexts/AuthContext'
import { portalApi } from '../../api/portal'
import { nivelCliente,rotulo } from '../../lib/labels.ptBR'
import { CompactPageHeader,CompactDisclosure } from '../../components/ui/CompactWorkspace'

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
    <CompactPageHeader eyebrow="Minha área Sagamente" title={'Olá, '+(user?.name||'')} description="Seu resumo e próximos passos." />

    {loading?<section role="status" aria-live="polite" className="mb-5 p-4 rounded-2xl bg-white/[.025] border border-white/10 text-sm text-gray-500">Organizando sua área…</section>:loadError?<section role="alert" className="mb-5 p-4 rounded-2xl bg-red-500/[.04] border border-red-500/15"><p className="text-sm font-semibold text-red-200">Algumas informações não puderam ser atualizadas.</p><p className="text-xs text-gray-500 mt-1">Você pode continuar navegando normalmente e tentar novamente ao recarregar.</p></section>:<section className="pm-compact-card mb-3">
      <div className="flex flex-wrap items-center justify-between gap-2"><div><p className="text-[10px] uppercase tracking-[.16em] text-gray-600 font-semibold">Próxima ação</p><p className={"text-base font-semibold mt-1 "+nextAction.tone}>{nextAction.label}</p><p className="text-xs text-gray-500 mt-1">{nextAction.detail}</p></div><Link to={nextAction.href} className="pm-compact-tap rounded-lg bg-[#A65A2A] px-3 text-xs font-bold text-white">Continuar →</Link></div>
    </section>}

    <div className="mb-3 grid grid-cols-2 gap-2 sm:grid-cols-3 xl:grid-cols-6">{cards.map(([label,value,href,tone])=><Link key={String(label)} to={String(href)} className="pm-compact-card pm-compact-card-interactive flex min-h-[78px] flex-col justify-center"><p className={'text-xl font-bold '+tone}>{value}</p><p className="text-[11px] leading-4 text-gray-400">{label}</p></Link>)}</div>

    <CompactDisclosure title="Benefícios e Play Cash" summary={money(available)+' disponível'}>
      <div className="flex flex-wrap justify-between gap-3">
        <div>
          <p className="text-[11px] text-gray-500">Seu nível</p>
          <p className="font-semibold">{rotulo(nivelCliente,loyalty?.level||'bronze')}</p>
          <p className="text-[11px] text-gray-400">Gasto acumulado: {money(loyalty?.lifetime_service_spend)}</p>
        </div>
        <div className="text-right">
          <p className="text-[11px] text-gray-500">Play Cash disponível</p>
          <p className="text-lg font-bold text-[#A65A2A]">{money(available)}</p>
        </div>
      </div>
      {nextThreshold&&<div className="mt-3">
        <div className="flex justify-between text-[11px] text-gray-400"><span>Próximo nível</span><span>{Math.round(progress)}%</span></div>
        <div className="mt-1.5 h-1.5 overflow-hidden rounded bg-white/10"><div className="h-full rounded bg-[#A65A2A]" style={{width:progress+'%'}}/></div>
        <p className="mt-1 text-[11px] text-gray-500">Próximo nível em {money(nextThreshold)} de serviços pagos.</p>
      </div>}
    </CompactDisclosure>

     <h2 className="pm-compact-section-title mt-4 mb-2">Ações rápidas</h2>
    <div className="flex flex-wrap gap-3"><Link className="pm-compact-tap px-3 rounded-lg bg-[#A65A2A]" to="/app/conversas">Falar com a Sagamente</Link><Link className="pm-compact-tap px-3 rounded-lg bg-white/5" to="/app/projetos">Meus projetos</Link><Link className="pm-compact-tap px-3 rounded-lg bg-white/5" to="/app/arquivos">Arquivos</Link></div>
  </div>
}
