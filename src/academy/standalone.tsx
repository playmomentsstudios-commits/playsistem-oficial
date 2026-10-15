import { lazy, Suspense, useEffect, useMemo, useState, type FormEvent } from 'react'
import { Link, Navigate, Outlet, Route, Routes, useLocation, useNavigate } from 'react-router-dom'
import { useAuth } from '../contexts/AuthContext'
import { academyLibraryApi, type LibraryItem } from '../api/academyLibrary'
import {AcademyAudioProvider,useAcademyAudio} from '../contexts/AcademyAudioContext'
import { academyApi } from '../api/academy'
import { readAcademyAppSettings, DEFAULT_ACADEMY_APP_SETTINGS, type AcademyAppSettings } from '../api/academyAppSettings'

const LibraryReader = lazy(() => import('../pages/customer/AcademyLibraryItemPage').then(m => ({ default: m.AcademyLibraryItemPage })))
const CourseReader = lazy(() => import('../pages/customer/AcademyCoursePage').then(m => ({ default: m.AcademyCoursePage })))
const CourseCatalog = lazy(() => import('../pages/customer/AcademyCatalogPage').then(m => ({ default: m.AcademyCatalogPage })))
const CertificateVerify = lazy(() => import('../pages/public/CertificateVerifyPage').then(m => ({ default: m.CertificateVerifyPage })))

type IconName = 'home'|'library'|'courses'|'account'|'audio'|'book'|'arrow'|'play'|'clock'|'shield'|'logout'|'check'|'spark'|'mail'|'lock'|'chevron'|'headphones'
type Release = { release_code: string; title: string; audiobook?: LibraryItem; ebook?: LibraryItem }
type AcademyCourse = { id: string; title: string; cover_url?: string; description?: string }

const paths: Record<IconName,string> = {
 home:'m3 10 9-7 9 7v10a1 1 0 0 1-1 1h-5v-7H9v7H4a1 1 0 0 1-1-1z',
 library:'M4 4h6a2 2 0 0 1 2 2v14H6a2 2 0 0 0-2 2zm8 2a2 2 0 0 1 2-2h6v18h-6a2 2 0 0 0-2 2',
 courses:'M3 5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2zm7 3 6 4-6 4z',
 account:'M20 21a8 8 0 0 0-16 0M12 12a4 4 0 1 0 0-8 4 4 0 0 0 0 8',
 audio:'M4 14v-3a8 8 0 0 1 16 0v3M4 13h3v8H5a2 2 0 0 1-2-2v-4a2 2 0 0 1 1-2m16 0h-3v8h2a2 2 0 0 0 2-2v-4a2 2 0 0 0-1-2',
 book:'M12 6a8 8 0 0 0-9-2v15a8 8 0 0 1 9 2zm0 0a8 8 0 0 1 9-2v15a8 8 0 0 0-9 2zm0 0v15',
 arrow:'M5 12h14m-6-6 6 6-6 6',
 play:'m9 6 10 6-10 6z',
 clock:'M12 3a9 9 0 1 0 0 18 9 9 0 0 0 0-18m0 4v5l4 2',
 shield:'M12 2 4 5v6c0 5 3 9 8 11 5-2 8-6 8-11V5zM9 12l2 2 4-4',
 logout:'M9 5H5a2 2 0 0 0-2 2v10a2 2 0 0 0 2 2h4m4-14 6 7-6 7m6-7H9',
 check:'m5 12 5 5L20 7',
 spark:'m12 2 2.5 7.5L22 12l-7.5 2.5L12 22l-2.5-7.5L2 12l7.5-2.5z',
 mail:'M3 5h18v14H3zm0 2 9 7 9-7',
 lock:'M5 10h14v11H5zm3 0V7a4 4 0 1 1 8 0v3',
 chevron:'m9 5 7 7-7 7',
 headphones:'M3 14v-2a9 9 0 0 1 18 0v2M3 14h4v7H5a2 2 0 0 1-2-2zm18 0h-4v7h2a2 2 0 0 0 2-2z'
}

