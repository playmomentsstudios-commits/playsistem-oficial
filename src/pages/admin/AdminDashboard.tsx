import { useEffect,useMemo,useState } from 'react'
import { Link } from 'react-router-dom'
import { CompactPageHeader } from '../../components/ui/CompactWorkspace'
import { useAuth } from '../../contexts/AuthContext'
import { portalApi } from '../../api/portal'
import { crmApi,type CrmCustomer } from '../../api/crm'
import { rotulo,statusProjeto } from '../../lib/labels.ptBR'

function money(cents:number){
  return ((cents||0)/100).toLocaleString('pt-BR',{style:'currency',currency:'BRL'})
}
function nameOf(customer:any){
  return [customer?.first_name,customer?.last_name].filter(Boolean).join(' ')||customer?.email||'Cliente'
}

export function AdminDashboard(){
  const {user}=useAuth()
  const [loading,setLoading]=useState(true)
  const [error,setError]=useState('')
  const [showDetails,setShowDetails]=useState(false)
  const [data,setData]=useState({
    customers:[] as any[],
    projects:[] as any[],
    orders:[] as any[],
    payments:[] as any[],
    quotes:[] as any[],
    crm:[] as CrmCustomer[],
    unread:{messages:0,notifications:0},
  })

  useEffect(()=>{
    if(!user)return
    let active=true
    async function load(){
      setLoading(true)
      setError('')
      const results=await Promise.allSettled([
        portalApi.customers(),
        portalApi.projects(),
        portalApi.orders(),
        portalApi.payments(),
        portalApi.quotes(),
        crmApi.list(),
        portalApi.unreadCounts(user!.id),
      ])
      if(!active)return
      const failed=results.filter(result=>result.status==='rejected').length
      if(failed===results.length){setError('Não foi possível carregar os dados operacionais do painel.')}
      else if(failed>0){setError('Alguns indicadores não puderam ser carregados. Os demais dados continuam disponíveis.')}
      const value=<T,>(index:number,fallback:T):T=>results[index].status==='fulfilled'?(results[index] as PromiseFulfilledResult<any>).value:fallback
      setData({
        customers:value(0,[]),
        projects:value(1,[]),
        orders:value(2,[]),
        payments:value(3,[]),
        quotes:value(4,[]),
        crm:value(5,[]),
        unread:value(6,{messages:0,notifications:0}),
      })
      setLoading(false)
    }
    void load()
    return()=>{active=false}
  },[user?.id])

  const now=Date.now()
  const metrics=useMemo(()=>({
    customers:data.customers.length,
    activeProjects:data.projects.filter((item:any)=>!['completed','cancelled'].includes(item.status)).length,
    openOrders:data.orders.filter((item:any)=>!['completed','cancelled'].includes(item.status)).length,
    pendingPayments:data.payments.filter((item:any)=>!item.archived_at&&['pending','awaiting_confirmation'].includes(item.status)).length,
    openQuotes:data.quotes.filter((item:any)=>['draft','sent','viewed','accepted'].includes(item.status)).length,
    unread:data.unread.messages,
    pipelineValue:data.crm.filter(item=>['quote','negotiation','won'].includes(item.stage)).reduce((sum,item)=>sum+(item.estimated_value||0),0),
    overdueActions:data.crm.filter(item=>item.next_action_at&&new Date(item.next_action_at).getTime()<now&&!['delivered','lost'].includes(item.stage)).length,
  }),[data,now])

  const latestProjects=useMemo(()=>[...data.projects]
    .filter((item:any)=>!['completed','cancelled'].includes(item.status))
    .sort((a:any,b:any)=>new Date(b.updated_at||b.created_at||0).getTime()-new Date(a.updated_at||a.created_at||0).getTime())
    .slice(0,5),[data.projects])


  const cards=[
    {label:'Projetos ativos',value:metrics.activeProjects,href:'/admin/projetos'},
    {label:'Orçamentos abertos',value:metrics.openQuotes,href:'/admin/orcamentos'},
    {label:'Pagamentos pendentes',value:metrics.pendingPayments,href:'/admin/pagamentos'},
    {label:'Mensagens',value:metrics.unread,href:'/admin/conversas'},
  ]
  const pending=[
    {label:'Retornos atrasados',value:metrics.overdueActions,href:'/admin/crm'},
    {label:'Pagamentos a conferir',value:metrics.pendingPayments,href:'/admin/pagamentos'},
    {label:'Mensagens não lidas',value:metrics.unread,href:'/admin/conversas'},
  ].filter(item=>item.value>0)

  if(loading)return <div aria-busy="true" aria-label="Carregando painel" className="space-y-4"><div className="pm-skeleton h-16 rounded-xl"/><div className="grid grid-cols-2 lg:grid-cols-4 gap-2">{Array.from({length:4}).map((_,i)=><div key={i} className="pm-skeleton h-24 rounded-xl"/>)}</div><div className="pm-skeleton h-48 rounded-xl"/></div>

  return <div className="space-y-4 max-w-[1400px]">
    <CompactPageHeader eyebrow="Visão geral" title="Seu espaço de trabalho" description="Acompanhe o essencial e continue de onde parou." actions={<Link to="/admin/projetos" className="pm-compact-tap rounded-lg bg-[#A65A2A] px-3 text-xs font-semibold text-white">Ver projetos →</Link>}/>
    {error&&<div role="status" className="p-3 rounded-xl border border-amber-500/20 text-sm text-amber-200">{error}</div>}

    <section aria-label="Indicadores principais" className="grid grid-cols-2 lg:grid-cols-4 gap-2">
      {cards.map(card=><Link key={card.label} to={card.href} className="pm-compact-card pm-compact-card-interactive min-h-[90px] flex flex-col justify-between gap-2">
        <div className="flex justify-between items-start gap-2"><span className="text-xs text-gray-400">{card.label}</span><span aria-hidden="true" className="text-gray-600">↗</span></div>
        <strong className="text-2xl font-semibold tracking-tight text-gray-100">{card.value}</strong>
      </Link>)}
    </section>

    <div className="grid gap-3 xl:grid-cols-[minmax(0,1.2fr)_minmax(0,1fr)]">
      <section className="pm-surface overflow-hidden" aria-label="Pendências">
        <div className="flex items-center justify-between p-4 border-b border-white/[.06]"><h2 className="text-sm font-semibold">Precisa de atenção</h2><span className="text-xs text-gray-500">{pending.length} {pending.length===1?'tipo de pendência':'tipos de pendência'}</span></div>
        {pending.length===0?<p className="p-4 text-sm text-gray-400">Tudo em dia por aqui.</p>:<div className="divide-y divide-white/[.05]">{pending.map(item=><Link key={item.label} to={item.href} className="flex items-center justify-between gap-3 px-4 py-3 hover:bg-white/[.03]"><span className="text-sm text-gray-300">{item.label}</span><span className="text-xs font-semibold text-[#DFA269]">{item.value} →</span></Link>)}</div>}
      </section>
      <section className="pm-surface overflow-hidden" aria-label="Projetos recentes">
        <div className="flex items-center justify-between p-4 border-b border-white/[.06]"><h2 className="text-sm font-semibold">Em andamento</h2><Link to="/admin/projetos" className="text-xs text-[#DFA269]">Ver todos →</Link></div>
        {latestProjects.length===0?<p className="p-4 text-sm text-gray-400">Nenhum projeto ativo.</p>:<div className="divide-y divide-white/[.05]">{latestProjects.slice(0,3).map((project:any)=><Link key={project.id} to={'/admin/projetos/'+project.id} className="flex items-center justify-between gap-3 px-4 py-3 hover:bg-white/[.03]"><span className="min-w-0 truncate text-sm text-gray-300">{project.title}</span><span className="shrink-0 text-[11px] text-gray-500">{rotulo(statusProjeto,String(project.status||'planning'))}</span></Link>)}</div>}
      </section>
    </div>

    <section className="pm-surface overflow-hidden">
      <button type="button" onClick={()=>setShowDetails(v=>!v)} aria-expanded={showDetails} className="w-full flex items-center justify-between gap-3 p-4 text-left hover:bg-white/[.03]">
        <span><strong className="block text-sm font-semibold">Mais indicadores</strong><span className="block text-xs text-gray-500 mt-1">Clientes, pedidos e oportunidades comerciais</span></span>
        <span aria-hidden="true" className="text-gray-400">{showDetails?'−':'+'}</span>
      </button>
      {showDetails&&<div className="border-t border-white/[.06] p-4 grid grid-cols-2 md:grid-cols-3 gap-3">
        <Link to="/admin/clientes" className="rounded-lg border border-white/[.07] p-3"><span className="block text-xs text-gray-500">Clientes</span><strong className="text-lg">{metrics.customers}</strong></Link>
        <Link to="/admin/pedidos" className="rounded-lg border border-white/[.07] p-3"><span className="block text-xs text-gray-500">Pedidos ativos</span><strong className="text-lg">{metrics.openOrders}</strong></Link>
        <Link to="/admin/crm" className="rounded-lg border border-white/[.07] p-3"><span className="block text-xs text-gray-500">Funil comercial</span><strong className="text-lg">{money(metrics.pipelineValue)}</strong></Link>
        <div className="col-span-2 md:col-span-3 flex flex-wrap gap-3 pt-1"><Link to="/admin/crm" className="text-xs text-[#DFA269]">Abrir CRM →</Link><Link to="/admin/orcamentos" className="text-xs text-[#DFA269]">Orçamentos →</Link></div>
      </div>}
    </section>
  </div>
}
