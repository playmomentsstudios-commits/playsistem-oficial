import { useEffect, useState } from 'react'
import { Link, useLocation, useNavigate, Outlet, Navigate } from 'react-router-dom'
import { useAuth } from '../contexts/AuthContext'
import logoUrl from '../assets/logo-play-moments.png'
import { portalApi } from '../api/portal'

const MENU = [
  { label: 'Dashboard', href: '/admin', icon: '⊞', exact: true },
  { label: 'Clientes', href: '/admin/clientes', icon: '👥' },
  { label: 'Produtos', href: '/admin/produtos', icon: '📦' },
  { label: 'Projetos', href: '/admin/projetos', icon: '📈' },
  { label: 'Produtividade', href: '/admin/produtividade', icon: '✅' },
  { label: 'Categorias', href: '/admin/categorias', icon: '🏷' },
  { label: 'Serviços', href: '/admin/servicos', icon: '⚡' },
  { label: 'Pedidos', href: '/admin/pedidos', icon: '🛒' },
  { label: 'Orçamentos', href: '/admin/orcamentos', icon: '📋' },
  { label: 'Pagamentos', href: '/admin/pagamentos', icon: '💳' },
  { label: 'Conversas', href: '/admin/conversas', icon: '💬' },
  { label: 'Arquivos', href: '/admin/arquivos', icon: '📁' },
  { label: 'Portfólio', href: '/admin/portfolio', icon: '🎨' },
  { label: 'Comunidade', href: '/admin/comunidade', icon: '📢' },
  { label: 'Notificações', href: '/admin/notificacoes', icon: '🔔' },
  { label: 'Comunicados', href: '/admin/comunicados', icon: '📣' },
  { label: 'Equipe', href: '/admin/equipe', icon: '🧑‍💼' },
  { label: 'Site', href: '/admin/site', icon: '🌐' },
  { label: 'Configurações', href: '/admin/configuracoes', icon: '⚙' },
  { label: 'Auditoria', href: '/admin/auditoria', icon: '📝' },
]

export function AdminLayout() {
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
    return (
      <div className="min-h-screen flex items-center justify-center" style={{ background: '#0a0a0b' }}>
        <div className="w-8 h-8 rounded-full border-2 border-[#E30613] border-t-transparent animate-spin" />
      </div>
    )
  }

  if (!isAuthenticated) return <Navigate to="/login" state={{ from: location }} replace />
  if (!user || !['admin', 'staff'].includes(user.role)) return <Navigate to="/app/dashboard" replace />

  const handleLogout = async () => { await logout(); navigate('/') }

  const isActive = (href: string, exact?: boolean) =>
    exact ? location.pathname === href : location.pathname === href || location.pathname.startsWith(href + '/')

  const Sidebar = ({ mobile = false }: { mobile?: boolean }) => (
    <aside style={{
      width: 220,
      background: '#0a0a0b',
      borderRight: '1px solid rgba(255,255,255,0.05)',
      display: 'flex',
      flexDirection: 'column',
      ...(mobile ? { position: 'fixed', top: 0, left: 0, bottom: 0, zIndex: 50 } : {}),
    }}>
      <div className="flex items-center justify-between px-5 py-4 border-b"
        style={{ borderColor: 'rgba(255,255,255,0.05)' }}>
        <Link to="/"><img src={logoUrl} alt="Play Moments" style={{ height: 24 }} /></Link>
        {mobile && <button onClick={() => setSidebarOpen(false)} style={{ color: '#6b6b78' }}>✕</button>}
      </div>

      <div className="px-4 py-2 mx-2 mt-2 rounded-lg"
        style={{ background: 'rgba(227,6,19,0.1)', border: '1px solid rgba(227,6,19,0.2)' }}>
        <p className="text-xs font-bold uppercase tracking-widest" style={{ color: '#E30613' }}>
          {user?.role === 'admin' ? '● Admin' : '● Staff'}
        </p>
        <p className="text-xs truncate" style={{ color: '#9090a0' }}>{user?.name}</p>
      </div>

      <nav className="flex-1 px-2 pt-3 overflow-y-auto pb-4">
        {MENU.map(item => {
          const active = isActive(item.href, item.exact)
          return (
            <Link key={item.href} to={item.href}
              onClick={() => setSidebarOpen(false)}
              className="flex items-center gap-2.5 px-3 py-2 rounded-lg mb-0.5 text-sm font-medium transition-all"
              style={{
                background: active ? 'rgba(227,6,19,0.12)' : 'transparent',
                color: active ? '#ff6b7a' : '#9090a0',
              }}>
              <span>{item.icon}</span> {item.label}
              {item.href === '/admin/conversas' && counts.messages > 0 && <span className="ml-auto min-w-5 h-5 px-1 rounded-full bg-[#E30613] text-white text-[10px] flex items-center justify-center">{counts.messages}</span>}
              {item.href === '/admin/notificacoes' && counts.notifications > 0 && <span className="ml-auto min-w-5 h-5 px-1 rounded-full bg-[#E30613] text-white text-[10px] flex items-center justify-center">{counts.notifications}</span>}
            </Link>
          )
        })}
      </nav>

      <div className="p-2 border-t" style={{ borderColor: 'rgba(255,255,255,0.05)' }}>
        <Link to="/" className="flex items-center gap-2 px-3 py-2 rounded-lg text-xs" style={{ color: '#6b6b78' }}>
          ← Ver site
        </Link>
        <button onClick={handleLogout} className="w-full flex items-center gap-2 px-3 py-2 rounded-lg text-xs" style={{ color: '#6b6b78' }}>
          ↩ Sair
        </button>
      </div>
    </aside>
  )

  return (
    <div className="min-h-screen flex" style={{ background: '#0d0d0f' }}>
      <div className="hidden md:flex flex-shrink-0" style={{ width: 220 }}>
        <Sidebar />
      </div>

      {sidebarOpen && (
        <>
          <div className="md:hidden fixed inset-0 z-40 bg-black/60" onClick={() => setSidebarOpen(false)} />
          <div className="md:hidden" style={{ width: 220 }}><Sidebar mobile /></div>
        </>
      )}

      <div className="flex-1 min-w-0 flex flex-col">
        {/* Top bar */}
        <div className="flex items-center justify-between px-4 py-3 border-b"
          style={{ background: '#0a0a0b', borderColor: 'rgba(255,255,255,0.05)', minHeight: 56 }}>
          <div className="flex items-center gap-3">
            <button className="md:hidden" onClick={() => setSidebarOpen(true)} style={{ color: '#9090a0' }}>
              <svg width="20" height="20" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                <path d="M3 12h18M3 6h18M3 18h18" />
              </svg>
            </button>
            <span className="text-sm font-semibold" style={{ color: '#f0f0f2' }}>Painel Administrativo</span>
          </div>
        </div>

        <main className="flex-1 overflow-auto p-4 md:p-6">
          <Outlet />
        </main>
      </div>
    </div>
  )
}
