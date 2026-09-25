import { useEffect, useState } from 'react'
import { Link, useLocation, useNavigate, Outlet, Navigate } from 'react-router-dom'
import { useAuth } from '../contexts/AuthContext'
import { afterAuthPath } from '../lib/navigation'
import logoUrl from '../assets/logo-play-moments.png'
import { portalApi } from '../api/portal'

const MENU = [
  { label: 'Painel', href: '/app/dashboard', icon: '⌂' },
  { label: 'Perfil', href: '/app/perfil', icon: '◉' },
  { label: 'Pedidos', href: '/app/pedidos', icon: '▣' },
  { label: 'Projetos', href: '/app/projetos', icon: '◆' },
  { label: 'Serviços', href: '/app/servicos', icon: '⚡' },
  { label: 'Orçamentos', href: '/app/orcamentos', icon: '▤' },
  { label: 'Pagamentos', href: '/app/pagamentos', icon: '◫' },
  { label: 'Conversas', href: '/app/conversas', icon: '●' },
  { label: 'Arquivos', href: '/app/arquivos', icon: '▰' },
  { label: 'Notificações', href: '/app/notificacoes', icon: '◌' },
  { label: 'Comunicados', href: '/app/comunicados', icon: '◢' },
  { label: 'Configurações', href: '/app/configuracoes', icon: '⚙' },
]

export function CustomerLayoutV2() {
  const { user, isAuthenticated, isLoading, logout } = useAuth()
  const location = useLocation()
  const navigate = useNavigate()
  const [sidebarOpen, setSidebarOpen] = useState(false)
  const [counts, setCounts] = useState({ messages: 0, notifications: 0 })

  useEffect(() => {
    if (!user?.id) return
    const load = () => portalApi.unreadCounts(user.id).then(setCounts).catch(() => undefined)
    void load()
    const timer = window.setInterval(load, 10000)
    return () => window.clearInterval(timer)
  }, [user?.id])

  if (isLoading) {
    return <div className="min-h-screen flex items-center justify-center bg-[#0a0a0b]">
      <div className="w-8 h-8 rounded-full border-2 border-[#E30613] border-t-transparent animate-spin" />
    </div>
  }

  if (!isAuthenticated) return <Navigate to="/login" state={{ from: location }} replace />
  if (user?.role === 'admin' || user?.role === 'staff') return <Navigate to={afterAuthPath(location.pathname + location.search, user.role)} replace />

  const handleLogout = async () => { await logout(); navigate('/') }

  const Sidebar = ({ mobile = false }: { mobile?: boolean }) => (
    <aside className="h-full flex flex-col bg-[#0d0d0f] border-r border-white/5" style={{ width: mobile ? 240 : 88 }}>
      <div className="h-16 flex items-center justify-center border-b border-white/5 relative">
        <Link to="/" className="flex items-center justify-center">
          <img src={logoUrl} alt="Play Moments" className="h-6 w-auto" />
        </Link>
        {mobile&&<button onClick={()=>setSidebarOpen(false)} className="absolute right-4 text-gray-500">✕</button>}
      </div>

      <div className={mobile?'p-3':'px-2 py-3'}>
        <div className={'rounded-2xl bg-white/[0.04] flex items-center '+(mobile?'gap-3 p-3':'justify-center py-3')}>
          <div className="w-10 h-10 rounded-xl flex items-center justify-center font-bold text-sm bg-gradient-to-br from-[#E30613] to-[#ff4d6d] text-white">
            {user?.name?.charAt(0) ?? '?'}
          </div>
          {mobile&&<div className="min-w-0"><p className="text-sm font-semibold truncate text-[#f0f0f2]">{user?.name} {user?.lastName}</p><p className="text-xs truncate text-[#6b6b78]">{user?.email}</p></div>}
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
            title={!mobile?item.label:undefined}
            className={'relative flex items-center rounded-xl mb-1 transition-all duration-200 '+(mobile?'gap-3 px-3 py-2.5':'justify-center h-11')+(active?' bg-[#E30613]/12 text-[#ff6b7a]':' text-[#8b8b99] hover:bg-white/[0.05] hover:text-white')}
          >
            <span className={'transition-transform duration-200 '+(active?'scale-110':'')}>{item.icon}</span>
            {mobile&&<span className="text-sm font-medium">{item.label}</span>}
            {!mobile&&count>0&&<span className="absolute top-1 right-1 min-w-4 h-4 px-1 rounded-full bg-[#E30613] text-white text-[9px] flex items-center justify-center">{count}</span>}
            {mobile&&count>0&&<span className="ml-auto min-w-5 h-5 px-1 rounded-full bg-[#E30613] text-white text-[10px] flex items-center justify-center">{count}</span>}
            {!mobile&&active&&<span className="absolute -left-2 w-1 h-6 rounded-r bg-[#E30613]"/>}
          </Link>
        })}
      </nav>

      <div className="p-2 border-t border-white/5">
        <button onClick={handleLogout} title={!mobile?'Sair':undefined} className={'w-full rounded-xl text-[#6b6b78] hover:bg-white/[0.05] hover:text-white transition-colors '+(mobile?'flex items-center gap-3 px-3 py-2.5 text-sm':'h-11 flex items-center justify-center')}>
          <span>↩</span>{mobile&&<span>Sair</span>}
        </button>
      </div>
    </aside>
  )

  return <div className="min-h-screen flex bg-[#0a0a0b]">
    <div className="hidden md:flex flex-shrink-0" style={{width:88}}><Sidebar/></div>
    {sidebarOpen&&<>
      <div className="md:hidden fixed inset-0 z-40 bg-black/70 backdrop-blur-sm" onClick={()=>setSidebarOpen(false)}/>
      <div className="md:hidden fixed inset-y-0 left-0 z-50"><Sidebar mobile/></div>
    </>}
    <div className="flex-1 flex flex-col min-w-0">
      <div className="md:hidden flex items-center justify-between p-4 border-b bg-[#0d0d0f] border-white/5">
        <button onClick={()=>setSidebarOpen(true)} className="text-[#9090a0]">
          <svg width="22" height="22" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><path d="M3 12h18M3 6h18M3 18h18"/></svg>
        </button>
        <img src={logoUrl} alt="Play Moments" className="h-6"/>
        <div className="w-[22px]"/>
      </div>
      <main className="flex-1 overflow-auto p-4 md:p-8"><Outlet/></main>
    </div>
  </div>
}
