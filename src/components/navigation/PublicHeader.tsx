import { useState } from 'react'
import { Link, useLocation, useNavigate } from 'react-router-dom'
import { useAuth } from '../../contexts/AuthContext'
import { useCart } from '../../contexts/CartContext'
const logoUrl = '/sagamente-logo-dark.svg'
import type { SiteSettings } from '../../services/siteContent'

const PUBLIC_NAV_LINKS = [
  { label: 'Produtos', href: '/produtos' },
  { label: 'Equipamentos', href: '/equipamentos' },
  { label: 'Serviços', href: '/servicos' },
  { label: 'Academia', href: '/academia' },
  { label: 'Quem Somos', href: '/quem-somos' },
]

export function PublicHeader({settings}:{settings?:SiteSettings|null}) {
  const [mobileOpen, setMobileOpen] = useState(false)
  const { isAuthenticated, user, logout } = useAuth()
  const { itemCount } = useCart()
  const location = useLocation()
  const navigate = useNavigate()
  const navLinks = isAuthenticated
    ? [...PUBLIC_NAV_LINKS, { label: 'Comunidade', href: '/comunidade' }]
    : PUBLIC_NAV_LINKS

  const handleLogout = async () => { await logout(); navigate('/') }
  const primaryColor=settings?.primary_color?.toLowerCase()==='#e30613'?'#A65A2A':(settings?.primary_color||'#A65A2A')

  return (
    <header className="sticky top-0 z-40" style={{
      background: 'rgba(10,10,11,0.9)',
      borderBottom: '1px solid rgba(255,255,255,0.06)',
      backdropFilter: 'blur(20px)',
    }}>
      <div className="mx-auto px-3 sm:px-4 flex items-center justify-between relative h-[58px] lg:h-16" style={{ maxWidth: 1200 }}>
        {/* Logo */}
        <Link to="/" className="hidden lg:block">
          <img src={logoUrl} alt="Sagamente" style={{ height: 30, width: 'auto' }} />
        </Link>

        <Link to="/" className="lg:hidden absolute left-1/2 -translate-x-1/2 flex items-center justify-center">
          <img src={logoUrl} alt="Sagamente" style={{ height: 28, width: 'auto' }} />
        </Link>

        <Link
          to="/carrinho"
          className="lg:hidden relative w-11 h-11 flex items-center justify-center rounded-xl"
          aria-label="Carrinho"
          style={{ color: '#9090a0' }}
        >
          <svg width="19" height="19" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
            <path d="M6 2L3 6v14a2 2 0 002 2h14a2 2 0 002-2V6l-3-4z"/><line x1="3" y1="6" x2="21" y2="6"/><path d="M16 10a4 4 0 01-8 0"/>
          </svg>
          {itemCount>0&&<span className="absolute top-1 right-1 min-w-4 h-4 px-1 rounded-full bg-[#A65A2A] text-white text-[9px] font-bold flex items-center justify-center">{itemCount}</span>}
        </Link>

        {/* Desktop Nav */}
        <nav className="hidden lg:flex items-center gap-6">
          {navLinks.map(link => (
            <Link
              key={link.href}
              to={link.href}
              className="text-sm font-medium transition-colors duration-200"
              aria-current={location.pathname === link.href || location.pathname.startsWith(link.href + '/') ? 'page' : undefined}
              style={{ color: location.pathname === link.href || location.pathname.startsWith(link.href + '/') ? '#f0f0f2' : '#6b6b78' }}
            >
              {link.label}
            </Link>
          ))}
        </nav>

        {/* Actions */}
        <div className="hidden lg:flex items-center gap-1.5 rounded-2xl p-1.5" style={{background:'rgba(255,255,255,0.035)',border:'1px solid rgba(255,255,255,0.07)'}}>
          {/* Cart */}
          <Link to="/carrinho" className="relative p-2.5 rounded-xl transition-colors hover:bg-white/[0.06]" aria-label="Carrinho" style={{ color: '#9090a0' }}>
            <svg width="20" height="20" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
              <path d="M6 2L3 6v14a2 2 0 002 2h14a2 2 0 002-2V6l-3-4z"/><line x1="3" y1="6" x2="21" y2="6"/><path d="M16 10a4 4 0 01-8 0"/>
            </svg>
            {itemCount > 0 && (
              <span className="absolute top-0 right-0 w-4 h-4 rounded-full text-xs font-bold flex items-center justify-center"
                style={{ background: '#A65A2A', color: '#fff', fontSize: 10 }}>
                {itemCount}
              </span>
            )}
          </Link>

          {isAuthenticated ? (
            <>
              {user?.role === 'admin' || user?.role === 'staff' ? (
                <Link to="/admin" className="px-3 py-2 rounded-xl text-sm font-semibold transition-colors"
                  style={{ background: 'rgba(166,90,42,0.15)', color: '#DFA269', border: '1px solid rgba(166,90,42,0.3)' }}>
                  Admin
                </Link>
              ) : (
                <Link to="/app/dashboard" className="px-3 py-2 rounded-xl text-sm font-semibold transition-colors"
                  style={{ background: 'rgba(255,255,255,0.06)', color: '#f0f0f2', border: '1px solid rgba(255,255,255,0.1)' }}>
                  Minha conta
                </Link>
              )}
              <button onClick={handleLogout} className="px-3 py-2 rounded-xl text-sm font-medium hover:bg-white/[0.04]"
                style={{ color: '#6b6b78' }}>
                Sair
              </button>
            </>
          ) : (
            <>
              <Link to="/login" className="px-3 py-2 text-sm font-medium transition-colors" style={{ color: '#c0c0cc' }}>
                Entrar
              </Link>
              <Link to="/cadastro" className="px-3 py-2 rounded-xl text-sm font-semibold transition-all duration-200"
                style={{ background: primaryColor, color: '#fff' }}>
                Criar conta
              </Link>
            </>
          )}
        </div>

        {/* Mobile menu button */}
        <button aria-label={mobileOpen ? "Fechar menu" : "Abrir menu"} aria-expanded={mobileOpen} aria-controls="public-mobile-menu" className="lg:hidden w-11 h-11 flex items-center justify-center rounded-xl ml-auto" style={{ color: '#9090a0' }} onClick={() => setMobileOpen(v => !v)}>
          <svg width="22" height="22" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
            {mobileOpen
              ? <path d="M18 6L6 18M6 6l12 12" />
              : <><path d="M3 12h18"/><path d="M3 6h18"/><path d="M3 18h18"/></>}
          </svg>
        </button>
      </div>

      {/* Mobile menu */}
      {mobileOpen && (
        <div id="public-mobile-menu" className="lg:hidden border-t flex flex-col py-3 px-4 gap-1 max-h-[calc(100dvh-58px)] overflow-y-auto"
          style={{ borderColor: 'rgba(255,255,255,0.06)', background: 'rgba(10,10,11,.98)', boxShadow:'0 24px 60px rgba(0,0,0,.38)' }}>
          {navLinks.map(link => (
            <Link key={link.href} to={link.href} onClick={() => setMobileOpen(false)}
              className="text-sm font-medium min-h-12 flex items-center px-3 rounded-xl" aria-current={location.pathname === link.href || location.pathname.startsWith(link.href + '/') ? 'page' : undefined} style={{ color: location.pathname === link.href || location.pathname.startsWith(link.href + '/') ? '#f0f0f2' : '#c0c0cc', background: location.pathname === link.href || location.pathname.startsWith(link.href + '/') ? 'rgba(255,255,255,.05)' : 'transparent' }}>
              {link.label}
            </Link>
          ))}
          <Link to="/carrinho" onClick={() => setMobileOpen(false)} className="min-h-12 flex items-center justify-between px-3 rounded-xl text-sm font-medium" style={{color:'#c0c0cc'}}><span>Carrinho</span>{itemCount>0&&<span className="min-w-6 h-6 px-1 rounded-full bg-[#A65A2A] text-white text-xs font-bold flex items-center justify-center">{itemCount}</span>}</Link>
          <div className="flex flex-col gap-2 pt-3 mt-2 border-t" style={{ borderColor: 'rgba(255,255,255,0.06)' }}>
            {isAuthenticated ? (
              <>
                <Link to={user?.role === 'admin' || user?.role === 'staff' ? '/admin' : '/app/dashboard'} onClick={() => setMobileOpen(false)} className="min-h-12 py-3 text-sm font-semibold text-center rounded-xl flex items-center justify-center"
                  style={{ background: 'rgba(255,255,255,0.08)', color: '#f0f0f2' }}>
                  {user?.role === 'admin' || user?.role === 'staff' ? 'Admin' : 'Minha conta'}
                </Link>
                <button onClick={handleLogout} className="py-3 text-sm" style={{ color: '#6b6b78' }}>Sair</button>
              </>
            ) : (
              <>
                <Link to="/login" onClick={() => setMobileOpen(false)} className="min-h-12 py-3 text-sm text-center flex items-center justify-center" style={{ color: '#9090a0' }}>Entrar</Link>
                <Link to="/cadastro" onClick={() => setMobileOpen(false)} className="min-h-12 py-3 text-sm font-semibold text-center rounded-xl flex items-center justify-center"
                  style={{ background: primaryColor, color: '#fff' }}>
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
