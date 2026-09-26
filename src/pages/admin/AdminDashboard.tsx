import { useEffect,useMemo,useState } from 'react'
import { Link } from 'react-router-dom'
import { useAuth } from '../../contexts/AuthContext'
import { portalApi } from '../../api/portal'
import { crmApi,CRM_STAGE_LABELS,type CrmCustomer } from '../../api/crm'

function money(cents:number){
  return ((cents||0)/100).toLocaleString('pt-BR',{style:'currency',currency:'BRL'})
}
function nameOf(customer:any){
  return [customer?.first_name,customer?.last_name].filter(Boolean).join(' ')||customer?.email||'Cliente'
}

export function AdminDashboard(){
  const {user}=useAuth()
  const [loading,setLoading]=useState(true)
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
    pendingPayments:data.payments.filter((item:any)=>['pending','awaiting_confirmation'].includes(item.status)).length,
    openQuotes:data.quotes.filter((item:any)=>['draft','sent','viewed','accepted'].includes(item.status)).length,
    unread:data.unread.messages,
    pipelineValue:data.crm.filter(item=>['quote','negotiation','won'].includes(item.stage)).reduce((sum,item)=>sum+(item.estimated_value||0),0),
    overdueActions:data.crm.filter(item=>item.next_action_at&&new Date(item.next_action_at).getTime()<now&&!['delivered','lost'].includes(item.stage)).length,
  }),[data,now])

  const attention=useMemo(()=>data.crm
    .filter(item=>item.next_action_at&&!['delivered','lost'].includes(item.stage))
    .sort((a,b)=>new Date(a.next_action_at||0).getTime()-new Date(b.next_action_at||0).getTime())
    .slice(0,6),[data.crm])

  const latestProjects=useMemo(()=>[...data.projects]
    .filter((item:any)=>!['completed','cancelled'].includes(item.status))
    .sort((a:any,b:any)=>new Date(b.updated_at||b.created_at||0).getTime()-new Date(a.updated_at||a.created_at||0).getTime())
    .slice(0,5),[data.projects])

  const latestQuotes=useMemo(()=>[...data.quotes]
    .filter((item:any)=>['draft','sent','viewed','accepted'].includes(item.status))
    .sort((a:any,b:any)=>new Date(b.updated_at||b.created_at||0).getTime()-new Date(a.updated_at||a.created_at||0).getTime())
    .slice(0,5),[data.quotes])

  const cards=[
    ['Clientes',metrics.customers,'/admin/clientes'],
    ['Projetos ativos',metrics.activeProjects,'/admin/projetos'],
    ['Pedidos ativos',metrics.openOrders,'/admin/pedidos'],
    ['Pagamentos pendentes',metrics.pendingPayments,'/admin/pagamentos'],
    ['Orçamentos abertos',metrics.openQuotes,'/admin/orcamentos'],
    ['Mensagens não lidas',metrics.unread,'/admin/conversas'],
  ] as const

  if(loading)return <div className="py-20 text-center text-sm text-gray-500">Carregando operação...</div>

  return <div>
    <div className="flex flex-wrap items-start justify-between gap-4 mb-6">
      <div>
        <p className="text-[11px] uppercase tracking-[0.18em] text-[#E30613] font-semibold">Operação</p>
        <h1 className="text-2xl font-bold mt-1">Painel Play Moments</h1>
        <p className="text-sm text-gray-500 mt-1">O que precisa de atenção agora, sem precisar abrir módulo por módulo.</p>
      </div>
      <Link to="/admin/crm" className="min-h-11 px-4 rounded-xl bg-[#E30613] text-white text-sm font-semibold flex items-center">Abrir CRM comercial</Link>
    </div>

    <div className="grid grid-cols-2 lg:grid-cols-3 gap-3">
      {cards.map(([label,value,href])=><Link key={label} to={href} className="p-4 rounded-2xl bg-[#141416] border border-white/10 hover:border-white/15 transition-colors">
        <p className="text-[10px] uppercase tracking-wide text-gray-500">{label}</p>
        <p className="text-2xl font-bold mt-2">{value}</p>
      </Link>)}
    </div>

    <div className="grid md:grid-cols-2 gap-3 mt-3">
      <Link to="/admin/crm" className="p-4 rounded-2xl bg-[#141416] border border-white/10">
        <p className="text-[10px] uppercase text-gray-500">Pipeline em negociação</p>
        <p className="text-xl font-bold text-[#E30613] mt-2">{money(metrics.pipelineValue)}</p>
        <p className="text-xs text-gray-600 mt-1">Orçamentos, negociações e clientes fechados no CRM</p>
      </Link>
      <Link to="/admin/crm" className="p-4 rounded-2xl bg-[#141416] border border-white/10">
        <p className="text-[10px] uppercase text-gray-500">Próximas ações atrasadas</p>
        <p className={'text-xl font-bold mt-2 '+(metrics.overdueActions?'text-orange-400':'text-emerald-400')}>{metrics.overdueActions}</p>
        <p className="text-xs text-gray-600 mt-1">Clientes que já deveriam ter recebido retorno</p>
      </Link>
    </div>

    <div className="grid xl:grid-cols-3 gap-4 mt-6">
      <section className="xl:col-span-1 rounded-2xl bg-[#141416] border border-white/10 overflow-hidden">
        <div className="p-4 border-b border-white/8 flex items-center justify-between gap-3">
          <div><h2 className="font-semibold">Próximas ações</h2><p className="text-[10px] text-gray-500 mt-1">CRM comercial</p></div>
          <Link to="/admin/crm" className="text-xs text-[#E30613]">Ver pipeline</Link>
        </div>
        <div>
          {attention.length===0?<p className="p-4 text-xs text-gray-600">Nenhuma próxima ação cadastrada.</p>:attention.map(item=>{
            const overdue=item.next_action_at&&new Date(item.next_action_at).getTime()<now
            return <Link key={item.customer_id} to={'/admin/clientes/'+item.customer_id} className="block p-4 border-b border-white/6 last:border-b-0 hover:bg-white/[0.025]">
              <div className="flex justify-between gap-3">
                <div className="min-w-0"><p className="text-sm font-semibold truncate">{nameOf(item.customer)}</p><p className="text-[10px] text-gray-500 mt-1 truncate">{item.next_action}</p></div>
                <span className={'text-[10px] shrink-0 '+(overdue?'text-orange-400':'text-gray-500')}>{item.next_action_at?new Date(item.next_action_at).toLocaleDateString('pt-BR'):''}</span>
              </div>
              <p className="text-[10px] text-[#E30613] mt-2">{CRM_STAGE_LABELS[item.stage]}</p>
            </Link>
          })}
        </div>
      </section>

      <section className="rounded-2xl bg-[#141416] border border-white/10 overflow-hidden">
        <div className="p-4 border-b border-white/8 flex items-center justify-between"><h2 className="font-semibold">Projetos ativos</h2><Link to="/admin/projetos" className="text-xs text-[#E30613]">Ver todos</Link></div>
        {latestProjects.length===0?<p className="p-4 text-xs text-gray-600">Nenhum projeto ativo.</p>:latestProjects.map((project:any)=><Link key={project.id} to={'/admin/projetos/'+project.id} className="block p-4 border-b border-white/6 last:border-b-0 hover:bg-white/[0.025]"><p className="text-sm font-semibold truncate">{project.title}</p><p className="text-[10px] text-gray-500 mt-1">{project.status||'Sem status'} · {project.priority||'sem prioridade'}</p></Link>)}
      </section>

      <section className="rounded-2xl bg-[#141416] border border-white/10 overflow-hidden">
        <div className="p-4 border-b border-white/8 flex items-center justify-between"><h2 className="font-semibold">Orçamentos recentes</h2><Link to="/admin/orcamentos" className="text-xs text-[#E30613]">Ver todos</Link></div>
        {latestQuotes.length===0?<p className="p-4 text-xs text-gray-600">Nenhum orçamento em aberto.</p>:latestQuotes.map((quote:any)=><Link key={quote.id} to={'/admin/orcamentos/'+quote.id} className="block p-4 border-b border-white/6 last:border-b-0 hover:bg-white/[0.025]"><div className="flex justify-between gap-3"><p className="text-sm font-semibold truncate">{quote.title||quote.quote_number||'Orçamento'}</p><span className="text-[10px] text-[#E30613] shrink-0">{quote.status}</span></div><p className="text-[10px] text-gray-500 mt-1">{quote.total?money(quote.total):'Valor não informado'}</p></Link>)}
      </section>
    </div>
  </div>
}