function Icon({name,size=20,className=''}:{name:IconName;size?:number;className?:string}) {
 return <svg aria-hidden="true" width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.65" strokeLinecap="round" strokeLinejoin="round" className={className}><path d={paths[name]}/></svg>
}
function Mark({compact=false}:{compact?:boolean}) {
 return <Link to="/app/academia" aria-label="Academia Sagamente — início" className="academy-brand">
  <img src="/pwa/academy-icon-192.png" alt="" width="40" height="40" className="academy-brand-icon"/>
  <span className="academy-brand-label"><strong>SAGAMENTE</strong><span>ACADEMIA</span></span>
  {!compact&&<span className="sr-only">Voltar ao início</span>}
 </Link>
}
function Loading() {
 return <div role="status" className="flex min-h-[46vh] items-center justify-center gap-3 text-sm text-neutral-400"><span className="h-5 w-5 animate-spin rounded-full border-2 border-[#E58D50] border-t-transparent"/>Carregando sua Academia…</div>
}
function SectionTitle({eyebrow,title,href,action='Ver tudo'}:{eyebrow?:string;title:string;href?:string;action?:string}) {
 return <header className="academy-section-title">
  <div>{eyebrow&&<p className="academy-eyebrow">{eyebrow}</p>}<h2>{title}</h2></div>
  {href&&<Link to={href} className="academy-text-link">{action}<Icon name="chevron" size={14}/></Link>}
 </header>
}
function ContentArtwork({release,format,coverUrl}:{release:string;format:'audio'|'book';coverUrl?:string|null}) {
 const legacy=/^\d{2}$/.test(release)
 const tone=[...release].reduce((sum,c)=>sum+c.charCodeAt(0),0)%3
 return <div className={'academy-content-art academy-content-art-'+tone} aria-hidden="true">
  {coverUrl?<img alt="" src={coverUrl} className="absolute inset-0 h-full w-full object-cover"/>:<>
   <span className="academy-art-ring"/>
   <span className="academy-art-grain">{legacy?<>SAGA<br/>NEGRA</>:'SAGAMENTE'}</span>
   <span className="academy-art-footer">{format==='audio'?<Icon name="headphones" size={22}/>:<Icon name="book" size={22}/>} <small>{legacy?release:format==='audio'?'Áudio':'Livro'}</small></span>
  </>}
 </div>
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
 const navigate=useNavigate()
 const location=useLocation()
 const [email,setEmail]=useState('')
 const [password,setPassword]=useState('')
 const [error,setError]=useState('')
 const [busy,setBusy]=useState(false)
 const [showPassword,setShowPassword]=useState(false)
 const from=(location.state as {from?:string}|null)?.from
 const target=from?.startsWith('/app/academia')?from:'/app/academia'
 if(isLoading)return <Loading/>
 if(isAuthenticated)return <Navigate to={target} replace/>
 async function submit(event:FormEvent<HTMLFormElement>){
  event.preventDefault()
  if(busy)return
  setBusy(true);setError('')
  try{await login({email,password});navigate(target,{replace:true})}
  catch(e){setError(e instanceof Error?e.message:'Não foi possível entrar.')}
  finally{setBusy(false)}
 }
 return <div className="academy-app academy-login">
  <div className="academy-login-orb" aria-hidden="true"/>
  <div className="academy-login-layout">
   <div className="academy-login-art" aria-hidden="true">
    <div className="academy-login-art-circle"/>
    <span>SAGA NEGRA<br/>CONHECIMENTO<br/>EM MOVIMENTO</span>
   </div>
   <main className="academy-login-panel">
    <Mark/>
    <div className="academy-login-copy">
     <p className="academy-eyebrow">Seu espaço de conhecimento</p>
     <h1>Seu conhecimento,<br/><em>em um só lugar.</em></h1>
     <p>Áudios, e-books e cursos para aprender no seu ritmo.</p>
    </div>
    <form className="academy-login-form" onSubmit={event=>void submit(event)}>
     <label htmlFor="academy-login-email">E-mail</label>
     <div className="academy-input-wrap"><Icon name="mail" size={19}/>
      <input id="academy-login-email" name="email" type="email" autoComplete="username" autoCapitalize="none" spellCheck={false} placeholder="seu@email.com" required value={email} onChange={event=>setEmail(event.target.value)}/>
     </div>
     <label htmlFor="academy-login-password">Senha</label>
     <div className="academy-input-wrap"><Icon name="lock" size={19}/>
      <input id="academy-login-password" type={showPassword?'text':'password'} autoComplete="current-password" placeholder="Sua senha" required value={password} onChange={event=>setPassword(event.target.value)}/>
      <button type="button" className="academy-show-password" onClick={()=>setShowPassword(value=>!value)} aria-label={showPassword?'Ocultar senha':'Mostrar senha'}>{showPassword?'Ocultar':'Mostrar'}</button>
     </div>
     {error&&<p role="alert" className="academy-login-error">{error}</p>}
     <button type="submit" disabled={busy} className="academy-primary-button academy-login-submit">{busy?'Entrando…':'Entrar na Academia'}<Icon name="arrow" size={18}/></button>
     <a href="https://playsistem-oficial.playmomentsstudios.workers.dev/esqueci-senha" target="_blank" rel="noopener noreferrer" className="academy-forgot">Esqueci minha senha <span aria-hidden="true">↗</span></a>
    </form>
    <section className="academy-signup-panel" aria-labelledby="academy-signup-title">
     <p className="academy-eyebrow">Novo por aqui?</p>
     <h2 id="academy-signup-title">Comece gratuitamente na Academia</h2>
     <p>Crie uma conta Sagamente, confirme seu e-mail e entre aqui para acessar cursos, e-books e audiobooks disponíveis.</p>
     <a className="academy-signup-link" href="https://playsistem-oficial.playmomentsstudios.workers.dev/cadastro?next=%2Fapp%2Facademia" target="_blank" rel="noopener noreferrer">
      Criar conta gratuita <Icon name="arrow" size={17}/>
     </a>
     <a className="academy-signup-explore" href="https://playsistem-oficial.playmomentsstudios.workers.dev/academia" target="_blank" rel="noopener noreferrer">Conhecer cursos antes de me cadastrar ↗</a>
    </section>
    <p className="academy-login-footer"><Icon name="shield" size={14}/> Sua conta é a mesma da Sagamente. Depois da confirmação, entre nesta Academia com o e-mail cadastrado.</p>
   </main>
  </div>
 </div>
}

