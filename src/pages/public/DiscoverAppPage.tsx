import { Link } from 'react-router-dom'
import { PublicLayout } from '../../layouts/PublicLayout'
import { BrandImage } from '../../components/BrandImage'
import { useAuth } from '../../contexts/AuthContext'
import { SAGAMENTE_APP_INVITE_URL } from '../../lib/shareSagamenteApp'
import { trackConversion } from '../../lib/analytics'

const FEATURES = [
  {symbol:'01',title:'Serviços criativos e digitais',detail:'Encontre soluções de design, audiovisual e tecnologia e solicite um orçamento.',href:'/servicos',label:'Explorar serviços'},
  {symbol:'02',title:'Produtos e equipamentos',detail:'Consulte produtos e equipamentos publicados no catálogo e escolha o que faz sentido para você.',href:'/produtos',label:'Ver produtos'},
  {symbol:'03',title:'Academia e treinamentos',detail:'Conheça cursos e conteúdos de aprendizagem. Alguns materiais estão disponíveis gratuitamente, mesmo sem cadastro.',href:'/academia',label:'Conhecer a Academia'},
  {symbol:'04',title:'E-books e audiobooks',detail:'Reúna sua experiência de estudo com materiais digitais disponíveis na biblioteca da Academia.',href:'/academia',label:'Explorar conteúdos'},
  {symbol:'05',title:'Projetos, etapas e arquivos',detail:'Quando tiver um projeto com a Sagamente, acompanhe etapas, revisões, entregas e materiais no seu espaço.',href:null,label:null},
  {symbol:'06',title:'Pedidos, pagamentos e conversas',detail:'Consulte seus pedidos, orçamentos, avisos e conversas em uma área privada, vinculada à sua conta.',href:null,label:null},
] as const

const REGISTER_PATH='/cadastro?next=%2Fapp%2Fdashboard'
const LOGIN_PATH='/login?next=%2Fapp%2Fdashboard'

