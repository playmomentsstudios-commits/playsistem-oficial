import { useEffect,useMemo,useState } from 'react'
import { Link } from 'react-router-dom'
import { CompactPageHeader } from '../../components/ui/CompactWorkspace'
import { useAuth } from '../../contexts/AuthContext'
import { portalApi } from '../../api/portal'
import { crmApi,type CrmCustomer } from '../../api/crm'
import { rotulo,statusProjeto } from '../../lib/labels.ptBR'
import { DASHBOARD_METRICS,DASHBOARD_SHORTCUTS,DEFAULT_DASHBOARD_LAYOUT,loadDashboardLayout,type DashboardLayout } from '../../lib/adminDashboardLayout'

function money(cents:number){
  return ((cents||0)/100).toLocaleString('pt-BR',{style:'currency',currency:'BRL'})
}
function nameOf(customer:any){
  return [customer?.first_name,customer?.last_name].filter(Boolean).join(' ')||customer?.email||'Cliente'
}

const SHORTCUT_ICON_PATHS:Record<string,string>={
  users:'M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2m7-10a4 4 0 1 0 0-8 4 4 0 0 0 0 8m12 8v-2a4 4 0 0 0-3-3.87M16 3.13a4 4 0 0 1 0 7.75',
  academy:'M4 5h16v14H4V5Zm4 4 4 3 4-3v6l-4 3-4-3V9',
  unlock:'M7 10V7a5 5 0 0 1 10 0M5 10h14v11H5zM12 14v3',
  books:'M5 3h11a3 3 0 0 1 3 3v15H7a3 3 0 0 1-3-3V4m0 12a3 3 0 0 1 3-3h12M8 7h7',
  globe:'M3 5h18v14H3V5Zm0 4h18M7 7h.01M10 7h.01',
  folder:'M3 6h7l2 3h9v11H3V6Z',
  check:'M4 12l5 5L20 6M4 4h13',
  file:'M6 3h9l4 4v14H6zM15 3v5h4M9 13h7M9 17h7',
  briefcase:'M3 7h18v13H3V7Zm5 0V5a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2M3 13h18M10 13v2h4v-2',
  wallet:'M3 7h17v13H3zM3 7V4h14M15 13h5v4h-5a2 2 0 0 1 0-4Z',
  chat:'M4 5h16v12H8l-4 3V5Z',
  settings:'M12 15.5a3.5 3.5 0 1 0 0-7 3.5 3.5 0 0 0 0 7Zm8.5-3.5 2-1.5-2-3.5-2.4 1A8 8 0 0 0 16 6l-.4-3h-4L11 6a8 8 0 0 0-2 1L6.5 6l-2 3.5 2 1.5a8 8 0 0 0 0 2l-2 1.5 2 3.5L9 17a8 8 0 0 0 2 1l.5 3h4l.5-3a8 8 0 0 0 2-1l2.5 1 2-3.5-2-1.5a8 8 0 0 0 0-2Z',
}
function ShortcutIcon({name}:{name:string}){
  return <svg width="21" height="21" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d={SHORTCUT_ICON_PATHS[name]||SHORTCUT_ICON_PATHS.folder}/></svg>
}

