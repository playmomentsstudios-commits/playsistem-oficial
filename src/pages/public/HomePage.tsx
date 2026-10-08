import { Link } from 'react-router-dom'
import { useEffect,useState } from 'react'
import { siteContentApi,type SiteProfile,type SiteSettings } from '../../services/siteContent'
import { PublicLayout } from '../../layouts/PublicLayout'
import { PlayLabExperience } from '../../components/public/PlayLabExperience'
import { DigitalLiteracyCover } from '../../components/academy/DigitalLiteracyCover'
import { useAuth } from '../../contexts/AuthContext'
import { conversationLink } from '../../lib/navigation'
import { trackConversion } from '../../lib/analytics'
import { supabase } from '../../lib/supabase'

export function HomePage() {
  const { role } = useAuth()
  const [profile,setProfile]=useState<SiteProfile|null>(null)
  const [siteSettings,setSiteSettings]=useState<SiteSettings|null>(null)
  const [courseCoverUrl,setCourseCoverUrl]=useState<string|null>(null)

  useEffect(()=>{
    Promise.all([
      siteContentApi.profile(),
      siteContentApi.settings(),
      supabase.rpc('academy_public_course',{course_slug:'letramento-digital'}),
    ])
      .then(([p,s,course])=>{
        setProfile(p)
        setSiteSettings(s)
        const url=course?.data?.course?.cover_url
        setCourseCoverUrl(typeof url==='string'&&url.trim()?url:null)
      })
      .catch(()=>undefined)
  },[])

  const quote = conversationLink(role, 'orcamento')
  const academyHref = '/academia'
  const clientHref = role === 'customer' ? '/app/dashboard' : role ? '/admin' : '/login?next=%2Fapp%2Fdashboard'

  return (
    <PublicLayout>
      <PlayLabExperience
        accent={siteSettings?.primary_color?.toLowerCase()==='#e30613'?'#A65A2A':(siteSettings?.primary_color||'#A65A2A')}
        clientHref={clientHref}
        quoteHref={quote}
        academyHref={academyHref}
      />

      <section className="px-3 sm:px-5 py-7 sm:py-10 md:py-14" aria-labelledby="free-course-title">
        <div
          className="max-w-6xl mx-auto rounded-3xl overflow-hidden relative"
          style={{
            background:'linear-gradient(135deg,#171719,#101011)',
            border:'1px solid rgba(166,90,42,.22)',
            boxShadow:'0 28px 90px rgba(0,0,0,.22)',
          }}
        >
          <div className="grid lg:grid-cols-[1.08fr_.92fr] items-stretch">
            <div className="relative p-5 sm:p-6 md:p-10 lg:p-12 flex flex-col justify-center order-2 lg:order-1">
              <div className="absolute left-0 top-0 w-72 h-72 pointer-events-none" style={{background:'radial-gradient(circle,rgba(166,90,42,.11),transparent 68%)'}} />
              <div className="relative">
                <span className="inline-flex px-3 py-1 rounded-full text-xs font-bold" style={{background:'rgba(16,185,129,.1)',color:'#6ee7b7'}}>
                  Curso gratuito · sem cadastro para assistir
                </span>
                <h2 id="free-course-title" className="text-[2rem] sm:text-3xl md:text-5xl font-extrabold mt-4 leading-[.98]" style={{color:'#f0f0f2'}}>
                  Letramento Digital <span style={{color:'#A65A2A'}}>gratuito e aberto</span>
                </h2>
                <p className="mt-4 max-w-2xl leading-relaxed" style={{color:'#9090a0'}}>
                  Comece agora, sem criar conta. Aprenda fundamentos de tecnologia, comunicação, informação e inteligência artificial no seu ritmo.
                </p>
                <div className="flex flex-col sm:flex-row sm:flex-wrap sm:items-center gap-3 sm:gap-4 mt-6">
                  <Link
                    to="/curso/letramento-digital"
                    onClick={()=>trackConversion('academy_interest',{source:'home_free_course'})}
                    className="w-full sm:w-auto px-6 py-3.5 sm:py-3 rounded-xl font-bold text-sm text-center min-h-12 inline-flex items-center justify-center"
                    style={{background:'#A65A2A',color:'#fff'}}
                  >
                    Começar curso grátis →
                  </Link>
                  <span className="text-xs max-w-sm" style={{color:'#6b6b78'}}>
                    Sem login para assistir · entre apenas para salvar progresso, fazer atividades e emitir certificado.
                  </span>
                </div>
              </div>
            </div>

            <Link
              to="/curso/letramento-digital"
              onClick={()=>trackConversion('academy_interest',{source:'home_free_course_cover'})}
              className="relative min-h-[220px] sm:min-h-[280px] lg:min-h-[390px] group overflow-hidden order-1 lg:order-2"
              aria-label="Abrir o curso Letramento Digital"
            >
              {courseCoverUrl
                ? <img
                    src={courseCoverUrl}
                    alt="Capa do curso Letramento Digital"
                    className="absolute inset-0 w-full h-full object-cover transition-transform duration-500 group-hover:scale-[1.015]"
                  />
                : <DigitalLiteracyCover className="rounded-none transition-transform duration-500 group-hover:scale-[1.015]" />}
              <div className="absolute inset-y-0 left-0 w-24 pointer-events-none" style={{background:'linear-gradient(90deg,#121214,transparent)'}}/>
            </Link>
          </div>
        </div>
      </section>

      <section className="px-4 sm:px-6 py-8 sm:py-12">
        <div className="mx-auto grid grid-cols-2 md:grid-cols-4 gap-4" style={{ maxWidth: 900 }}>
          {[
            profile?.projects_delivered_label&&{value:profile.projects_delivered_label,label:'Projetos entregues'},
            profile?.clients_served_label&&{value:profile.clients_served_label,label:'Clientes atendidos'},
            profile?.market_since&&{value:'Desde '+profile.market_since,label:'No mercado'},
            profile?.satisfaction_label&&{value:profile.satisfaction_label,label:'Satisfação'},
          ].filter((s):s is {value:string;label:string}=>Boolean(s)).map(s => (
            <div key={s.label} className="text-center py-4 sm:py-5 px-3 sm:px-4 rounded-2xl"
              style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.06)' }}>
              <p className="font-extrabold text-3xl mb-1" style={{ color: '#A65A2A' }}>{s.value}</p>
              <p className="text-xs" style={{ color: '#6b6b78' }}>{s.label}</p>
            </div>
          ))}
        </div>
      </section>

      <section className="px-4 sm:px-6 py-16 sm:py-24">
        <div className="mx-auto text-center max-w-2xl" style={{ maxWidth: 700 }}>
          <h2 className="text-3xl sm:text-4xl font-extrabold mb-5 leading-tight" style={{ color: '#f0f0f2' }}>
            Acompanhe seus projetos<br />
            <span style={{ color: '#A65A2A' }}>direto na plataforma</span>
          </h2>
          <p className="mb-8" style={{ color: '#6b6b78', lineHeight: 1.7 }}>
            Crie sua conta gratuita e tenha acesso ao portal do cliente. Pedidos, orçamentos, conversas,
            arquivos e notificações — tudo organizado, sem perder informações em conversas espalhadas.
          </p>
          <div className="flex flex-col sm:flex-row flex-wrap gap-3 sm:gap-4 justify-center">
            <Link to="/cadastro" className="w-full sm:w-auto px-8 py-4 rounded-full font-bold text-base text-center"
              style={{ background: '#A65A2A', color: '#fff' }}>
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