const tabs:{href:string;label:string;icon:IconName}[]=[
 {href:'/app/academia',label:'Início',icon:'home'},
 {href:'/app/academia/biblioteca',label:'Biblioteca',icon:'library'},
 {href:'/app/academia/catalogo',label:'Cursos',icon:'courses'},
 {href:'/conta',label:'Conta',icon:'account'}
]
function AcademyShell() {
 const {user}=useAuth()
 const pathname=useLocation().pathname
 return <div className="academy-app academy-shell">
  <header className="academy-topbar">
   <div className="academy-container academy-topbar-inner">
    <Mark compact/>
    <Link to="/conta" className="academy-avatar" aria-label="Abrir perfil">{(user?.name||'A').charAt(0).toUpperCase()}</Link>
   </div>
  </header>
  <main className="academy-container academy-main"><Outlet/></main>
  <nav aria-label="Menu da Academia" className="academy-tabbar">
   <div className="academy-tabbar-inner">
    {tabs.map(tab=>{
     const active=tab.href==='/app/academia'?pathname==='/app/academia':pathname===tab.href||pathname.startsWith(tab.href+'/')
     return <Link key={tab.href} to={tab.href} aria-current={active?'page':undefined} className={'academy-tab '+(active?'is-active':'')}>
      <Icon name={tab.icon} size={21}/><span>{tab.label}</span>
     </Link>
    })}
   </div>
  </nav>
 </div>
}

