import { Link } from 'react-router-dom'
import { useEffect,useState } from 'react'
import { siteContentApi,type HomeServiceArea,type PortfolioItem,type SiteProfile,type SiteSettings } from '../../services/siteContent'
import { PublicLayout } from '../../layouts/PublicLayout'
import { useAuth } from '../../contexts/AuthContext'
import { conversationLink } from '../../lib/navigation'


export function HomePage() {
  const { role } = useAuth()
  const [profile,setProfile]=useState<SiteProfile|null>(null)
  const [portfolio,setPortfolio]=useState<PortfolioItem[]>([])
  const [siteSettings,setSiteSettings]=useState<SiteSettings|null>(null)
  const [serviceAreas,setServiceAreas]=useState<HomeServiceArea[]>([])
  useEffect(()=>{Promise.all([siteContentApi.profile(),siteContentApi.portfolioItems(),siteContentApi.settings(),siteContentApi.homeServiceAreas()]).then(([p,i,s,a])=>{setProfile(p);setPortfolio(i.filter(item=>item.featured).slice(0,3));setSiteSettings(s);setServiceAreas(a);if(s.meta_description){document.title=s.company_name;document.querySelector('meta[name="description"]')?.setAttribute('content',s.meta_description)}}).catch(()=>undefined)},[])
  const quote = conversationLink(role, 'orcamento')
  const academyHref = role === 'customer' ? '/app/academia' : role ? '/admin/academia' : '/cadastro?next=%2Fapp%2Facademia'
  const clientHref = role === 'customer' ? '/app/dashboard' : role ? '/admin' : '/login?next=%2Fapp%2Fdashboard'
  const quickLinks = [
    { title: 'Contratar um serviço', description: 'Design, sites, audiovisual, áudio e soluções digitais.', icon: '✦', href: '/servicos' },
    { title: 'Comprar um produto', description: 'Produtos e equipamentos disponíveis para compra.', icon: '◇', href: '/produtos' },
    { title: 'Aprender', description: 'Cursos, conteúdos e formações da Academia Play Moments.', icon: '◌', href: academyHref },
    { title: 'Área do cliente', description: 'Projetos, arquivos, pagamentos e acompanhamento em um só lugar.', icon: '↗', href: clientHref },
  ]
  return (
    <PublicLayout>
      <section className="relative text-center px-5 py-10 sm:py-16 overflow-hidden">
        <div className="absolute inset-0 pointer-events-none" style={{ background: 'radial-gradient(ellipse at top, rgba(227,6,19,0.09), transparent 70%)' }} />
        <div className="relative max-w-4xl mx-auto">
          <h1 className="font-extrabold leading-tight mb-4" style={{ fontSize: 'clamp(2rem, 5vw, 3.75rem)', letterSpacing: '-0.02em', color: '#f0f0f2' }}>
            O que você quer <span style={{ color: siteSettings?.primary_color||'#E30613' }}>realizar hoje?</span>
          </h1>
          <p className="text-base sm:text-lg mb-6 max-w-xl mx-auto" style={{ color: '#9090a0' }}>
            Encontre produtos, serviços e soluções da Play Moments para o que você precisa.
          </p>
          <div className="grid grid-cols-2 gap-3 max-w-2xl mx-auto">
            <Link to="/servicos" className="px-4 py-4 rounded-2xl font-semibold text-left" style={{ background: '#E30613', color: '#fff' }}>
              <span className="block text-sm font-bold">Quero contratar</span>
              <span className="block text-xs mt-1 opacity-80">Serviços e soluções</span>
            </Link>
            <Link to="/produtos" className="px-4 py-4 rounded-2xl font-semibold text-left" style={{ background: 'rgba(255,255,255,0.07)', color: '#f0f0f2', border: '1px solid rgba(255,255,255,0.08)' }}>
              <span className="block text-sm font-bold">Quero comprar</span>
              <span className="block text-xs mt-1" style={{ color: '#9090a0' }}>Produtos e equipamentos</span>
            </Link>
            <Link to={academyHref} className="px-4 py-4 rounded-2xl font-semibold text-left" style={{ background: 'rgba(255,255,255,0.07)', color: '#f0f0f2', border: '1px solid rgba(255,255,255,0.08)' }}>
              <span className="block text-sm font-bold">Quero aprender</span>
              <span className="block text-xs mt-1" style={{ color: '#9090a0' }}>Cursos e Academia</span>
            </Link>
            <Link to={clientHref} className="px-4 py-4 rounded-2xl font-semibold text-left" style={{ background: 'rgba(255,255,255,0.07)', color: '#f0f0f2', border: '1px solid rgba(255,255,255,0.08)' }}>
              <span className="block text-sm font-bold">Já sou cliente</span>
              <span className="block text-xs mt-1" style={{ color: '#9090a0' }}>Acompanhar meu trabalho</span>
            </Link>
          </div>
          <Link to={quote} className="inline-flex items-center min-h-11 mt-4 text-sm font-semibold underline underline-offset-4" style={{ color: '#ff6b7a' }}>Tenho um projeto personalizado</Link>
          <span className="mx-2 text-xs" style={{ color: '#4f4f59' }}>•</span><Link to={conversationLink(role, 'duvida')} className="inline-flex items-center min-h-11 mt-3 text-sm underline underline-offset-4" style={{ color: '#9090a0' }}>Não encontrei o que preciso</Link>
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
          {[
            {value:profile?.projects_delivered_label||'8 mil+',label:'Projetos entregues'},
            {value:profile?.clients_served_label||'2 mil+',label:'Clientes atendidos'},
            {value:'Desde '+(profile?.market_since||2008),label:'No mercado'},
            {value:profile?.satisfaction_label||'85%',label:'Satisfação'},
          ].map(s => (
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
              {siteSettings?.home_areas_eyebrow||'Nossas áreas'}
            </p>
            <h2 className="text-4xl font-bold" style={{ color: '#f0f0f2' }}>
              {siteSettings?.home_areas_title||'Tudo em um só lugar'}
            </h2>
          </div>

          <div className="grid md:grid-cols-3 gap-6">
            {serviceAreas.map(area => (
              <Link key={area.id} to={area.href}
                className="group relative overflow-hidden rounded-2xl transition-transform duration-300 hover:-translate-y-1"
                style={{ background: '#141416', border: '1px solid rgba(255,255,255,0.07)' }}>
                <div className="relative overflow-hidden" style={{ height: 200 }}>
                  <img src={area.image_url||''} alt={area.title} className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-105" />
                  <div className="absolute inset-0" style={{ background: 'linear-gradient(to top, rgba(20,20,22,0.95) 0%, rgba(20,20,22,0.3) 100%)' }} />
                  <span className="absolute top-4 left-4 text-3xl">{area.icon||'◆'}</span>
                </div>
                <div className="p-5">
                  <p className="font-bold text-base mb-3" style={{ color: '#f0f0f2' }}>{area.title}</p>
                  <div className="flex flex-col gap-1.5">
                    {area.topics.map(s => (
                      <p key={s} className="text-sm" style={{ color: '#6b6b78' }}>· {s}</p>
                    ))}
                  </div>
                  <div className="mt-4 flex items-center gap-2 text-sm font-semibold" style={{ color: area.accent_color }}>
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
            <Link to="/quem-somos#portfolio" className="text-sm font-semibold" style={{ color: '#9090a0' }}>
              Ver todos →
            </Link>
          </div>

          <div className="grid md:grid-cols-3 gap-5">
            {portfolio.map(item => (
              <Link key={item.id} to="/quem-somos#portfolio"
                className="group overflow-hidden rounded-2xl transition-all duration-300 hover:-translate-y-1"
                style={{ background: '#141416', border: '1px solid rgba(255,255,255,0.07)' }}>
                <div className="relative overflow-hidden bg-white/[0.03]" style={{ height: 200 }}>
                  {item.cover_url?<img src={item.cover_url} alt={item.title} className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-105" />:<div className="w-full h-full flex items-center justify-center text-4xl opacity-30">◆</div>}
                </div>
                <div className="p-4">
                  <p className="text-xs mb-1" style={{ color: '#E30613' }}>{item.category?.name||item.client||'Projeto'}</p>
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
