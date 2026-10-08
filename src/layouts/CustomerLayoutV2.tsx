import { Component, type ErrorInfo, type ReactNode, useEffect, useState } from 'react'
import { Link, useLocation, useNavigate, Outlet, Navigate } from 'react-router-dom'
import { useAuth } from '../contexts/AuthContext'
import { afterAuthPath } from '../lib/navigation'
const logoUrl = '/sagamente-logo-dark.svg'
import { portalApi } from '../api/portal'
import { FloatingCustomerChat } from '../components/chat/FloatingCustomerChat'
import { settingsApi } from '../api/settings'

type IconName='academy'|'home'|'user'|'orders'|'projects'|'services'|'quotes'|'payments'|'chat'|'files'|'community'|'notifications'|'announcements'|'settings'|'logout'|'chevron'

const ICONS:Record<IconName,React.ReactNode>={
  academy:<><path d="M3 6.5 12 2l9 4.5-9 4.5-9-4.5Z"/><path d="M6 9v5.5c0 1.8 2.7 3.5 6 3.5s6-1.7 6-3.5V9"/><path d="M21 7v7"/></>,
  home:<><path d="M3 11.5 12 4l9 7.5"/><path d="M5.5 10.5V20h13v-9.5"/><path d="M9.5 20v-6h5v6"/></>,
  user:<><circle cx="12" cy="8" r="3"/><path d="M5 20c.8-4 3.2-6 7-6s6.2 2 7 6"/></>,
  orders:<><path d="m4 7 8-4 8 4-8 4-8-4Z"/><path d="M4 7v10l8 4 8-4V7"/><path d="M12 11v10"/></>,
  projects:<><path d="M4 5h6l2 2h8v12H4z"/><path d="M8 12h8M8 15h5"/></>,
  services:<><path d="M13 2 5 14h6l-1 8 9-13h-6z"/></>,
  quotes:<><path d="M6 3h12v18H6z"/><path d="M9 8h6M9 12h6M9 16h4"/></>,
  payments:<><rect x="3" y="5" width="18" height="14" rx="2"/><path d="M3 9h18M7 15h4"/></>,
  chat:<><path d="M4 5h16v11H9l-5 4z"/><path d="M8 10h8M8 13h5"/></>,
  files:<><path d="M4 6h6l2 2h8v10H4z"/><path d="M8 12h8"/></>,
  community:<><circle cx="9" cy="9" r="3"/><circle cx="17" cy="10" r="2.5"/><path d="M3.5 20c.6-3.7 2.7-5.5 5.5-5.5s4.9 1.8 5.5 5.5"/><path d="M14 15.5c2.9-.5 5.3 1 6.2 4.5"/></>,
  notifications:<><path d="M6 17h12l-1.5-2.5V10a4.5 4.5 0 0 0-9 0v4.5z"/><path d="M10 20h4"/></>,
  announcements:<><path d="M4 11v3h3l8 4V7l-8 4z"/><path d="M18 9c1 1 1 3 0 4"/></>,
  settings:<><circle cx="12" cy="12" r="3"/><path d="M19 12a7 7 0 0 0-.1-1l2-1.5-2-3.5-2.4 1a7 7 0 0 0-1.8-1L14.5 3h-5l-.3 3a7 7 0 0 0-1.8 1L5 6 3 9.5 5.1 11a7 7 0 0 0 0 2L3 14.5 5 18l2.4-1a7 7 0 0 0 1.8 1l.3 3h5l.3-3a7 7 0 0 0 1.8-1l2.4 1 2-3.5-2.1-1.5c.1-.3.1-.7.1-1Z"/></>,
  logout:<><path d="M10 4H5v16h5"/><path d="M14 8l4 4-4 4M8 12h10"/></>,
  chevron:<path d="m9 6 6 6-6 6"/>,
}

function MenuIcon({name,size=20}:{name:IconName,size?:number}){
  return <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">{ICONS[name]}</svg>
}

const MENU:{label:string;href:string;icon:IconName;group:string}[]=[
  { label: 'Início', href: '/app/dashboard', icon: 'home', group: 'principal' },
  { label: 'Pedidos', href: '/app/pedidos', icon: 'orders', group: 'negocios' },
  { label: 'Projetos', href: '/app/projetos', icon: 'projects', group: 'principal' },
  { label: 'Serviços', href: '/app/servicos', icon: 'services', group: 'negocios' },
  { label: 'Orçamentos', href: '/app/orcamentos', icon: 'quotes', group: 'negocios' },
  { label: 'Pagamentos', href: '/app/pagamentos', icon: 'payments', group: 'negocios' },
  { label: 'Arquivos', href: '/app/arquivos', icon: 'files', group: 'principal' },
  { label: 'Academia', href: '/app/academia', icon: 'academy', group: 'experiencia' },
  { label: 'Comunidade', href: '/comunidade', icon: 'community', group: 'experiencia' },
]


