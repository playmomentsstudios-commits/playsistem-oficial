import { useState } from 'react'
import { Link, useLocation, useNavigate } from 'react-router-dom'
import { useAuth } from '../../contexts/AuthContext'
import { useCart } from '../../contexts/CartContext'
import { conversationLink } from '../../lib/navigation'
import logoUrl from '../../assets/logo-play-moments.png'

const NAV_LINKS = [
  { label: 'Produtos & Serviços', href: '/produtos' },
  { label: 'Portfólio', href: '/portfolio' },
  { label: 'Comunidade', href: '/comunidade' },
]

export function PublicHeader() {
  const [mobileOpen, setMobileOpen] = useState(false)
  const { isAuthenticated, user, logout } = useAuth()
  const { itemCount } = useCart()
  const location = useLocation()
  const navigate = useNavigate()

  const handleLogout = async () => { await logout(); navigate('/') }

  return (
    <header className="sticky top-0 z-40" style={{
      background: 'rgba(10,10,11,0.9)',
      borderBottom: '1px solid rgba(255,255,255,0.06)',
      backdropFilter: 'blur(20px)',
    }}>
      <div className="mx-auto px-4 flex items-center justify-between relative" style={{ maxWidth: 1200, height: 64 }}>
        {/* Logo */}
        <Link to="/" className="hidden lg:block">
          <img src={logoUrl} alt="Play Moments" style={{ height: 30, width: 'auto' }} />
        </Link>

        <Link to="/" className="lg:hidden absolute left-1/2 -translate-x-1/2 flex items-center justify-center">
          <img src={logoUrl} alt="Play Moments" style={{ height: 34, width: 'auto' }} />
        </Link>

        {/* Desktop Nav */}
        <nav className="hidden lg:flex items-center gap-6">
          {NAV_LINKS.map(link => (
            <Link
              key={link.href}
              to={link.href}
              className="text-sm font-medium transition-colors duration-200"
              style={{ color: location.pathname === link.href ? '#f0f0f2' : '#6b6b78' }}
            >
              {link.label}
            </Link>
          ))}
        </nav>

        {/* Actions */}
        <div className="hidden lg:flex items-center gap-3">
          <Link to={conversationLink(user?.role ?? null)} className="px-4 py-3 rounded-full text-sm font-semibold" style={{ background: '#E30613', color: '#fff' }}>Falar agora</Link>
          {/* Cart */}
          <Link to="/carrinho" className="relative p-2 rounded-xl transition-colors" style={{ color: '#9090a0' }}>
            <svg width="20" height="20" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
              <path d="M6 2L3 6v14a2 2 0 002 2h14a2 2 0 002-2V6l-3-4z"/><line x1="3" y1="6" x2="21" y2="6"/><path d="M16 10a4 4 0 01-8 0"/>
            </svg>
            {itemCount > 0 && (
              <span className="absolute top-0 right-0 w-4 h-4 rounded-full text-xs font-bold flex items-center justify-center"
                style={{ background: '#E30613', color: '#fff', fontSize: 10 }}>
                {itemCount}
              </span>
            )}
          </Link>

          {isAuthenticated ? (
            <>
              {user?.role === 'admin' || user?.role === 'staff' ? (
                <Link to="/admin" className="px-3 py-1.5 rounded-lg text-sm font-semibold transition-colors"
                  style={{ background: 'rgba(227,6,19,0.15)', color: '#ff6b7a', border: '1px solid rgba(227,6,19,0.3)' }}>
                  Admin
                </Link>
              ) : (
                <Link to="/app/dashboard" className="px-3 py-1.5 rounded-lg text-sm font-semibold transition-colors"
                  style={{ background: 'rgba(255,255,255,0.08)', color: '#f0f0f2', border: '1px solid rgba(255,255,255,0.1)' }}>
                  Minha conta
                </Link>
              )}
              <button onClick={handleLogout} className="px-3 py-1.5 rounded-lg text-sm font-medium"
                style={{ color: '#6b6b78' }}>
                Sair
              </button>
            </>
          ) : (
            <>
              <Link to="/login" className="text-sm font-medium transition-colors" style={{ color: '#9090a0' }}>
                Entrar
              </Link>
              <Link to="/cadastro" className="px-4 py-2 rounded-full text-sm font-semibold transition-all duration-200"
                style={{ background: '#E30613', color: '#fff' }}>
                Criar conta
              </Link>
            </>
          )}
        </div>

        {/* Mobile menu button */}
        <button aria-label={mobileOpen ? "Fechar menu" : "Abrir menu"} aria-expanded={mobileOpen} aria-controls="public-mobile-menu" className="lg:hidden p-3 ml-auto" style={{ color: '#9090a0' }} onClick={() => setMobileOpen(v => !v)}>
          <svg width="22" height="22" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
            {mobileOpen
              ? <path d="M18 6L6 18M6 6l12 12" />
              : <><path d="M3 12h18"/><path d="M3 6h18"/><path d="M3 18h18"/></>}
          </svg>
        </button>
      </div>

      {/* Mobile menu */}
      {mobileOpen && (
        <div id="public-mobile-menu" className="lg:hidden border-t flex flex-col py-4 px-6 gap-4"
          style={{ borderColor: 'rgba(255,255,255,0.06)', background: '#0a0a0b' }}>
          {NAV_LINKS.map(link => (
            <Link key={link.href} to={link.href} onClick={() => setMobileOpen(false)}
              className="text-sm font-medium min-h-11 flex items-center" style={{ color: '#c0c0cc' }}>
              {link.label}
            </Link>
          ))}
          <Link to={conversationLink(user?.role ?? null)} onClick={() => setMobileOpen(false)} className="py-3 text-center rounded-full font-semibold" style={{ background: '#E30613', color: '#fff' }}>Falar agora</Link>
          <div className="flex flex-col gap-2 pt-2 border-t" style={{ borderColor: 'rgba(255,255,255,0.06)' }}>
            {isAuthenticated ? (
              <>
                <Link to={user?.role === 'admin' || user?.role === 'staff' ? '/admin' : '/app/dashboard'} onClick={() => setMobileOpen(false)} className="py-3 text-sm font-semibold text-center rounded-xl"
                  style={{ background: 'rgba(255,255,255,0.08)', color: '#f0f0f2' }}>
                  {user?.role === 'admin' || user?.role === 'staff' ? 'Admin' : 'Minha conta'}
                </Link>
                <button onClick={handleLogout} className="py-3 text-sm" style={{ color: '#6b6b78' }}>Sair</button>
              </>
            ) : (
              <>
                <Link to="/login" onClick={() => setMobileOpen(false)} className="py-3 text-sm text-center" style={{ color: '#9090a0' }}>Entrar</Link>
                <Link to="/cadastro" onClick={() => setMobileOpen(false)} className="py-3 text-sm font-semibold text-center rounded-full"
                  style={{ background: '#E30613', color: '#fff' }}>
                  Criar conta
                </Link>
              </>
            )}
          </div>
        </div>
      )}
    </header>
  )
}
