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
  useEffect(()=>{Promise.all([siteContentApi.profile(),siteContentApi.portfolioItems(),siteContentApi.settings(),siteContentApi.homeServiceAreas()]).then(([p,i,s,a])=>{setProfile(p);setPortfolio(i.filter(item=>item.featured).slice(0,3));setSiteSettings(s);setServiceAreas(a)}).catch(()=>undefined)},[])
  const quote = conversationLink(role, 'orcamento')
  const academyHref = '/academia'
  const clientHref = role === 'customer' ? '/app/dashboard' : role ? '/admin' : '/login?next=%2Fapp%2Fdashboard'
  return (
    <PublicLayout>
      <section className="relative text-center px-5 py-10 sm:py-16 overflow-hidden">
        <div className="absolute inset-0 pointer-events-none" style={{ background: 'radial-gradient(ellipse at top, rgba(227,6,19,0.09), transparent 70%)' }} />
        <div className="relative max-w-4xl mx-auto">
          <h1 className="font-extrabold leading-tight mb-4" style={{ fontSize: 'clamp(2rem, 5vw, 3.75rem)', letterSpacing: '-0.02em', color: '#f0f0f2' }}>
            Criação, tecnologia e conhecimento <span style={{ color: siteSettings?.primary_color||'#E30613' }}>para tirar projetos do papel.</span>
          </h1>
          <p className="text-base sm:text-lg mb-6 max-w-xl mx-auto" style={{ color: '#9090a0' }}>
            Da ideia à entrega: contrate serviços, encontre equipamentos, aprenda e acompanhe tudo pela mesma plataforma.
          </p>
          <div className="grid grid-cols-2 gap-3 max-w-2xl mx-auto">
            <Link to="/servicos" className="px-4 py-4 rounded-2xl font-semibold text-left" style={{ background: '#E30613', color: '#fff' }}>
              <span className="block text-sm font-bold">Contratar um serviço</span>
              <span className="block text-xs mt-1 opacity-80">Serviços e soluções</span>
            </Link>
            <Link to="/produtos" className="px-4 py-4 rounded-2xl font-semibold text-left" style={{ background: 'rgba(255,255,255,0.07)', color: '#f0f0f2', border: '1px solid rgba(255,255,255,0.08)' }}>
              <span className="block text-sm font-bold">Comprar ou alugar</span>
              <span className="block text-xs mt-1" style={{ color: '#9090a0' }}>Produtos e equipamentos</span>
            </Link>
            <Link to={academyHref} className="px-4 py-4 rounded-2xl font-semibold text-left" style={{ background: 'rgba(255,255,255,0.07)', color: '#f0f0f2', border: '1px solid rgba(255,255,255,0.08)' }}>
              <span className="block text-sm font-bold">Aprender gratuitamente</span>
              <span className="block text-xs mt-1" style={{ color: '#9090a0' }}>Cursos e Academia</span>
            </Link>
            <Link to={clientHref} className="px-4 py-4 rounded-2xl font-semibold text-left" style={{ background: 'rgba(255,255,255,0.07)', color: '#f0f0f2', border: '1px solid rgba(255,255,255,0.08)' }}>
              <span className="block text-sm font-bold">Acessar minha área</span>
              <span className="block text-xs mt-1" style={{ color: '#9090a0' }}>Acompanhar meu trabalho</span>
            </Link>
          </div>
          <Link to={quote} className="inline-flex items-center min-h-11 mt-4 text-sm font-semibold underline underline-offset-4" style={{ color: '#ff6b7a' }}>Preciso de algo personalizado</Link>
          <span className="mx-2 text-xs" style={{ color: '#4f4f59' }}>•</span><Link to={conversationLink(role, 'duvida')} className="inline-flex items-center min-h-11 mt-3 text-sm underline underline-offset-4" style={{ color: '#9090a0' }}>Falar com a Play Moments</Link>
        </div>
      </section>

      <section className="px-5 py-10" aria-labelledby="free-course-title">
        <div className="max-w-6xl mx-auto rounded-3xl overflow-hidden relative p-6 md:p-10" style={{background:'linear-gradient(135deg,#171719,#101011)',border:'1px solid rgba(227,6,19,.22)'}}>
          <div className="absolute right-0 top-0 w-72 h-72 pointer-events-none" style={{background:'radial-gradient(circle,rgba(227,6,19,.14),transparent 68%)'}} />
          <div className="relative max-w-3xl">
            <span className="inline-flex px-3 py-1 rounded-full text-xs font-bold" style={{background:'rgba(16,185,129,.1)',color:'#6ee7b7'}}>Curso gratuito · sem cadastro para assistir</span>
            <h2 id="free-course-title" className="text-3xl md:text-4xl font-extrabold mt-4" style={{color:'#f0f0f2'}}>Letramento Digital <span style={{color:'#E30613'}}>gratuito e aberto</span></h2>
            <p className="mt-4 max-w-2xl leading-relaxed" style={{color:'#9090a0'}}>Comece agora, sem criar conta. Aprenda fundamentos de tecnologia, comunicação, informação e inteligência artificial no seu ritmo.</p>
            <div className="flex flex-wrap items-center gap-4 mt-6"><Link to="/curso/letramento-digital" className="px-6 py-3 rounded-xl font-bold text-sm" style={{background:'#E30613',color:'#fff'}}>Começar curso grátis →</Link><span className="text-xs" style={{color:'#6b6b78'}}>Sem login para assistir · entre apenas para salvar progresso, fazer atividades e emitir certificado.</span></div>
          </div>
        </div>
      </section>

      {/* ── STATS ────────────────────────────────────────────────────────── */}
      <section className="px-6 py-12">
        <div className="mx-auto grid grid-cols-2 md:grid-cols-4 gap-4" style={{ maxWidth: 900 }}>
          {[
            profile?.projects_delivered_label&&{value:profile.projects_delivered_label,label:'Projetos entregues'},
            profile?.clients_served_label&&{value:profile.clients_served_label,label:'Clientes atendidos'},
            profile?.market_since&&{value:'Desde '+profile.market_since,label:'No mercado'},
            profile?.satisfaction_label&&{value:profile.satisfaction_label,label:'Satisfação'},
          ].filter((s):s is {value:string;label:string}=>Boolean(s)).map(s => (
            <div key={s.label} className="text-center py-5 px-4 rounded-2xl"
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
              <h2 className="text-3xl font-bold" style={{ color: '#f0f0f2' }}>Trabalhos e projetos</h2>
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
            arquivos e notificações — tudo organizado, sem perder informações em conversas espalhadas.
          </p>
          <div className="flex flex-wrap gap-4 justify-center">
            <Link to="/cadastro" className="px-8 py-4 rounded-full font-bold text-base"
              style={{ background: '#E30613', color: '#fff' }}>
              Criar minha conta
            </Link>
            <Link to="/login" className="px-8 py-4 rounded-full font-bold text-base"
              style={{ border: '1px solid rgba(255,255,255,0.15)', color: '#9090a0' }}>
              Entrar
            </Link>
          </div>
        </div>
      </section>
    </PublicLayout>
  )
}