export function AdminDashboard(){
  const {user}=useAuth()
  const [loading,setLoading]=useState(true)
  const [error,setError]=useState('')
  const [showDetails,setShowDetails]=useState(false)
  const [layout,setLayout]=useState<DashboardLayout>(DEFAULT_DASHBOARD_LAYOUT)
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

  useEffect(()=>{
    if(!user?.id||user.role!=='admin')return
    let active=true
    async function refresh(){
      try{const saved=await loadDashboardLayout();if(active)setLayout(saved)}
      catch{ /* Falha de rede: mantém a configuração padrão sem bloquear a página. */ }
    }
    void refresh()
    window.addEventListener('sagamente:dashboard-layout-updated',refresh)
    return()=>{active=false;window.removeEventListener('sagamente:dashboard-layout-updated',refresh)}
  },[user?.id,user?.role])

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


  const activeLayout:DashboardLayout=user?.role==='admin'?layout:{
    shortcuts:[],
    widgets:['indicators','pending','projects','extra'],
    metrics:['activeProjects','openQuotes','pendingPayments','unread'],
  }
  const cards=activeLayout.metrics.map(id=>{
    const descriptor=DASHBOARD_METRICS.find(item=>item.id===id)
    return descriptor?{...descriptor,value:metrics[id as keyof typeof metrics]}:null
  }).filter((item):item is NonNullable<typeof item>=>item!==null)
  const shortcuts=activeLayout.shortcuts.map(id=>DASHBOARD_SHORTCUTS.find(item=>item.id===id))
    .filter((item):item is (typeof DASHBOARD_SHORTCUTS)[number]=>Boolean(item))

  const pending=[
    {label:'Retornos atrasados',value:metrics.overdueActions,href:'/admin/crm'},
    {label:'Pagamentos a conferir',value:metrics.pendingPayments,href:'/admin/pagamentos'},
    {label:'Mensagens não lidas',value:metrics.unread,href:'/admin/conversas'},
  ].filter(item=>item.value>0)

  if(loading)return <div aria-busy="true" aria-label="Carregando painel" className="space-y-4"><div className="pm-skeleton h-16 rounded-xl"/><div className="grid grid-cols-2 lg:grid-cols-4 gap-2">{Array.from({length:4}).map((_,i)=><div key={i} className="pm-skeleton h-24 rounded-xl"/>)}</div><div className="pm-skeleton h-48 rounded-xl"/></div>

  return <div className="max-w-[1400px] space-y-4">
    <CompactPageHeader eyebrow="Visão geral" title="Seu espaço de trabalho" description="Acesse o que mais utiliza e acompanhe suas prioridades."
      actions={user?.role==='admin'
        ?<Link to="/admin/configuracoes#painel" className="pm-compact-tap inline-flex items-center gap-2 rounded-lg border border-[#A65A2A]/40 bg-[#A65A2A]/15 px-3 text-xs font-semibold text-[#DFA269]">⚙ Personalizar painel</Link>
        :<Link to="/admin/projetos" className="pm-compact-tap rounded-lg bg-[#A65A2A] px-3 text-xs font-semibold text-white">Ver projetos →</Link>}/>
    {error&&<div role="status" className="rounded-xl border border-amber-500/20 p-3 text-sm text-amber-200">{error}</div>}

    {activeLayout.widgets.length===0&&<div className="pm-surface p-5 text-sm text-gray-400">
      Nenhuma seção selecionada. <Link to="/admin/configuracoes#painel" className="text-[#DFA269] underline">Personalizar painel</Link>
    </div>}

    {activeLayout.widgets.map(widget=>{
      if(widget==='quick-actions')return <section key={widget} aria-label="Acessos rápidos" className="pm-surface p-4">
        <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
          <div><h2 className="text-sm font-semibold text-gray-100">Acessos rápidos</h2><p className="mt-1 text-xs text-gray-500">Suas ferramentas, a um toque.</p></div>
          <Link to="/admin/configuracoes#painel" aria-label="Editar acessos rápidos" className="text-xs font-semibold text-[#DFA269]">Editar ↗</Link>
        </div>
        {shortcuts.length>0?<div className="grid grid-cols-3 gap-2 md:grid-cols-4 xl:grid-cols-6">
          {shortcuts.map(shortcut=><Link key={shortcut.id} to={shortcut.href} title={shortcut.description}
            className="flex min-h-[105px] flex-col items-center justify-center gap-2 rounded-xl border border-white/[.07] bg-white/[.025] px-2 py-3 text-center transition-colors hover:border-[#A65A2A]/40 hover:bg-[#A65A2A]/[.06] focus-visible:outline focus-visible:outline-2 focus-visible:outline-[#DFA269]">
            <span className="flex h-9 w-9 items-center justify-center rounded-lg bg-[#A65A2A]/[.1] text-[#DFA269]"><ShortcutIcon name={shortcut.icon}/></span>
            <span className="text-[11px] font-semibold leading-tight text-gray-200 sm:text-xs">{shortcut.label}</span>
          </Link>)}
        </div>:<p className="py-3 text-sm text-gray-500">Nenhum atalho selecionado. Use Editar para incluir atalhos.</p>}
      </section>

      if(widget==='indicators')return <section key={widget} aria-label="Indicadores principais">
        <div className="mb-2 flex items-center justify-between gap-2"><h2 className="text-sm font-semibold">Indicadores</h2><Link to="/admin/configuracoes#painel" className="text-xs text-[#DFA269]">Configurar ↗</Link></div>
        {cards.length>0?<div className="grid grid-cols-2 gap-2 lg:grid-cols-4">
          {cards.map(card=><Link key={card.id} to={card.href} className="pm-compact-card pm-compact-card-interactive flex min-h-[90px] flex-col justify-between gap-2">
            <div className="flex items-start justify-between gap-2"><span className="text-xs text-gray-400">{card.label}</span><span aria-hidden="true" className="text-gray-600">↗</span></div>
            <strong className="text-2xl font-semibold tracking-tight text-gray-100">{card.value}</strong>
          </Link>)}
        </div>:<p className="text-xs text-gray-500">Escolha os indicadores nas configurações.</p>}
      </section>

      if(widget==='pending')return <section key={widget} className="pm-surface overflow-hidden" aria-label="Pendências">
        <div className="flex items-center justify-between border-b border-white/[.06] p-4"><h2 className="text-sm font-semibold">Precisa de atenção</h2><span className="text-xs text-gray-500">{pending.length} {pending.length===1?'tipo de pendência':'tipos de pendência'}</span></div>
        {pending.length===0?<p className="p-4 text-sm text-gray-400">Tudo em dia por aqui.</p>:<div className="divide-y divide-white/[.05]">{pending.map(item=><Link key={item.label} to={item.href} className="flex items-center justify-between gap-3 px-4 py-3 hover:bg-white/[.03]"><span className="text-sm text-gray-300">{item.label}</span><span className="text-xs font-semibold text-[#DFA269]">{item.value} →</span></Link>)}</div>}
      </section>

      if(widget==='projects')return <section key={widget} className="pm-surface overflow-hidden" aria-label="Projetos recentes">
        <div className="flex items-center justify-between border-b border-white/[.06] p-4"><h2 className="text-sm font-semibold">Em andamento</h2><Link to="/admin/projetos" className="text-xs text-[#DFA269]">Ver todos →</Link></div>
        {latestProjects.length===0?<p className="p-4 text-sm text-gray-400">Nenhum projeto ativo.</p>:<div className="divide-y divide-white/[.05]">{latestProjects.slice(0,3).map((project:any)=><Link key={project.id} to={'/admin/projetos/'+project.id} className="flex items-center justify-between gap-3 px-4 py-3 hover:bg-white/[.03]"><span className="min-w-0 truncate text-sm text-gray-300">{project.title}</span><span className="shrink-0 text-[11px] text-gray-500">{rotulo(statusProjeto,String(project.status||'planning'))}</span></Link>)}</div>}
      </section>

      if(widget==='extra')return <section key={widget} className="pm-surface overflow-hidden">
        <button type="button" onClick={()=>setShowDetails(v=>!v)} aria-expanded={showDetails} className="flex w-full items-center justify-between gap-3 p-4 text-left hover:bg-white/[.03]">
          <span><strong className="block text-sm font-semibold">Mais indicadores</strong><span className="mt-1 block text-xs text-gray-500">Clientes, pedidos e oportunidades comerciais</span></span>
          <span aria-hidden="true" className="text-gray-400">{showDetails?'−':'+'}</span>
        </button>
        {showDetails&&<div className="grid grid-cols-2 gap-3 border-t border-white/[.06] p-4 md:grid-cols-3">
          <Link to="/admin/clientes" className="rounded-lg border border-white/[.07] p-3"><span className="block text-xs text-gray-500">Clientes</span><strong className="text-lg">{metrics.customers}</strong></Link>
          <Link to="/admin/pedidos" className="rounded-lg border border-white/[.07] p-3"><span className="block text-xs text-gray-500">Pedidos ativos</span><strong className="text-lg">{metrics.openOrders}</strong></Link>
          <Link to="/admin/crm" className="rounded-lg border border-white/[.07] p-3"><span className="block text-xs text-gray-500">Funil comercial</span><strong className="text-lg">{money(metrics.pipelineValue)}</strong></Link>
          <div className="col-span-2 flex flex-wrap gap-3 pt-1 md:col-span-3"><Link to="/admin/crm" className="text-xs text-[#DFA269]">Abrir CRM →</Link><Link to="/admin/orcamentos" className="text-xs text-[#DFA269]">Orçamentos →</Link></div>
        </div>}
      </section>
      return null
    })}
  </div>
}
