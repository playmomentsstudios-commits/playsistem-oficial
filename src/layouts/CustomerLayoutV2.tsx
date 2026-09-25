import { useEffect, useState } from 'react'
import { Link, useLocation, useNavigate, Outlet, Navigate } from 'react-router-dom'
import { useAuth } from '../contexts/AuthContext'
import { afterAuthPath } from '../lib/navigation'
import logoUrl from '../assets/logo-play-moments.png'
import { portalApi } from '../api/portal'
import { FloatingCustomerChat } from '../components/chat/FloatingCustomerChat'

type IconName='home'|'user'|'orders'|'projects'|'services'|'quotes'|'payments'|'chat'|'files'|'community'|'notifications'|'announcements'|'settings'|'logout'|'chevron'

const ICONS:Record<IconName,React.ReactNode>={
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

const MENU:{label:string;href:string;icon:IconName}[]=[
  { label: 'Painel', href: '/app/dashboard', icon: 'home' },
  { label: 'Perfil', href: '/app/perfil', icon: 'user' },
  { label: 'Pedidos', href: '/app/pedidos', icon: 'orders' },
  { label: 'Projetos', href: '/app/projetos', icon: 'projects' },
  { label: 'Serviços', href: '/app/servicos', icon: 'services' },
  { label: 'Orçamentos', href: '/app/orcamentos', icon: 'quotes' },
  { label: 'Pagamentos', href: '/app/pagamentos', icon: 'payments' },
  { label: 'Conversas', href: '/app/conversas', icon: 'chat' },
  { label: 'Arquivos', href: '/app/arquivos', icon: 'files' },
  { label: 'Comunidade', href: '/comunidade', icon: 'community' },
  { label: 'Notificações', href: '/app/notificacoes', icon: 'notifications' },
  { label: 'Comunicados', href: '/app/comunicados', icon: 'announcements' },
  { label: 'Configurações', href: '/app/configuracoes', icon: 'settings' },
]

export function CustomerLayoutV2() {
  const { user, isAuthenticated, isLoading, logout } = useAuth()
  const location = useLocation()
  const navigate = useNavigate()
  const [sidebarOpen, setSidebarOpen] = useState(false)
  const [expanded,setExpanded]=useState(()=>{
    try{return window.localStorage.getItem('playmoments.customer.sidebar')==='expanded'}catch{return false}
  })
  const [counts, setCounts] = useState({ messages: 0, notifications: 0 })

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

  if (isLoading) {
    return <div className="min-h-screen flex items-center justify-center bg-[#0a0a0b]">
      <div className="w-8 h-8 rounded-full border-2 border-[#E30613] border-t-transparent animate-spin" />
    </div>
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
          <img src={logoUrl} alt="Play Moments" className={showLabels?'h-8 w-auto':'h-8 w-auto max-w-[58px] object-contain'} />
        </Link>
        {mobile&&<button onClick={()=>setSidebarOpen(false)} className="absolute right-4 text-gray-500 hover:text-white">✕</button>}
      </div>

      <div className={showLabels?'p-3':'px-2 py-3'}>
        <div className={'rounded-2xl bg-white/[0.035] flex items-center transition-all '+(showLabels?'gap-3 p-3':'justify-center py-2')}>
          <div className="w-10 h-10 rounded-xl flex items-center justify-center font-bold text-sm bg-[#E30613] text-white shrink-0">
            {user?.name?.charAt(0) ?? '?'}
          </div>
          {showLabels&&<div className="min-w-0">
            <p className="text-sm font-semibold truncate text-[#f0f0f2]">{user?.name} {user?.lastName}</p>
            <p className="text-[11px] truncate text-[#696975]">{user?.email}</p>
          </div>}
        </div>
      </div>

      <nav className="flex-1 px-2 overflow-y-auto pb-3">
        {MENU.map(item=>{
          const active=location.pathname===item.href||location.pathname.startsWith(item.href+'/')
          const count=item.href==='/app/conversas'?counts.messages:item.href==='/app/notificacoes'?counts.notifications:0
          return <Link
            key={item.href}
            to={item.href}
            onClick={()=>setSidebarOpen(false)}
            title={!showLabels?item.label:undefined}
            className={'group relative flex items-center rounded-xl mb-1 transition-all duration-200 '+(showLabels?'gap-3 px-3 h-11':'justify-center h-11')+(active?' bg-[#E30613]/12 text-[#ff3340]':' text-[#E30613] hover:bg-[#E30613]/8')}
          >
            <span className={'shrink-0 transition-transform duration-200 '+(active?'scale-105':'group-hover:scale-105')}><MenuIcon name={item.icon}/></span>
            {showLabels&&<span className={'text-sm truncate transition-colors '+(active?'font-semibold text-white':'font-medium text-[#b7b7c2] group-hover:text-white')}>{item.label}</span>}
            {count>0&&<span className={(showLabels?'ml-auto ':'absolute top-1 right-1 ')+'min-w-4 h-4 px-1 rounded-full '+(item.href==='/app/conversas'?'bg-[#25D366]':'bg-[#E30613]')+' text-white text-[9px] font-bold flex items-center justify-center'}>{count}</span>}
            {active&&<span className="absolute -left-2 w-1 h-6 rounded-r bg-[#E30613]"/>}
          </Link>
        })}
      </nav>

      <div className="p-2 border-t border-white/5 space-y-1">
        {!mobile&&<button
          type="button"
          onClick={()=>setExpanded(value=>!value)}
          className={'w-full rounded-xl text-[#E30613] hover:bg-[#E30613]/8 transition-colors '+(showLabels?'flex items-center gap-3 px-3 h-11':'h-11 flex items-center justify-center')}
          title={expanded?'Recolher menu':'Expandir menu'}
          aria-label={expanded?'Recolher menu':'Expandir menu'}
        >
          <span className={'transition-transform duration-300 '+(expanded?'rotate-180':'')}><MenuIcon name="chevron"/></span>
          {showLabels&&<span className="text-sm font-medium text-[#b7b7c2]">{expanded?'Recolher menu':'Expandir menu'}</span>}
        </button>}
        <button
          onClick={handleLogout}
          title={!showLabels?'Sair':undefined}
          className={'w-full rounded-xl text-[#E30613] hover:bg-[#E30613]/8 transition-colors '+(showLabels?'flex items-center gap-3 px-3 h-11':'h-11 flex items-center justify-center')}
        >
          <MenuIcon name="logout"/>
          {showLabels&&<span className="text-sm font-medium text-[#b7b7c2]">Sair</span>}
        </button>
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
      <div className="md:hidden flex items-center justify-between p-4 border-b bg-[#0d0d0f] border-white/5">
        <button onClick={()=>setSidebarOpen(true)} className="text-[#E30613]">
          <svg width="22" height="22" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><path d="M3 12h18M3 6h18M3 18h18"/></svg>
        </button>
        <img src={logoUrl} alt="Play Moments" className="h-6"/>
        <div className="w-[22px]"/>
      </div>

      <main className="flex-1 overflow-auto p-4 md:p-8">
        <Outlet/>
      </main>
    </div>
    <FloatingCustomerChat unread={counts.messages}/>
  </div>
}
