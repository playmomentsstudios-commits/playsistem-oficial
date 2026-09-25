import { Link } from 'react-router-dom'
import { PublicLayout } from '../../layouts/PublicLayout'
import { useAuth } from '../../contexts/AuthContext'
import { conversationLink } from '../../lib/navigation'

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
  const { role } = useAuth()
  const contact = conversationLink(role)
  const quote = conversationLink(role, 'orcamento')
  const quickLinks = [
    { title: 'Falar com a Play Moments', description: 'Converse direto com nossa equipe.', icon: '◌', href: contact },
    { title: 'Solicitar orçamento', description: 'Conte sua ideia e o que precisa.', icon: '✎', href: quote },
    { title: 'Produtos', description: 'Encontre produtos e equipamentos.', icon: '◇', href: '/produtos' },
    { title: 'Serviços', description: 'Conheça nossas soluções para você.', icon: '✦', href: '/servicos' },
  ]
  return (
    <PublicLayout>
      <section className="relative text-center px-5 py-10 sm:py-16 overflow-hidden">
        <div className="absolute inset-0 pointer-events-none" style={{ background: 'radial-gradient(ellipse at top, rgba(227,6,19,0.09), transparent 70%)' }} />
        <div className="relative max-w-4xl mx-auto">
          <h1 className="font-extrabold leading-tight mb-4" style={{ fontSize: 'clamp(2rem, 5vw, 3.75rem)', letterSpacing: '-0.02em', color: '#f0f0f2' }}>
            O que você <span style={{ color: '#E30613' }}>precisa hoje?</span>
          </h1>
          <p className="text-base sm:text-lg mb-6 max-w-xl mx-auto" style={{ color: '#9090a0' }}>
            Criação, design, tecnologia e audiovisual. Produtos e serviços Play Moments para tirar suas ideias do papel.
          </p>
          <div className="grid grid-cols-2 sm:flex sm:flex-wrap justify-center gap-3">
            <Link to={contact} className="col-span-2 sm:col-span-1 px-6 py-3 rounded-full font-bold" style={{ background: '#E30613', color: '#fff' }}>Falar agora</Link>
            <Link to={quote} className="col-span-2 sm:col-span-1 px-6 py-3 rounded-full font-semibold" style={{ border: '1px solid #E30613', color: '#ff6b7a', background: 'rgba(227,6,19,0.08)' }}>Solicitar orçamento</Link>
            <Link to="/produtos" className="px-4 py-3 rounded-full font-semibold" style={{ background: 'rgba(255,255,255,0.06)', color: '#f0f0f2' }}>Ver produtos</Link>
            <Link to="/servicos" className="px-4 py-3 rounded-full font-semibold" style={{ background: 'rgba(255,255,255,0.06)', color: '#f0f0f2' }}>Ver serviços</Link>
          </div>
          <Link to={conversationLink(role, 'duvida')} className="inline-flex items-center min-h-11 mt-3 text-sm underline underline-offset-4" style={{ color: '#c0c0cc' }}>Tirar dúvidas</Link>
        </div>
      </section>

      <section className="px-5 pb-8" aria-labelledby="quick-access-title">
        <div className="max-w-6xl mx-auto">
          <h2 id="quick-access-title" className="text-xl font-bold mb-4" style={{ color: '#f0f0f2' }}>Acessos rápidos</h2>
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
            {quickLinks.map(item => (
              <Link key={item.title} to={item.href} className="p-4 rounded-2xl hover:-translate-y-1 transition-transform" style={{ background: '#141416', border: '1px solid rgba(255,255,255,0.08)' }}>
                <span aria-hidden="true" className="text-2xl" style={{ color: '#ff6b7a' }}>{item.icon}</span>
                <h3 className="font-semibold text-sm mt-2 mb-1" style={{ color: '#f0f0f2' }}>{item.title}</h3>
                <p className="text-xs" style={{ color: '#9090a0' }}>{item.description}</p>
              </Link>
            ))}
          </div>
        </div>
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