function AcademyShelf({condensed=false}:{condensed?:boolean}){
 const {playItem}=useAcademyAudio()
 const [items,setItems]=useState<LibraryItem[]>([])
 const [busy,setBusy]=useState(true)
 const [error,setError]=useState('')
 const [filter,setFilter]=useState<'all'|'audiobook'|'ebook'>('all')
 const [search,setSearch]=useState('')
 useEffect(()=>{
  let alive=true
  void academyLibraryApi.mine().then(data=>{if(alive)setItems(data)}).catch(e=>{if(alive)setError(e instanceof Error?e.message:'Erro ao carregar biblioteca.')}).finally(()=>{if(alive)setBusy(false)})
  return()=>{alive=false}
 },[])
 const resumable = useMemo(()=>{
  if(!condensed||typeof window==='undefined')return []
  return items.filter(item=>item.format === 'audiobook').flatMap(item=>{
   try{
    const position=Number(window.localStorage.getItem('sagamente.library.position.'+item.id)||0)
    return Number.isFinite(position)&&position>=10?[{item,position}]:[]
   }catch{return []}
  }).sort((a,b)=>b.position-a.position).slice(0,1)
 },[items,condensed])
 const releases=useMemo(()=>{
  const map=new Map<string,Release>()
  for(const item of items){
   const release=map.get(item.release_code)||{release_code:item.release_code,title:item.title}
   release[item.format]=item
   map.set(item.release_code,release)
  }
  const ordered=[...map.values()].sort((a,b)=>a.release_code.localeCompare(b.release_code))
  return condensed?ordered.slice(0,3):ordered
 },[items,condensed])
 const filtered=releases.filter(release=>{
  const matchesType=filter==='all'||Boolean(release[filter])
  const matchesSearch=condensed||release.title.toLocaleLowerCase('pt-BR').includes(search.toLocaleLowerCase('pt-BR'))
  return matchesType&&matchesSearch
 })
 return <section aria-label="Sua biblioteca digital" className="academy-shelf">
  <SectionTitle eyebrow={condensed?'Sua coleção':'Biblioteca digital'} title={condensed?'Biblioteca':'Explore sua biblioteca'} href={condensed?'/app/academia/biblioteca':undefined}/>
  {!condensed&&<div className="academy-library-toolbar">
   <div className="academy-search"><span aria-hidden="true">⌕</span><input type="search" aria-label="Buscar na biblioteca" placeholder="Buscar por título ou release…" value={search} onChange={event=>setSearch(event.target.value)}/></div>
   <div className="academy-filter-row" aria-label="Filtrar conteúdos">
    {([{key:'all',label:'Todos'},{key:'audiobook',label:'Áudios'},{key:'ebook',label:'E-books'}] as const).map(f=><button key={f.key} type="button" aria-pressed={filter===f.key} onClick={()=>setFilter(f.key)} className={'academy-filter '+(filter===f.key?'is-active':'')}>{f.label}</button>)}
   </div>
  </div>}
  {busy&&<Loading/>}
  {error&&<p role="alert" className="academy-error">{error}</p>}
  {!busy&&!error&&releases.length===0&&<div className="academy-empty"><Icon name="library" size={27}/><h3>Sua biblioteca está esperando por você</h3><p>Os conteúdos liberados para sua conta aparecerão aqui.</p></div>}
  {!busy&&!error&&releases.length>0&&filtered.length===0&&<div className="academy-empty"><p>Nenhum título encontrado neste filtro.</p></div>}
  {resumable.map(({item,position})=><Link key={item.id} to={'/app/academia/biblioteca/'+item.id} onClick={()=>{void playItem(item.id,true)}} className="academy-resume">
    <ContentArtwork release={item.release_code} format="audio" coverUrl={item.cover_url}/>
    <span className="academy-resume-details"><span className="academy-eyebrow">Retomar audiobook · Continuar de onde parou</span><strong>{item.title}</strong><span className="academy-resume-meta"><Icon name="clock" size={14}/> {Math.floor(position/60)} min ouvidos</span></span>
    <span className="academy-resume-play"><Icon name="play" size={20}/></span>
   </Link>)}
  {!busy&&!error&&<div className={'academy-library-grid '+(condensed?'is-condensed':'')}>
   {filtered.map(release=>{
    const primary=release.audiobook||release.ebook
    const kind=release.audiobook?'audio':'book'
    const target=primary?'/app/academia/biblioteca/'+primary.id:'/app/academia/biblioteca'
    return <article key={release.release_code} className="academy-media-card">
     <Link to={target} className="academy-media-art-link" aria-label={'Abrir '+release.title}><ContentArtwork release={release.release_code} format={kind} coverUrl={primary?.cover_url}/></Link>
     <div className="academy-media-body">
      <span className="academy-eyebrow">{/^\d{2}$/.test(release.release_code)?'SAGA NEGRA · RELEASE '+release.release_code:'BIBLIOTECA SAGAMENTE'}</span>
      <h3>{release.title}</h3>
      <p>{release.audiobook&&release.ebook?'Audiobook e e-book disponíveis':release.audiobook?'Audiobook disponível':'E-book disponível'}</p>
      <div className="academy-media-actions">
       {release.audiobook&&<Link to={'/app/academia/biblioteca/'+release.audiobook.id} onClick={()=>{void playItem(release.audiobook!.id,true)}} className="academy-media-play"><Icon name="play" size={16}/> Ouvir</Link>}
       {release.ebook&&<Link to={'/app/academia/biblioteca/'+release.ebook.id} className="academy-media-read"><Icon name="book" size={16}/> Ler PDF</Link>}
      </div>
     </div>
    </article>
   })}
  </div>}
 </section>
}

