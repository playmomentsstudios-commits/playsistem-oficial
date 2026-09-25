import { useState } from 'react'
import { Link, useLocation, useNavigate, Outlet, Navigate } from 'react-router-dom'
import { useAuth } from '../contexts/AuthContext'
import logoUrl from '../assets/logo-play-moments.png'

const MENU = [
  { label: 'Dashboard', href: '/app/dashboard', icon: '⊞' },
  { label: 'Meu Perfil', href: '/app/perfil', icon: '◎' },
  { label: 'Pedidos', href: '/app/pedidos', icon: '📦' },
  { label: 'Serviços', href: '/app/servicos', icon: '⚡' },
  { label: 'Orçamentos', href: '/app/orcamentos', icon: '📋' },
  { label: 'Pagamentos', href: '/app/pagamentos', icon: '💳' },
  { label: 'Conversas', href: '/app/conversas', icon: '💬' },
  { label: 'Arquivos', href: '/app/arquivos', icon: '📁' },
  { label: 'Notificações', href: '/app/notificacoes', icon: '🔔' },
  { label: 'Comunicados', href: '/app/comunicados', icon: '📢' },
  { label: 'Configurações', href: '/app/configuracoes', icon: '⚙' },
]

export function CustomerLayout() {
  const { user, isAuthenticated, isLoading, logout } = useAuth()
  const location = useLocation()
  const navigate = useNavigate()
  const [sidebarOpen, setSidebarOpen] = useState(false)

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center" style={{ background: '#0a0a0b' }}>
        <div className="w-8 h-8 rounded-full border-2 border-[#E30613] border-t-transparent animate-spin" />
      </div>
    )
  }

  if (!isAuthenticated) return <Navigate to="/login" state={{ from: location }} replace />

  if (user?.role === 'admin' || user?.role === 'staff') return <Navigate to="/admin" replace />

  const handleLogout = async () => { await logout(); navigate('/') }

  const Sidebar = ({ mobile = false }: { mobile?: boolean }) => (
    <aside style={{
      width: 240,
      background: '#0d0d0f',
      borderRight: '1px solid rgba(255,255,255,0.05)',
      display: 'flex',
      flexDirection: 'column',
      height: '100%',
      ...(mobile ? { position: 'fixed', top: 0, left: 0, bottom: 0, zIndex: 50 } : {}),
    }}>
      <div className="flex items-center justify-between p-5 border-b" style={{ borderColor: 'rgba(255,255,255,0.05)' }}>
        <Link to="/">
          <img src={logoUrl} alt="Play Moments" style={{ height: 26, width: 'auto' }} />
        </Link>
        {mobile && (
          <button onClick={() => setSidebarOpen(false)} style={{ color: '#6b6b78' }}>✕</button>
        )}
      </div>

      <div className="flex items-center gap-3 p-4 mx-3 my-3 rounded-xl" style={{ background: 'rgba(255,255,255,0.04)' }}>
        <div className="w-9 h-9 rounded-xl flex items-center justify-center font-bold text-sm flex-shrink-0"
          style={{ background: 'linear-gradient(135deg, #E30613, #ff4d6d)', color: '#fff' }}>
          {user?.name?.charAt(0) ?? '?'}
        </div>
        <div className="min-w-0">
          <p className="text-sm font-semibold truncate" style={{ color: '#f0f0f2' }}>
            {user?.name} {user?.lastName}
          </p>
          <p className="text-xs truncate" style={{ color: '#6b6b78' }}>{user?.email}</p>
        </div>
      </div>

      <nav className="flex-1 px-3 overflow-y-auto pb-4">
        {MENU.map(item => {
          const active = location.pathname === item.href || location.pathname.startsWith(item.href + '/')
          return (
            <Link key={item.href} to={item.href}
              onClick={() => setSidebarOpen(false)}
              className="flex items-center gap-3 px-3 py-2.5 rounded-xl mb-0.5 text-sm font-medium transition-all duration-150"
              style={{
                background: active ? 'rgba(227,6,19,0.12)' : 'transparent',
                color: active ? '#ff6b7a' : '#9090a0',
                border: active ? '1px solid rgba(227,6,19,0.2)' : '1px solid transparent',
              }}>
              <span style={{ fontSize: 15 }}>{item.icon}</span>
              {item.label}
            </Link>
          )
        })}
      </nav>

      <div className="p-3 border-t" style={{ borderColor: 'rgba(255,255,255,0.05)' }}>
        <button onClick={handleLogout}
          className="w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition-colors"
          style={{ color: '#6b6b78' }}>
          <span>↩</span> Sair
        </button>
      </div>
    </aside>
  )

  return (
    <div className="min-h-screen flex" style={{ background: '#0a0a0b' }}>
      {/* Desktop sidebar */}
      <div className="hidden md:flex flex-shrink-0" style={{ width: 240 }}>
        <Sidebar />
      </div>

      {/* Mobile sidebar overlay */}
      {sidebarOpen && (
        <>
          <div className="md:hidden fixed inset-0 z-40 bg-black/60" onClick={() => setSidebarOpen(false)} />
          <div className="md:hidden" style={{ width: 240 }}><Sidebar mobile /></div>
        </>
      )}

      {/* Main */}
      <div className="flex-1 flex flex-col min-w-0">
        {/* Mobile top bar */}
        <div className="md:hidden flex items-center justify-between p-4 border-b"
          style={{ background: '#0d0d0f', borderColor: 'rgba(255,255,255,0.05)' }}>
          <button onClick={() => setSidebarOpen(true)} style={{ color: '#9090a0' }}>
            <svg width="22" height="22" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
              <path d="M3 12h18M3 6h18M3 18h18" />
            </svg>
          </button>
          <img src={logoUrl} alt="Play Moments" style={{ height: 24 }} />
          <div style={{ width: 22 }} />
        </div>

        <main className="flex-1 overflow-auto p-4 md:p-8">
          <Outlet />
        </main>
      </div>
    </div>
  )
}