class CustomerRouteBoundary extends Component<{children:ReactNode;route:string},{error:Error|null}>{
  state:{error:Error|null}={error:null}
  static getDerivedStateFromError(error:Error){return {error}}
  componentDidCatch(error:Error,info:ErrorInfo){console.error('[CustomerPortal] route crashed',this.props.route,error,info)}
  componentDidUpdate(prev:{route:string}){if(prev.route!==this.props.route&&this.state.error)this.setState({error:null})}
  render(){
    if(!this.state.error)return this.props.children
    return <div className="max-w-2xl mx-auto mt-10 p-6 rounded-2xl border border-red-500/20 bg-red-500/[.04]">
      <p className="text-[10px] uppercase tracking-[.16em] font-bold text-[#DFA269]">Área do cliente</p>
      <h1 className="text-xl font-bold text-white mt-2">Não foi possível abrir esta tela</h1>
      <p className="text-sm text-[#8d8d98] mt-2">A navegação continua disponível. Tente carregar novamente; se persistir, o erro abaixo identifica a origem.</p>
      <pre className="mt-4 p-3 rounded-xl bg-black/30 text-xs text-red-200 whitespace-pre-wrap break-words">{this.state.error.message||'Erro inesperado'}</pre>
      <button onClick={()=>window.location.reload()} className="mt-4 h-10 px-4 rounded-xl bg-[#A65A2A] text-white text-xs font-bold">Recarregar tela</button>
    </div>
  }
}