function AcademyHome(){
 const {user}=useAuth()
 const [appSettings,setAppSettings]=useState<AcademyAppSettings>(DEFAULT_ACADEMY_APP_SETTINGS)
 const [courses,setCourses]=useState<AcademyCourse[]>([])
 const [loadingCourses,setLoadingCourses]=useState(true)
 useEffect(()=>{
  let alive=true
  void readAcademyAppSettings().then(settings=>{if(alive)setAppSettings(settings)}).catch(()=>undefined)
  return()=>{alive=false}
 },[])
 useEffect(()=>{
  let alive=true
  void academyApi.myCourses().then(rows=>{
   if(alive)setCourses(rows.filter((row:any)=>row.course).map((row:any)=>row.course))
  }).catch(()=>undefined).finally(()=>{if(alive)setLoadingCourses(false)})
  return()=>{alive=false}
 },[])
 return <div className="academy-home">
  <div className="academy-welcome"><p className="academy-eyebrow">SEU ESPAÇO DE CONHECIMENTO</p><h1>Olá, {user?.name||'estudante'}<span className="academy-welcome-dot">.</span></h1><p>O que você quer explorar hoje?</p></div>
  <section className="academy-featured">
   <div className="academy-featured-art" aria-hidden="true"><span className="academy-featured-orbit"/><span>ACERVO<br/>DIGITAL</span></div>
   <div className="academy-featured-content"><p className="academy-eyebrow">{appSettings.hero_eyebrow}</p><h2>{appSettings.hero_title}</h2><p>{appSettings.hero_subtitle}</p>
    <Link className="academy-featured-button" to="/app/academia/biblioteca">Explorar biblioteca <Icon name="arrow" size={17}/></Link>
   </div>
  </section>
  {appSettings.show_quick_links&&<div className="academy-quick-grid">
   <Link to="/app/academia/biblioteca" className="academy-quick-card"><Icon name="headphones" size={25}/><strong>Audiobooks</strong><span>Ouvir</span></Link>
   <Link to="/app/academia/biblioteca" className="academy-quick-card"><Icon name="book" size={25}/><strong>E-books</strong><span>Ler</span></Link>
   <Link to="/app/academia/catalogo" className="academy-quick-card"><Icon name="courses" size={25}/><strong>Cursos</strong><span>Aprender</span></Link>
  </div>}
  <AcademyShelf condensed/>
  {appSettings.show_courses&&<section className="academy-courses-home">
   <SectionTitle eyebrow="Seu aprendizado" title="Meus cursos" href="/app/academia/catalogo" action="Explorar"/>
   {loadingCourses?<p className="academy-muted">Carregando cursos…</p>:courses.length===0?
    <Link to="/app/academia/catalogo" className="academy-course-empty"><Icon name="courses" size={26}/><span><strong>Descubra algo novo</strong><small>Explore cursos e aulas gratuitas.</small></span><Icon name="chevron" size={20}/></Link>:
    <div className="academy-course-grid">{courses.slice(0,4).map(c=><Link key={c.id} to={'/app/academia/'+c.id} className="academy-course-card">
     <div className="academy-course-art">{c.cover_url?<img src={c.cover_url} loading="lazy" alt=""/>:<Icon name="courses" size={30}/>}</div>
     <div><span className="academy-eyebrow">CURSO</span><h3>{c.title}</h3><span className="academy-text-link">Continuar <Icon name="arrow" size={14}/></span></div>
    </Link>)}</div>}
  </section>}
 </div>
}

