import { useEffect,useMemo,useState } from 'react'
import { Link } from 'react-router-dom'
import { useAuth } from '../../contexts/AuthContext'
import { portalApi } from '../../api/portal'
import { crmApi,CRM_STAGE_LABELS,type CrmCustomer } from '../../api/crm'
import { prioridadeProjeto,rotulo,statusOrcamento,statusProjeto } from '../../lib/labels.ptBR'

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
    {label:'Clientes',value:metrics.customers,href:'/admin/clientes',tone:'text-gray-100',hint:'base cadastrada'},
    {label:'Projetos ativos',value:metrics.activeProjects,href:'/admin/projetos',tone:'text-sky-400',hint:'em operação'},
    {label:'Pedidos ativos',value:metrics.openOrders,href:'/admin/pedidos',tone:'text-sky-400',hint:'em andamento'},
    {label:'Pagamentos pendentes',value:metrics.pendingPayments,href:'/admin/pagamentos',tone:metrics.pendingPayments?'text-amber-400':'text-emerald-400',hint:metrics.pendingPayments?'pedem conferência':'financeiro em dia'},
    {label:'Orçamentos abertos',value:metrics.openQuotes,href:'/admin/orcamentos',tone:'text-violet-400',hint:'oportunidades'},
    {label:'Mensagens não lidas',value:metrics.unread,href:'/admin/conversas',tone:metrics.unread?'text-emerald-400':'text-gray-100',hint:metrics.unread?'aguardando resposta':'caixa em dia'},
  ]

  if(loading)return <div aria-busy="true" aria-label="Carregando painel" className="space-y-5"><div className="pm-skeleton h-20 rounded-2xl"/><div className="grid grid-cols-2 lg:grid-cols-3 gap-3">{Array.from({length:6}).map((_,i)=><div key={i} className="pm-skeleton h-24 rounded-2xl"/>)}</div><div className="grid xl:grid-cols-3 gap-4">{Array.from({length:3}).map((_,i)=><div key={i} className="pm-skeleton h-64 rounded-2xl"/>)}</div></div>

  return <div>
    {error&&<div className="mb-4 p-4 rounded-xl border border-amber-500/20 bg-amber-500/5 text-sm text-amber-200">{error}</div>}
    <div className="flex flex-wrap items-start justify-between gap-4 mb-6">
      <div>
        <p className="text-[11px] uppercase tracking-[0.18em] text-[#A65A2A] font-semibold">Visão geral</p>
        <h1 className="text-2xl md:text-3xl font-bold mt-1">Painel administrativo</h1>
        <p className="text-sm text-gray-500 mt-1">Acompanhe operação, comercial e financeiro em uma única visão.</p>
      </div>
      <div className="flex flex-wrap gap-2">
        <Link to="/admin/projetos" className="min-h-11 px-4 rounded-xl border border-white/[0.08] bg-white/[0.025] hover:bg-white/[0.05] text-gray-300 text-sm font-semibold flex items-center justify-center">Ver operação</Link>
        <Link to="/admin/crm" className="min-h-11 px-4 rounded-xl bg-[#A65A2A] hover:bg-[#87441f] shadow-[0_8px_24px_rgba(166,90,42,.16)] text-white text-sm font-semibold flex items-center justify-center">Abrir CRM</Link>
      </div>
    </div>

    <div className="grid grid-cols-2 lg:grid-cols-3 xl:grid-cols-6 gap-2.5">
      {cards.map(card=><Link key={card.label} to={card.href} className="pm-surface pm-surface-interactive p-3.5 md:p-4 group relative overflow-hidden min-h-[108px]">
        <div className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-white/[0.08] to-transparent" />
        <div className="flex items-start justify-between gap-3"><p className="text-[10px] uppercase tracking-[0.12em] text-gray-500">{card.label}</p><span className="text-gray-700 group-hover:text-gray-300 transition-colors" aria-hidden="true">↗</span></div>
        <p className={'text-2xl font-bold mt-2.5 '+card.tone}>{card.value}</p>
        <p className="text-[10px] text-gray-600 mt-1.5">{card.hint}</p>
      </Link>)}
    </div>

    {(metrics.pendingPayments>0||metrics.overdueActions>0||metrics.unread>0)&&<div className="mt-4 p-4 rounded-2xl border border-amber-500/15 bg-amber-500/[0.035] flex flex-wrap items-center gap-3">
      <div className="min-w-0 flex-1"><p className="text-sm font-semibold text-amber-100">Pontos que pedem atenção</p><p className="text-xs text-gray-500 mt-1">{[metrics.pendingPayments&&`${metrics.pendingPayments} pagamento(s) pendente(s)`,metrics.overdueActions&&`${metrics.overdueActions} retorno(s) comercial(is) atrasado(s)`,metrics.unread&&`${metrics.unread} mensagem(ns) não lida(s)`].filter(Boolean).join(' · ')}</p></div>
      <Link to={metrics.overdueActions?'/admin/crm':metrics.pendingPayments?'/admin/pagamentos':'/admin/conversas'} className="text-xs font-semibold text-amber-300 hover:text-amber-200">Resolver agora →</Link>
    </div>}

    <div className="grid md:grid-cols-2 gap-2.5 mt-2.5">
      <Link to="/admin/crm" className="pm-surface p-4">
        <p className="text-[10px] uppercase text-gray-500">Funil comercial em negociação</p>
        <p className="text-xl font-bold text-[#A65A2A] mt-2">{money(metrics.pipelineValue)}</p>
        <p className="text-xs text-gray-600 mt-1">Orçamentos, negociações e clientes fechados no CRM</p>
      </Link>
      <Link to="/admin/crm" className="pm-surface p-4">
        <p className="text-[10px] uppercase text-gray-500">Próximas ações atrasadas</p>
        <p className={'text-xl font-bold mt-2 '+(metrics.overdueActions?'text-orange-400':'text-emerald-400')}>{metrics.overdueActions}</p>
        <p className="text-xs text-gray-600 mt-1">Clientes que já deveriam ter recebido retorno</p>
      </Link>
    </div>

    <div className="grid xl:grid-cols-3 gap-4 mt-6">
      <section className="pm-surface overflow-hidden">
        <div className="p-4 md:p-5 border-b border-white/8 flex items-center justify-between gap-3">
          <div><p className="text-[10px] uppercase tracking-[0.14em] text-gray-600">Comercial</p><h2 className="font-semibold mt-1">Próximas ações</h2></div>
          <Link to="/admin/crm" className="text-xs text-[#ff5364] hover:text-[#ff7a86]">Funil comercial →</Link>
        </div>
        <div className="divide-y divide-white/[0.05]">
          {attention.length===0?<div className="p-5"><p className="text-sm text-gray-400">Agenda comercial em dia.</p><p className="text-xs text-gray-600 mt-1">Nenhum retorno programado exige atenção agora.</p></div>:attention.map(item=>{
            const overdue=item.next_action_at&&new Date(item.next_action_at).getTime()<now
            return <Link key={item.customer_id} to={'/admin/clientes/'+item.customer_id} className="block p-4 hover:bg-white/[0.025] transition-colors">
              <div className="flex justify-between gap-3">
                <div className="min-w-0"><p className="text-sm font-semibold truncate">{nameOf(item.customer)}</p><p className="text-xs text-gray-500 mt-1 truncate">{item.next_action||'Próximo contato'}</p></div>
                <span className={'text-[10px] shrink-0 px-2 py-1 h-fit rounded-full '+(overdue?'bg-amber-500/10 text-amber-300':'bg-white/[0.04] text-gray-500')}>{item.next_action_at?new Date(item.next_action_at).toLocaleDateString('pt-BR'):''}</span>
              </div>
              <p className="text-[10px] text-[#ff5364] mt-2">{CRM_STAGE_LABELS[item.stage]}</p>
            </Link>
          })}
        </div>
      </section>

      <section className="pm-surface overflow-hidden">
        <div className="p-4 md:p-5 border-b border-white/8 flex items-center justify-between">
          <div><p className="text-[10px] uppercase tracking-[0.14em] text-gray-600">Operação</p><h2 className="font-semibold mt-1">Projetos ativos</h2></div>
          <Link to="/admin/projetos" className="text-xs text-[#ff5364] hover:text-[#ff7a86]">Todos →</Link>
        </div>
        <div className="divide-y divide-white/[0.05]">
          {latestProjects.length===0?<div className="p-5"><p className="text-sm text-gray-400">Nenhum projeto ativo.</p><p className="text-xs text-gray-600 mt-1">Novos projetos aparecerão aqui automaticamente.</p></div>:latestProjects.map((project:any)=>{
            const status=String(project.status||'planning')
            const statusTone=status==='review'?'bg-violet-500/10 text-violet-300':status==='in_progress'?'bg-sky-500/10 text-sky-300':'bg-white/[0.04] text-gray-400'
            return <Link key={project.id} to={'/admin/projetos/'+project.id} className="block p-4 hover:bg-white/[0.025] transition-colors">
              <div className="flex items-start justify-between gap-3"><p className="text-sm font-semibold truncate">{project.title}</p><span className={'text-[9px] uppercase tracking-wide px-2 py-1 rounded-full shrink-0 '+statusTone}>{rotulo(statusProjeto,status)}</span></div>
              <div className="flex gap-3 mt-2 text-[10px] text-gray-600"><span>Prioridade: {rotulo(prioridadeProjeto,project.priority||'normal')}</span>{project.due_date&&<span>Prazo: {new Date(project.due_date+'T12:00:00').toLocaleDateString('pt-BR')}</span>}</div>
            </Link>
          })}
        </div>
      </section>

      <section className="pm-surface overflow-hidden">
        <div className="p-4 md:p-5 border-b border-white/8 flex items-center justify-between">
          <div><p className="text-[10px] uppercase tracking-[0.14em] text-gray-600">Vendas</p><h2 className="font-semibold mt-1">Orçamentos em aberto</h2></div>
          <Link to="/admin/orcamentos" className="text-xs text-[#ff5364] hover:text-[#ff7a86]">Todos →</Link>
        </div>
        <div className="divide-y divide-white/[0.05]">
          {latestQuotes.length===0?<div className="p-5"><p className="text-sm text-gray-400">Nenhum orçamento em aberto.</p><p className="text-xs text-gray-600 mt-1">Sua fila comercial está limpa neste momento.</p></div>:latestQuotes.map((quote:any)=>{
            const quoteTone=quote.status==='accepted'?'bg-emerald-500/10 text-emerald-300':quote.status==='viewed'?'bg-sky-500/10 text-sky-300':'bg-violet-500/10 text-violet-300'
            return <Link key={quote.id} to={'/admin/orcamentos/'+quote.id} className="block p-4 hover:bg-white/[0.025] transition-colors">
              <div className="flex justify-between gap-3"><p className="text-sm font-semibold truncate">{quote.title||quote.quote_number||'Orçamento'}</p><span className={'text-[9px] uppercase px-2 py-1 rounded-full shrink-0 '+quoteTone}>{rotulo(statusOrcamento,quote.status)}</span></div>
              <p className="text-sm font-semibold text-gray-300 mt-2">{quote.total?money(quote.total):'Valor não informado'}</p>
            </Link>
          })}
        </div>
      </section>
    </div>
  </div>
}