export function DiscoverAppPage(){
  const {isAuthenticated,user}=useAuth()
  const appPath=user?.role==='admin'||user?.role==='staff'?'/admin':'/app/dashboard'
  const primaryPath=isAuthenticated?appPath:REGISTER_PATH
  const primaryLabel=isAuthenticated?'Abrir minha conta':'Criar conta gratuita'

  return <PublicLayout>
    <div className="bg-[#0a0a0b] text-[#f0f0f2]">
      <section className="relative overflow-hidden border-b border-white/[.07] px-4 py-14 sm:py-20 lg:py-24">
        <div aria-hidden="true" className="pointer-events-none absolute -right-32 -top-40 h-[520px] w-[520px] rounded-full bg-[#A65A2A]/[.09] blur-[110px]"/>
        <div className="relative mx-auto max-w-6xl grid gap-10 lg:grid-cols-[1.1fr_.9fr] lg:items-center">
          <div>
            <p className="text-[11px] font-semibold uppercase tracking-[.22em] text-[#DFA269]">Sagamente · Aplicativo e plataforma</p>
            <h1 className="mt-4 max-w-3xl text-4xl font-extrabold leading-[1.05] tracking-tight sm:text-5xl lg:text-6xl">
              Descubra, aprenda e acompanhe. <span className="text-[#DFA269]">Tudo em um lugar.</span>
            </h1>
            <p className="mt-5 max-w-xl text-sm leading-7 text-[#a2a2ad] sm:text-base">
              Conheça serviços, produtos, cursos e materiais da Sagamente. Ao criar uma conta,
              você ganha um espaço para acompanhar suas solicitações, seus projetos e suas atividades.
            </p>
            <div className="mt-7 flex flex-wrap gap-3">
              <Link onClick={()=>trackConversion('signup_interest',{source:'share_app_landing'})} to={primaryPath} className="inline-flex min-h-12 w-full items-center justify-center rounded-xl bg-[#A65A2A] px-6 text-sm font-bold text-white sm:w-auto">{primaryLabel} →</Link>
              <Link to="/academia" className="inline-flex min-h-12 w-full items-center justify-center rounded-xl border border-white/15 bg-white/[.035] px-6 text-sm font-semibold text-white sm:w-auto">Ver cursos e conteúdos</Link>
            </div>
            {!isAuthenticated&&<p className="mt-4 text-xs text-[#8f8f99]">Já tem cadastro? <Link to={LOGIN_PATH} className="font-semibold text-[#DFA269] underline underline-offset-4">Entrar na minha conta</Link></p>}
          </div>
          <div className="relative rounded-3xl border border-white/10 bg-gradient-to-br from-[#1b1716] via-[#121213] to-[#0f0f11] p-5 shadow-[0_26px_80px_rgba(0,0,0,.3)] sm:p-7" aria-label="Ilustração das possibilidades da plataforma">
            <div className="mb-5 flex items-center justify-between border-b border-white/10 pb-4">
              <BrandImage variant="dark" alt="Sagamente" className="h-8 w-auto"/>
              <span className="rounded-full border border-[#A65A2A]/30 bg-[#A65A2A]/10 px-2.5 py-1 text-[10px] font-medium text-[#DFA269]">Seu espaço digital</span>
            </div>
            <div className="mb-3 grid grid-cols-2 gap-3">
              {[['Projetos','Acompanhe etapas'],['Academia','Aprenda no seu ritmo'],['Materiais','Organize entregas'],['Serviços','Encontre soluções']].map(([title,desc])=>
                <div key={title} className="min-h-24 rounded-xl border border-white/10 bg-white/[.035] p-4">
                  <span aria-hidden="true" className="mb-3 block h-1.5 w-10 rounded-full bg-[#A65A2A]/75"/>
                  <p className="text-sm font-semibold">{title}</p>
                  <p className="mt-1 text-[11px] leading-4 text-[#92929d]">{desc}</p>
                </div>
              )}
            </div>
            <div className="rounded-xl border border-white/10 bg-black/25 px-4 py-3 text-xs leading-5 text-[#aaaab5]">
              <span className="font-semibold text-[#f0f0f2]">Uma demonstração das áreas do aplicativo.</span> Seus dados só aparecem após entrar na sua conta.
            </div>
          </div>
        </div>
      </section>

      <section className="mx-auto max-w-6xl px-4 py-14 sm:py-20" aria-labelledby="features-heading">
        <p className="text-xs font-semibold uppercase tracking-[.18em] text-[#DFA269]">O que você encontra</p>
        <h2 id="features-heading" className="mt-3 text-2xl font-bold sm:text-3xl">Conheça todas as possibilidades</h2>
        <p className="mt-3 max-w-2xl text-sm leading-6 text-[#9b9ba6]">Explore livremente as áreas públicas. Sua conta serve para guardar e acompanhar o que for seu.</p>
        <div className="mt-8 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {FEATURES.map(feature=><article key={feature.symbol} className="flex flex-col rounded-2xl border border-white/10 bg-[#141416] p-5">
            <span className="text-xs font-bold tracking-widest text-[#DFA269]">{feature.symbol}</span>
            <h3 className="mt-4 text-base font-bold text-[#f0f0f2]">{feature.title}</h3>
            <p className="mt-2 flex-1 text-sm leading-6 text-[#9696a1]">{feature.detail}</p>
            {feature.href&&<Link to={feature.href} className="mt-5 inline-flex min-h-10 items-center text-xs font-semibold text-[#DFA269] hover:underline">{feature.label} →</Link>}
          </article>)}
        </div>
      </section>

      <section className="border-t border-white/10 bg-[#111113] px-4 py-14 sm:py-16">
        <div className="mx-auto max-w-4xl text-center">
          <h2 className="text-2xl font-bold sm:text-3xl">Gostou? Comece pela sua conta.</h2>
          <p className="mx-auto mt-4 max-w-2xl text-sm leading-6 text-[#aaaab5]">O cadastro é gratuito. Você confirma seu e-mail e pode conhecer os conteúdos e as ferramentas disponíveis. Pedidos, projetos e histórico aparecem conforme suas atividades na Sagamente.</p>
          <div className="mt-7 flex flex-wrap justify-center gap-3">
            <Link to={primaryPath} className="inline-flex min-h-12 items-center justify-center rounded-xl bg-[#A65A2A] px-6 text-sm font-bold text-white">{primaryLabel}</Link>
            <Link to="/instalar" className="inline-flex min-h-12 items-center justify-center rounded-xl border border-white/15 px-6 text-sm font-semibold text-white">Instalar o app</Link>
          </div>
          <p className="mt-5 text-[11px] text-[#7c7c87]">Convite público · {SAGAMENTE_APP_INVITE_URL.replace('https://','')}</p>
        </div>
      </section>
    </div>
  </PublicLayout>
}
