import { Link } from 'react-router-dom'
import { PublicLayout } from '../../layouts/PublicLayout'
import logoUrl from '../../assets/logo-play-moments.png'

const FEATURED_SERVICES = [
  {
    area: 'Studio & Criação',
    icon: '🎬',
    color: '#ff6b35',
    services: ['Produção de Vídeo', 'Fotografia Profissional', 'Motion Design', 'Streaming'],
    href: '/studio',
    image: 'https://images.unsplash.com/photo-1492691527719-9d1e07e534b4?w=600&h=400&fit=crop&auto=format',
  },
  {
    area: 'Design & Digital',
    icon: '✦',
    color: '#4cc9f0',
    services: ['Identidade Visual', 'UI/UX Design', 'Criação de Sites', 'Marketing Digital'],
    href: '/design',
    image: 'https://images.unsplash.com/photo-1558618666-fcd25c85cd64?w=600&h=400&fit=crop&auto=format',
  },
  {
    area: 'Tech & Equipamentos',
    icon: '⚡',
    color: '#06d6a0',
    services: ['Aluguel de Câmeras', 'Setup de Estúdio', 'Infraestrutura AV', 'Suporte Técnico'],
    href: '/tech',
    image: 'https://images.unsplash.com/photo-1516035069371-29a1b244cc32?w=600&h=400&fit=crop&auto=format',
  },
]

const PORTFOLIO_ITEMS = [
  {
    title: 'Vertice — Identidade Visual',
    category: 'Design & Digital',
    image: 'https://images.unsplash.com/photo-1634942537034-2531766767d1?w=500&h=350&fit=crop&auto=format',
    href: '/portfolio',
  },
  {
    title: 'Evento Corporativo Tech',
    category: 'Studio & Criação',
    image: 'https://images.unsplash.com/photo-1540575467063-178a50c2df87?w=500&h=350&fit=crop&auto=format',
    href: '/portfolio',
  },
  {
    title: 'Setup Profissional 4K',
    category: 'Tech & Equipamentos',
    image: 'https://images.unsplash.com/photo-1608499267993-a4f0f95aa09b?w=500&h=350&fit=crop&auto=format',
    href: '/portfolio',
  },
]

const STATS = [
  { value: '200+', label: 'Projetos entregues' },
  { value: '120+', label: 'Clientes atendidos' },
  { value: '5 anos', label: 'De mercado' },
  { value: '98%', label: 'Satisfação' },
]