export function CustomerLayoutV2() {
  const { user, isAuthenticated, isLoading, logout } = useAuth()
  const location = useLocation()
  const navigate = useNavigate()
  const [sidebarOpen, setSidebarOpen] = useState(false)
  const [expanded,setExpanded]=useState(true)
  const [counts, setCounts] = useState({ messages: 0, notifications: 0 })
  const [floatingChatEnabled,setFloatingChatEnabled]=useState(true)
  const [accountMenuOpen,setAccountMenuOpen]=useState(false)

  useEffect(() => {
    if (!user?.id) return
    const load = () => portalApi.unreadCounts(user.id).then(setCounts).catch(() => undefined)
    void load()
    const timer = window.setInterval(load, 10000)
    return () => window.clearInterval(timer)
  }, [user?.id])

  useEffect(()=>{
    try{window.localStorage.setItem('playmoments.customer.sidebar',expanded?'expanded':'collapsed')}catch{}
  },[expanded])

  useEffect(()=>{
    if(!user?.id)return
    let active=true
    settingsApi.userPreferences().then(prefs=>{
      if(!active||!prefs)return
      setFloatingChatEnabled(prefs.floating_chat_enabled)
      try{window.localStorage.setItem('playmoments.customer.sidebar',prefs.sidebar_expanded?'expanded':'collapsed')}catch{}
    }).catch(()=>undefined)
    return()=>{active=false}
  },[user?.id,location.pathname])

  useEffect(()=>{
    const apply=(event:Event)=>{
      const prefs=(event as CustomEvent).detail
      if(!prefs)return
      setExpanded(Boolean(prefs.sidebar_expanded))
      setFloatingChatEnabled(prefs.floating_chat_enabled!==false)
    }
    window.addEventListener('playmoments:preferences',apply)
    return()=>window.removeEventListener('playmoments:preferences',apply)
  },[])

  if (isLoading) {
    return <div role="status" aria-live="polite" className="min-h-screen flex items-center justify-center gap-3 bg-[#0a0a0b] text-sm text-gray-500"><div aria-hidden="true" className="w-8 h-8 rounded-full border-2 border-[#A65A2A] border-t-transparent animate-spin" /><span>Preparando sua área…</span></div>
  }

  if (!isAuthenticated) return <Navigate to="/login" state={{ from: location }} replace />
  if (user?.role === 'admin' || user?.role === 'staff') return <Navigate to={afterAuthPath(location.pathname + location.search, user.role)} replace />

  const handleLogout = async () => { await logout(); navigate('/') }

  const Sidebar = ({ mobile = false }: { mobile?: boolean }) => {
    const showLabels=mobile||expanded
    return <aside
      className="h-full flex flex-col bg-[#0d0d0f] border-r border-white/5 transition-[width] duration-300 ease-out"
      style={{width:mobile?248:expanded?228:76}}
    >
      <div className={'h-20 flex items-center border-b border-white/5 relative '+(showLabels?'px-4 justify-start':'justify-center')}>
        <Link to="/" className="flex items-center justify-center">
          <img src={logoUrl} alt="Sagamente" className={showLabels?'h-8 w-auto':'h-8 w-auto max-w-[58px] object-contain'} />
        </Link>
        {mobile&&<button aria-label="Fechar menu" onClick={()=>setSidebarOpen(false)} className="absolute right-3 w-11 h-11 flex items-center justify-center text-gray-500 hover:text-white">✕</button>}
      </div>

      <div className={showLabels?'p-3':'px-2 py-3'}>
        <div className={'rounded-2xl bg-white/[0.035] flex items-center transition-all '+(showLabels?'gap-3 p-3':'justify-center py-2')}>
          <div className="w-10 h-10 rounded-xl overflow-hidden flex items-center justify-center font-bold text-sm bg-[#A65A2A] text-white shrink-0">
            {user?.avatar?<img src={user.avatar} alt="" className="w-full h-full object-cover"/>:(user?.name?.charAt(0) ?? '?')}
          </div>
          {showLabels&&<div className="min-w-0">
            <p className="text-sm font-semibold truncate text-[#f0f0f2]">{user?.name} {user?.lastName}</p>
            <p className="text-[11px] truncate text-[#696975]">{user?.email}</p>
          </div>}
        </div>
      </div>

      <nav className="flex-1 px-2 overflow-y-auto pb-3">
        {(['principal','negocios','experiencia'] as const).map((group,groupIndex)=>{
          const items=MENU.filter(item=>item.group===group)
          const title={principal:'Minha área',negocios:'Contratações',experiencia:'Conteúdo'}[group]
          return <div key={group} className={groupIndex?'mt-4 pt-3 border-t border-white/[.045]':''}>
            {showLabels&&<p className="px-3 mb-1.5 text-[9px] uppercase tracking-[.16em] font-semibold text-[#555560]">{title}</p>}
            {items.map(item=>{
              const active=location.pathname===item.href||location.pathname.startsWith(item.href+'/')
              const count=item.href==='/app/conversas'?counts.messages:item.href==='/app/notificacoes'?counts.notifications:0
              return <Link key={item.href} to={item.href} onClick={()=>setSidebarOpen(false)} title={!showLabels?item.label:undefined}
                aria-current={active?'page':undefined}
                className={'group relative flex items-center rounded-xl mb-0.5 transition-all duration-200 '+(showLabels?'gap-3 px-3 h-10':'justify-center h-10')+(active?' bg-white/[.065] text-white':' text-[#777783] hover:text-[#d8d8de] hover:bg-white/[.035]')}>
                <span className={'shrink-0 '+(active?'text-[#DFA269]':'group-hover:text-[#b7b7c2]')}><MenuIcon name={item.icon} size={18}/></span>
                {showLabels&&<span className={'text-[13px] truncate '+(active?'font-semibold':'font-medium')}>{item.label}</span>}
                {count>0&&<span className={(showLabels?'ml-auto ':'absolute top-0.5 right-0.5 ')+'min-w-[17px] h-[17px] px-1 rounded-full bg-[#A65A2A] text-white text-[8px] font-bold flex items-center justify-center'}>{count>99?'99+':count}</span>}
                {active&&<span className="absolute -left-2 w-0.5 h-5 rounded-r bg-[#A65A2A]"/>}
              </Link>
            })}
          </div>
        })}
      </nav>

      <div className="p-2 border-t border-white/5 space-y-1">
        {!mobile&&<button
          type="button"
          onClick={()=>setExpanded(value=>!value)}
          className={'w-full rounded-xl text-[#A65A2A] hover:bg-[#A65A2A]/8 transition-colors '+(showLabels?'flex items-center gap-3 px-3 h-11':'h-11 flex items-center justify-center')}
          title={expanded?'Recolher menu':'Expandir menu'}
          aria-label={expanded?'Recolher menu':'Expandir menu'}
        >
          <span className={'transition-transform duration-300 '+(expanded?'rotate-180':'')}><MenuIcon name="chevron"/></span>
          {showLabels&&<span className="text-sm font-medium text-[#b7b7c2]">{expanded?'Recolher menu':'Expandir menu'}</span>}
        </button>}
      </div>
    </aside>
  }

  return <div className="min-h-screen flex bg-[#0a0a0b]">
    <div className="hidden md:flex flex-shrink-0 transition-[width] duration-300" style={{width:expanded?228:76}}><Sidebar/></div>

    {sidebarOpen&&<>
      <div className="md:hidden fixed inset-0 z-40 bg-black/70 backdrop-blur-sm" onClick={()=>setSidebarOpen(false)}/>
      <div className="md:hidden fixed inset-y-0 left-0 z-50"><Sidebar mobile/></div>
    </>}

    <div className="flex-1 flex flex-col min-w-0">
      <header className="hidden md:flex h-16 items-center justify-end gap-2 px-6 border-b border-white/5 bg-[#0b0b0d]/95">
        <Link to="/app/conversas" className="relative w-10 h-10 rounded-xl flex items-center justify-center text-[#7d7d88] hover:text-white hover:bg-white/[.05]" title="Mensagens">
          <MenuIcon name="chat" size={18}/>{counts.messages>0&&<span className="absolute -top-0.5 -right-0.5 min-w-[16px] h-4 px-1 rounded-full bg-[#A65A2A] text-[8px] font-bold text-white flex items-center justify-center">{counts.messages>99?'99+':counts.messages}</span>}
        </Link>
        <Link to="/app/notificacoes" className="relative w-10 h-10 rounded-xl flex items-center justify-center text-[#7d7d88] hover:text-white hover:bg-white/[.05]" title="Notificações">
          <MenuIcon name="notifications" size={18}/>{counts.notifications>0&&<span className="absolute -top-0.5 -right-0.5 min-w-[16px] h-4 px-1 rounded-full bg-[#A65A2A] text-[8px] font-bold text-white flex items-center justify-center">{counts.notifications>99?'99+':counts.notifications}</span>}
        </Link>
        <div className="relative ml-1">
          <button aria-haspopup="menu" aria-expanded={accountMenuOpen} onClick={()=>setAccountMenuOpen(v=>!v)} className="h-11 pl-2 pr-3 rounded-xl flex items-center gap-2 hover:bg-white/[.05]">
            <span className="w-8 h-8 rounded-lg overflow-hidden bg-[#A65A2A] text-white flex items-center justify-center text-xs font-bold">{user?.avatar?<img src={user.avatar} alt="" className="w-full h-full object-cover"/>:(user?.name?.charAt(0)??'?')}</span>
            <span className="text-xs font-semibold text-[#d8d8de] max-w-[120px] truncate">{user?.name}</span>
            <span className={'text-[#666672] transition-transform '+(accountMenuOpen?'rotate-90':'')}><MenuIcon name="chevron" size={14}/></span>
          </button>
          {accountMenuOpen&&<><button aria-label="Fechar menu" className="fixed inset-0 z-30 cursor-default" onClick={()=>setAccountMenuOpen(false)}/><div role="menu" className="absolute right-0 top-12 z-40 w-52 p-1.5 rounded-2xl border border-white/[.08] bg-[#111114] shadow-2xl">
            <Link to="/app/perfil" onClick={()=>setAccountMenuOpen(false)} className="flex items-center gap-3 h-10 px-3 rounded-xl text-xs text-[#aaaab4] hover:text-white hover:bg-white/[.05]"><MenuIcon name="user" size={16}/>Perfil</Link>
            <Link to="/app/configuracoes" onClick={()=>setAccountMenuOpen(false)} className="flex items-center gap-3 h-10 px-3 rounded-xl text-xs text-[#aaaab4] hover:text-white hover:bg-white/[.05]"><MenuIcon name="settings" size={16}/>Configurações</Link>
            <div className="my-1 border-t border-white/[.06]"/>
            <button onClick={handleLogout} className="w-full flex items-center gap-3 h-10 px-3 rounded-xl text-xs text-[#DFA269] hover:bg-[#A65A2A]/10"><MenuIcon name="logout" size={16}/>Sair</button>
          </div></>}
        </div>
      </header>
      <div className="md:hidden flex items-center justify-between p-4 border-b bg-[#0d0d0f] border-white/5">
        <button onClick={()=>setSidebarOpen(true)} className="text-[#A65A2A]">
          <svg width="22" height="22" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><path d="M3 12h18M3 6h18M3 18h18"/></svg>
        </button>
        <img src={logoUrl} alt="Sagamente" className="h-6"/>
        <div className="w-[22px]"/>
      </div>

      <main className="flex-1 overflow-auto p-4 md:p-8">
        <CustomerRouteBoundary key={location.pathname} route={location.pathname}><Outlet/></CustomerRouteBoundary>
      </main>
    </div>
    {floatingChatEnabled&&<FloatingCustomerChat unread={counts.messages}/>} 
  </div>
}