function AcademyAccount(){
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
 return <section className="academy-account">
  <p className="academy-eyebrow">SEU ESPAÇO</p><h1>Minha conta</h1>
  <div className="academy-profile-card"><div className="academy-profile-avatar">{(user?.name||'A').charAt(0).toUpperCase()}</div>
   <div><h2>{user?.name} {user?.lastName}</h2><p>{user?.email}</p><span>Conta Sagamente</span></div>
  </div>
  <div className="academy-account-links">
   <Link to="/app/academia/biblioteca"><Icon name="library" size={20}/> Minha biblioteca <Icon name="chevron" size={18}/></Link>
   <Link to="/app/academia/catalogo"><Icon name="courses" size={20}/> Cursos e aulas <Icon name="chevron" size={18}/></Link>
   <details><summary><Icon name="spark" size={20}/> Instalar aplicativo <Icon name="chevron" size={18}/></summary>
    <div className="academy-account-detail"><p><strong>iPhone:</strong> abra no Safari, toque em Compartilhar e em “Adicionar à Tela de Início”.</p><p><strong>Android:</strong> no Chrome, escolha “Instalar aplicativo” no menu.</p></div>
   </details>
   <div className="academy-account-note"><Icon name="shield" size={19}/><span>Sua biblioteca é pessoal e protegida pelas permissões da sua conta Sagamente.</span></div>
  </div>
  {error&&<p role="alert" className="academy-error">{error}</p>}
  <button type="button" disabled={busy} onClick={()=>void signOut()} className="academy-logout"><Icon name="logout" size={18}/>{busy?'Saindo…':'Sair da conta'}</button>
 </section>
}

export function AcademyStandaloneApp(){
 return <AcademyAudioProvider><Suspense fallback={<Loading/>}><Routes>
  <Route path="/login" element={<AcademyLogin/>}/>
  <Route path="/certificados/:code" element={<CertificateVerify/>}/>
  <Route element={<RequireAccess/>}>
   <Route element={<AcademyShell/>}>
    <Route path="/" element={<Navigate to="/app/academia" replace/>}/>
    <Route path="/app/academia" element={<AcademyHome/>}/>
    <Route path="/app/academia/biblioteca" element={<AcademyShelf/>}/>
    <Route path="/app/academia/biblioteca/:id" element={<div className="academy-reader"><LibraryReader/></div>}/>
    <Route path="/app/academia/catalogo" element={<div className="academy-catalog"><CourseCatalog/></div>}/>
    <Route path="/app/academia/:id" element={<div className="academy-reader academy-course-reader"><CourseReader/></div>}/>
    <Route path="/conta" element={<AcademyAccount/>}/>
    <Route path="*" element={<Navigate to="/app/academia" replace/>}/>
   </Route>
  </Route>
 </Routes></Suspense></AcademyAudioProvider>
}