export function HomePage() {
  return (
    <PublicLayout>
      {/* ── HERO ─────────────────────────────────────────────────────────── */}
      <section className="relative flex flex-col items-center justify-center text-center px-6 py-24 overflow-hidden"
        style={{ minHeight: '90vh' }}>
        {/* Background glow */}
        <div className="absolute inset-0 pointer-events-none">
          <div style={{
            position: 'absolute', top: '20%', left: '50%', transform: 'translateX(-50%)',
            width: 700, height: 700, borderRadius: '50%',
            background: 'radial-gradient(circle, rgba(227,6,19,0.06) 0%, transparent 70%)',
          }} />
        </div>

        <div className="relative z-10 max-w-4xl mx-auto">
          <img src={logoUrl} alt="Play Moments" className="mx-auto mb-8"
            style={{ height: 56, width: 'auto', filter: 'drop-shadow(0 0 30px rgba(227,6,19,0.3))' }} />

          <h1 className="font-extrabold leading-none mb-6"
            style={{ fontSize: 'clamp(2.5rem, 7vw, 5rem)', letterSpacing: '-0.02em',
              background: 'linear-gradient(135deg, #ffffff 0%, #c0c0cc 100%)',
              WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent' }}>
            Criamos momentos<br />
            <span style={{
              background: 'linear-gradient(135deg, #E30613 0%, #ff4d6d 100%)',
              WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent'
            }}>que ficam.</span>
          </h1>

          <p className="text-lg mb-10 max-w-2xl mx-auto" style={{ color: '#9090a0', lineHeight: 1.7 }}>
            Studio de criação, design digital e tecnologia em equipamentos. Uma plataforma completa
            para sua marca crescer com identidade e profissionalismo.
          </p>

          <div className="flex flex-wrap items-center justify-center gap-4">
            <Link to="/servicos" className="px-8 py-3.5 rounded-full font-bold text-base transition-all duration-200"
              style={{ background: '#E30613', color: '#fff' }}>
              Explorar serviços
            </Link>
            <Link to="/portfolio" className="px-8 py-3.5 rounded-full font-bold text-base transition-all duration-200"
              style={{ background: 'rgba(255,255,255,0.06)', color: '#f0f0f2', border: '1px solid rgba(255,255,255,0.1)' }}>
              Ver portfólio
            </Link>
          </div>
        </div>

        {/* Bottom fade */}
        <div className="absolute bottom-0 left-0 right-0 h-32 pointer-events-none"
          style={{ background: 'linear-gradient(to bottom, transparent, #0a0a0b)' }} />
      </section>

      {/* ── STATS ────────────────────────────────────────────────────────── */}
      <section className="px-6 py-10">
        <div className="mx-auto grid grid-cols-2 md:grid-cols-4 gap-4" style={{ maxWidth: 900 }}>
          {STATS.map(s => (
            <div key={s.label} className="text-center py-6 px-4 rounded-2xl"
              style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.06)' }}>
              <p className="font-extrabold text-3xl mb-1" style={{ color: '#E30613' }}>{s.value}</p>
              <p className="text-xs" style={{ color: '#6b6b78' }}>{s.label}</p>
            </div>
          ))}
        </div>
      </section>

      {/* ── AREAS ────────────────────────────────────────────────────────── */}
      <section className="px-6 py-20">
        <div className="mx-auto" style={{ maxWidth: 1100 }}>
          <div className="text-center mb-12">
            <p className="text-xs font-semibold uppercase tracking-widest mb-3" style={{ color: '#E30613' }}>
              Nossas áreas
            </p>
            <h2 className="text-4xl font-bold" style={{ color: '#f0f0f2' }}>
              Tudo em um só lugar
            </h2>
          </div>

          <div className="grid md:grid-cols-3 gap-6">
            {FEATURED_SERVICES.map(area => (
              <Link key={area.area} to={area.href}
                className="group relative overflow-hidden rounded-2xl transition-transform duration-300 hover:-translate-y-1"
                style={{ background: '#141416', border: '1px solid rgba(255,255,255,0.07)' }}>
                <div className="relative overflow-hidden" style={{ height: 200 }}>
                  <img src={area.image} alt={area.area} className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-105" />
                  <div className="absolute inset-0" style={{ background: 'linear-gradient(to top, rgba(20,20,22,0.95) 0%, rgba(20,20,22,0.3) 100%)' }} />
                  <span className="absolute top-4 left-4 text-3xl">{area.icon}</span>
                </div>
                <div className="p-5">
                  <p className="font-bold text-base mb-3" style={{ color: '#f0f0f2' }}>{area.area}</p>
                  <div className="flex flex-col gap-1.5">
                    {area.services.map(s => (
                      <p key={s} className="text-sm" style={{ color: '#6b6b78' }}>· {s}</p>
                    ))}
                  </div>
                  <div className="mt-4 flex items-center gap-2 text-sm font-semibold" style={{ color: area.color }}>
                    Conhecer →
                  </div>
                </div>
              </Link>
            ))}
          </div>
        </div>
      </section>

      {/* ── PORTFOLIO PREVIEW ────────────────────────────────────────────── */}
      <section className="px-6 py-20" style={{ background: 'rgba(255,255,255,0.02)' }}>
        <div className="mx-auto" style={{ maxWidth: 1100 }}>
          <div className="flex items-end justify-between mb-10">
            <div>
              <p className="text-xs font-semibold uppercase tracking-widest mb-2" style={{ color: '#E30613' }}>Portfólio</p>
              <h2 className="text-3xl font-bold" style={{ color: '#f0f0f2' }}>Projetos recentes</h2>
            </div>
            <Link to="/portfolio" className="text-sm font-semibold" style={{ color: '#9090a0' }}>
              Ver todos →
            </Link>
          </div>

          <div className="grid md:grid-cols-3 gap-5">
            {PORTFOLIO_ITEMS.map(item => (
              <Link key={item.title} to={item.href}
                className="group overflow-hidden rounded-2xl transition-all duration-300 hover:-translate-y-1"
                style={{ background: '#141416', border: '1px solid rgba(255,255,255,0.07)' }}>
                <div className="relative overflow-hidden" style={{ height: 200 }}>
                  <img src={item.image} alt={item.title} className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-105" />
                </div>
                <div className="p-4">
                  <p className="text-xs mb-1" style={{ color: '#E30613' }}>{item.category}</p>
                  <p className="font-semibold text-sm" style={{ color: '#f0f0f2' }}>{item.title}</p>
                </div>
              </Link>
            ))}
          </div>
        </div>
      </section>

      {/* ── CTA CADASTRO ─────────────────────────────────────────────────── */}
      <section className="px-6 py-24">
        <div className="mx-auto text-center max-w-2xl" style={{ maxWidth: 700 }}>
          <h2 className="text-4xl font-extrabold mb-5 leading-tight" style={{ color: '#f0f0f2' }}>
            Acompanhe seus projetos<br />
            <span style={{ color: '#E30613' }}>direto na plataforma</span>
          </h2>
          <p className="mb-8" style={{ color: '#6b6b78', lineHeight: 1.7 }}>
            Crie sua conta gratuita e tenha acesso ao portal do cliente. Pedidos, orçamentos, conversas,
            arquivos e notificações — tudo organizado, sem WhatsApp.
          </p>
          <div className="flex flex-wrap gap-4 justify-center">
            <Link to="/cadastro" className="px-8 py-4 rounded-full font-bold text-base"
              style={{ background: '#E30613', color: '#fff' }}>
              Criar conta grátis
            </Link>
            <Link to="/login" className="px-8 py-4 rounded-full font-bold text-base"
              style={{ border: '1px solid rgba(255,255,255,0.15)', color: '#9090a0' }}>
              Já tenho conta
            </Link>
          </div>
        </div>
      </section>
    </PublicLayout>
  )
}
