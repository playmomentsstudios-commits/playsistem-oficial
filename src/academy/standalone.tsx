import { lazy, Suspense, useEffect, useMemo, useState, type FormEvent } from 'react'
import { Link, Navigate, Outlet, Route, Routes, useLocation, useNavigate } from 'react-router-dom'
import { useAuth } from '../contexts/AuthContext'
import { academyLibraryApi, type LibraryItem } from '../api/academyLibrary'
import { academyApi } from '../api/academy'

const LibraryReader = lazy(() => import('../pages/customer/AcademyLibraryItemPage').then(m => ({ default: m.AcademyLibraryItemPage })))
const CourseReader = lazy(() => import('../pages/customer/AcademyCoursePage').then(m => ({ default: m.AcademyCoursePage })))
const CourseCatalog = lazy(() => import('../pages/customer/AcademyCatalogPage').then(m => ({ default: m.AcademyCatalogPage })))

type Release = { release_code: string; title: string; audiobook?: LibraryItem; ebook?: LibraryItem }
type AcademyCourse = { id: string; title: string; cover_url?: string; description?: string }

function Mark() {
 return <Link to="/app/academia" className="inline-flex min-w-0 items-center gap-2.5 text-left">
  <span aria-hidden="true" className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-gradient-to-br from-[#C67D43] to-[#63321B] text-xl font-black text-white">S</span>
  <span className="min-w-0">
   <span className="block text-[11px] font-semibold uppercase tracking-[.15em] text-[#E5B18B]">Sagamente</span>
   <span className="block text-sm font-bold tracking-wide text-white">Academia</span>
  </span>
 </Link>
}

function Loading() {
 return <div role="status" className="mx-auto flex min-h-[50vh] items-center justify-center gap-3 text-sm text-gray-400"><span className="h-5 w-5 animate-spin rounded-full border-2 border-[#C78657] border-t-transparent" />Preparando sua Academia…</div>
}

function RequireAccess() {
 const { isAuthenticated, isLoading } = useAuth()
 const location = useLocation()
 if (isLoading) return <Loading/>
 if (!isAuthenticated) return <Navigate to="/login" state={{ from: location.pathname + location.search }} replace/>
 return <Outlet/>
}

function AcademyLogin() {
 const { login, isAuthenticated, isLoading } = useAuth()
 const navigate = useNavigate()
 const location = useLocation()
 const [email,setEmail] = useState('')
 const [password,setPassword] = useState('')
 const [error,setError] = useState('')
 const [busy,setBusy] = useState(false)
 const from = (location.state as {from?:string} | null)?.from
 const target = from?.startsWith('/app/academia') ? from : '/app/academia'
 if (isLoading) return <Loading/>
 if (isAuthenticated) return <Navigate to={target} replace/>
 async function submit(event:FormEvent<HTMLFormElement>) {
  event.preventDefault()
  if (busy) return
  setBusy(true); setError('')
  try {
   await login({email,password})
   navigate(target,{replace:true})
  } catch(e) {
   setError(e instanceof Error ? e.message : 'Não foi possível entrar.')
  } finally {setBusy(false)}
 }
 return <div className="flex min-h-[100dvh] items-center justify-center bg-[#0a0a0b] px-4 py-10">
  <section className="w-full max-w-sm rounded-3xl border border-white/10 bg-[#161719] p-6 shadow-xl sm:p-8">
   <Mark/>
   <h1 className="mt-8 text-2xl font-bold text-white">Seu conhecimento, em um só lugar.</h1>
   <p className="mt-2 text-sm leading-relaxed text-gray-400">Entre com a mesma conta da Sagamente para acessar seus áudios, e-books e cursos.</p>
   <form className="mt-7 space-y-4" onSubmit={event=>void submit(event)}>
    <label className="block text-xs font-semibold text-gray-300" htmlFor="academy-login-email">E-mail
     <input id="academy-login-email" type="email" autoComplete="email" required value={email} onChange={event=>setEmail(event.target.value)} className="mt-2 block min-h-12 w-full rounded-xl border border-white/15 bg-[#0d0e10] px-4 text-sm text-white outline-none focus:border-[#C78657]"/>
    </label>
    <label className="block text-xs font-semibold text-gray-300" htmlFor="academy-login-password">Senha
     <input id="academy-login-password" type="password" autoComplete="current-password" required value={password} onChange={event=>setPassword(event.target.value)} className="mt-2 block min-h-12 w-full rounded-xl border border-white/15 bg-[#0d0e10] px-4 text-sm text-white outline-none focus:border-[#C78657]"/>
    </label>
    {error&&<p role="alert" className="rounded-xl border border-red-500/30 bg-red-500/10 p-3 text-xs text-red-200">{error}</p>}
    <button type="submit" disabled={busy} className="min-h-12 w-full rounded-xl bg-[#A9683D] px-4 font-semibold text-white disabled:opacity-60">{busy?'Entrando…':'Entrar na Academia'}</button>
   </form>
  </section>
 </div>
}

const tabs = [
 {href:'/app/academia', label:'Início',symbol:'⌂'},
 {href:'/app/academia/biblioteca',label:'Biblioteca',symbol:'▣'},
 {href:'/app/academia/catalogo',label:'Cursos',symbol:'▶'},
 {href:'/conta',label:'Conta',symbol:'◎'}
]

function AcademyShell() {
 const { user } = useAuth()
 const pathname=useLocation().pathname
 return <div className="min-h-[100dvh] bg-[#0a0a0b] text-white">
  <header className="sticky top-0 z-30 border-b border-white/10 bg-[#0b0b0d]/95 px-4 py-3 backdrop-blur-xl">
   <div className="mx-auto flex max-w-5xl items-center justify-between gap-3">
    <Mark/>
    <span className="max-w-[40%] truncate text-right text-xs text-gray-400">Olá, {user?.name||'estudante'}</span>
   </div>
  </header>
  <main className="mx-auto min-h-[75dvh] w-full max-w-5xl px-4 pb-28 pt-5 sm:px-6 sm:pt-8">
   <Outlet/>
  </main>
  <nav aria-label="Menu da Academia" className="fixed inset-x-0 bottom-0 z-40 border-t border-white/10 bg-[#101114]/95 px-2 pb-[max(0.75rem,env(safe-area-inset-bottom))] pt-2 backdrop-blur-xl">
   <div className="mx-auto grid max-w-md grid-cols-4 gap-1">
    {tabs.map(tab=>{
     const active= tab.href==='/app/academia' ? pathname==='/app/academia' : pathname===tab.href||pathname.startsWith(tab.href+'/')
     return <Link key={tab.href} to={tab.href} aria-current={active?'page':undefined} className={'flex min-h-12 flex-col items-center justify-center gap-0.5 rounded-xl text-xs transition-colors '+(active?'bg-[#A9683D]/15 text-[#F0B887]':'text-gray-400 hover:text-white')}>
      <span aria-hidden="true" className="text-xl leading-none">{tab.symbol}</span><span>{tab.label}</span>
     </Link>
    })}
   </div>
  </nav>
 </div>
}

function AcademyShelf({ condensed=false }: {condensed?:boolean}) {
 const [items,setItems]=useState<LibraryItem[]>([])
 const [busy,setBusy]=useState(true)
 const [error,setError]=useState('')
 const [filter,setFilter]=useState<'all'|'audiobook'|'ebook'>('all')
 useEffect(()=>{
  let alive=true
  void academyLibraryApi.mine().then(data=>{if(alive)setItems(data)}).catch(e=>{if(alive)setError(e instanceof Error?e.message:'Erro ao carregar biblioteca.')}).finally(()=>{if(alive)setBusy(false)})
  return()=>{alive=false}
 },[])
 const releases=useMemo(()=>{
  const m=new Map<string,Release>()
  for(const item of items){
   const r=m.get(item.release_code)||{release_code:item.release_code,title:item.title}
   r[item.format]=item
   m.set(item.release_code,r)
  }
  const ordered=[...m.values()].sort((a,b)=>a.release_code.localeCompare(b.release_code))
  return condensed?ordered.slice(0,3):ordered
 },[items,condensed])
 return <section aria-label="Sua biblioteca digital" className="min-w-0">
  <div className="mb-4 flex flex-wrap items-end justify-between gap-3">
   <div><p className="text-[10px] font-bold uppercase tracking-[.16em] text-[#E4A572]">Biblioteca digital</p><h2 className="mt-1 text-xl font-bold">Seus e-books e audiobooks</h2></div>
   {condensed&&<Link to="/app/academia/biblioteca" className="text-xs font-semibold text-[#E9AE7B]">Ver tudo →</Link>}
  </div>
  {!condensed&&<div className="mb-4 flex flex-wrap gap-2">
   {([{key:'all',label:'Todos'},{key:'audiobook',label:'Audiobooks'},{key:'ebook',label:'E-books'}] as const).map(f=><button key={f.key} type="button" aria-pressed={filter===f.key} onClick={()=>setFilter(f.key)} className={'min-h-10 rounded-full border px-4 text-xs font-semibold '+(filter===f.key?'border-[#B77745] bg-[#B77745]/20 text-[#F1BD94]':'border-white/10 text-gray-400')}>{f.label}</button>)}
  </div>}
  {busy&&<p role="status" className="py-4 text-sm text-gray-400">Carregando sua biblioteca…</p>}
  {error&&<p role="alert" className="rounded-xl border border-red-500/30 p-4 text-sm text-red-200">{error}</p>}
  {!busy&&!error&&releases.length===0&&<p className="rounded-xl border border-white/10 p-5 text-sm text-gray-400">Nenhum conteúdo liberado nesta conta.</p>}
  <div className="grid min-w-0 gap-3 sm:grid-cols-2">
   {releases.filter(r=>filter==='all'||Boolean(r[filter])).map(r=><article key={r.release_code} className="flex min-w-0 flex-col justify-between rounded-2xl border border-white/10 bg-[#171719] p-4">
    <div><span className="text-[10px] font-bold uppercase tracking-[.15em] text-[#E4A572]">SAGA NEGRA · Release {r.release_code}</span><h3 className="mt-2 line-clamp-3 text-base font-semibold leading-snug">{r.title}</h3></div>
    <div className="mt-5 flex flex-wrap gap-2">
     {r.audiobook&&<Link to={'/app/academia/biblioteca/'+r.audiobook.id} className="inline-flex min-h-11 items-center rounded-xl bg-[#A9683D] px-4 text-xs font-bold text-white">▶ Ouvir</Link>}
     {r.ebook&&<Link to={'/app/academia/biblioteca/'+r.ebook.id} className="inline-flex min-h-11 items-center rounded-xl border border-white/20 px-4 text-xs font-bold text-gray-200">▤ Ler PDF</Link>}
    </div>
   </article>)}
  </div>
 </section>
}

function AcademyHome() {
 const [courses,setCourses]=useState<AcademyCourse[]>([])
 useEffect(()=>{
  let alive=true
  void academyApi.myCourses().then(rows=>{if(alive)setCourses(rows.filter((row:any)=>row.course).map((row:any)=>row.course))}).catch(()=>undefined)
  return()=>{alive=false}
 },[])
 return <div className="space-y-9">
  <section className="rounded-3xl border border-[#A9683D]/30 bg-gradient-to-br from-[#382315] via-[#201A18] to-[#151516] px-5 py-7 sm:px-8 sm:py-9">
   <p className="text-xs font-bold uppercase tracking-[.2em] text-[#E7B78A]">Seu espaço de conhecimento</p>
   <h1 className="mt-3 max-w-lg text-3xl font-bold leading-tight tracking-tight sm:text-4xl">Ouça, leia e aprenda no seu ritmo.</h1>
   <p className="mt-3 max-w-lg text-sm leading-relaxed text-gray-300">Seus conteúdos em um aplicativo, sem menus desnecessários. Continue estudando de onde estiver.</p>
   <div className="mt-6 flex flex-wrap gap-2">
    <Link to="/app/academia/biblioteca" className="inline-flex min-h-11 items-center rounded-xl bg-[#B87749] px-4 text-xs font-bold text-white">Abrir biblioteca →</Link>
    <Link to="/app/academia/catalogo" className="inline-flex min-h-11 items-center rounded-xl border border-white/25 px-4 text-xs font-semibold">Explorar cursos</Link>
   </div>
  </section>
  <AcademyShelf condensed/>
  <section>
   <div className="mb-4 flex items-center justify-between gap-3">
    <h2 className="text-xl font-bold">Meus cursos</h2><Link className="text-xs font-semibold text-[#E9AE7B]" to="/app/academia/catalogo">Catálogo →</Link>
   </div>
   {courses.length===0?<p className="rounded-2xl border border-white/10 bg-[#171719] p-5 text-sm text-gray-400">Seus cursos aparecerão aqui quando estiver matriculado. Explore o catálogo para começar.</p>:
    <div className="grid gap-3 sm:grid-cols-2">
     {courses.slice(0,4).map(c=><Link key={c.id} to={'/app/academia/'+c.id} className="rounded-2xl border border-white/10 bg-[#171719] p-4 hover:border-[#A9683D]/60"><span className="text-[10px] uppercase tracking-wider text-[#E7B78A]">Curso</span><h3 className="mt-2 font-bold">{c.title}</h3><span className="mt-3 inline-block text-xs text-[#E7B78A]">Continuar →</span></Link>)}
    </div>}
  </section>
 </div>
}

function AcademyAccount() {
 const {user,logout}=useAuth()
 const navigate=useNavigate()
 const [busy,setBusy]=useState(false)
 const [error,setError]=useState('')
 async function signOut(){
  setBusy(true);setError('')
  try{await logout();navigate('/login',{replace:true})}
  catch(e){setError(e instanceof Error?e.message:'Não foi possível sair.')}
  finally{setBusy(false)}
 }
 return <section className="mx-auto max-w-xl space-y-5">
  <div><p className="text-xs font-bold uppercase tracking-wider text-[#E7B78A]">Sua conta</p><h1 className="mt-1 text-2xl font-bold">Perfil da Academia</h1></div>
  <div className="rounded-2xl border border-white/10 bg-[#171719] p-5"><p className="font-semibold">{user?.name} {user?.lastName}</p><p className="mt-1 break-words text-xs text-gray-400">{user?.email}</p><p className="mt-4 text-xs leading-relaxed text-gray-400">Você utiliza o mesmo cadastro da Sagamente. Seus conteúdos são liberados de acordo com as permissões da sua conta.</p></div>
  <div className="rounded-2xl border border-white/10 bg-[#171719] p-5"><h2 className="font-semibold">Instalar no celular</h2><p className="mt-2 text-sm leading-relaxed text-gray-400">No iPhone, abra o menu Compartilhar do Safari e escolha “Adicionar à Tela de Início”. No Android, procure “Instalar aplicativo” no menu do navegador.</p></div>
  {error&&<p role="alert" className="text-sm text-red-300">{error}</p>}
  <button type="button" disabled={busy} onClick={()=>void signOut()} className="min-h-11 w-full rounded-xl border border-white/15 bg-white/5 text-sm font-semibold text-gray-200">{busy?'Saindo…':'Sair da Academia'}</button>
 </section>
}

export function AcademyStandaloneApp() {
 return <Suspense fallback={<Loading/>}><Routes>
  <Route path="/login" element={<AcademyLogin/>}/>
  <Route element={<RequireAccess/>}>
   <Route element={<AcademyShell/>}>
    <Route path="/" element={<Navigate to="/app/academia" replace/>}/>
    <Route path="/app/academia" element={<AcademyHome/>}/>
    <Route path="/app/academia/biblioteca" element={<AcademyShelf/>}/>
    <Route path="/app/academia/biblioteca/:id" element={<LibraryReader/>}/>
    <Route path="/app/academia/catalogo" element={<CourseCatalog/>}/>
    <Route path="/app/academia/:id" element={<CourseReader/>}/>
    <Route path="/conta" element={<AcademyAccount/>}/>
    <Route path="*" element={<Navigate to="/app/academia" replace/>}/>
   </Route>
  </Route>
 </Routes></Suspense>
}
