import { useEffect,useState } from 'react'
import { Link } from 'react-router-dom'
import { PublicLayout } from '../../layouts/PublicLayout'
import { DigitalLiteracyCover } from '../../components/academy/DigitalLiteracyCover'
import { supabase } from '../../lib/supabase'
import { useAuth } from '../../contexts/AuthContext'
import { LoadingState } from '../../components/ui/AsyncState'
import {formatAcademyMoney,type AcademyWorkPrice} from '../../lib/academyPricing'
import './academyCatalog.css'

type PublicWork={
 release_code:string;title:string;description:string|null;cover_url:string|null;landing_slug:string;
 ebook_status:string|null;audiobook_status:string|null;
}
type PublicCourse={
 id:string
 title:string
 slug:string
 description:string|null
 category:string|null
 estimated_minutes:number|null
 cover_url:string|null
 access_type:string
 instructor_name:string|null
 published_at?:string|null
}

const DIGITAL_LITERACY_FALLBACK:PublicCourse={
 id:'letramento-digital-public',
 title:'Letramento Digital — tecnologia, autonomia e futuro',
 slug:'letramento-digital',
 description:'Curso gratuito para entender o mundo digital de forma prática e consciente: sistemas, comunicação, informação, algoritmos, inteligência artificial, identidade, território e possibilidades profissionais.',
 category:'Tecnologia',
 estimated_minutes:93,
 cover_url:null,
 access_type:'free',
 instructor_name:'Felipe Costa',
}

async function loadPublicCourses(){
 const catalog=await supabase.rpc('academy_public_courses')
 if(!catalog.error&&Array.isArray(catalog.data)&&catalog.data.length>0){
  return catalog.data as PublicCourse[]
 }

 const single=await supabase.rpc('academy_public_course',{course_slug:'letramento-digital'})
 if(!single.error&&single.data?.course){
  return [single.data.course as PublicCourse]
 }

 console.warn('[academy] catálogo público indisponível; exibindo curso aberto conhecido',catalog.error||single.error)
 return [DIGITAL_LITERACY_FALLBACK]
}

export function PublicAcademyPage(){
 const {isAuthenticated}=useAuth()
 const [courses,setCourses]=useState<PublicCourse[]>([])
 const [works,setWorks]=useState<PublicWork[]>([])
 const [worksLoading,setWorksLoading]=useState(true)
 const [worksError,setWorksError]=useState('')
 const [workFilter,setWorkFilter]=useState<'all'|'ebook'|'audiobook'|'course'|'free'>('all')
 const [workQuery,setWorkQuery]=useState('')
 const [prices,setPrices]=useState<AcademyWorkPrice[]>([])
 const [loading,setLoading]=useState(true)

 useEffect(()=>{
  let active=true
  void (async()=>{
   try{
    const {data,error}=await supabase.rpc('academy_public_works')
    if(error)throw error
    if(active){setWorks((data||[]) as PublicWork[]);setWorksError('')}
   }catch{
    if(active)setWorksError('A vitrine de obras está temporariamente indisponível.')
   }finally{if(active)setWorksLoading(false)}
  })()
  return()=>{active=false}
 },[])
 useEffect(()=>{
  let active=true
  void (async()=>{
   try{
    const {data,error}=await supabase.rpc('academy_public_work_prices')
    if(active&&!error)setPrices((data||[]) as AcademyWorkPrice[])
   }catch{ /* Prices are optional: the catalogue and landings remain available. */ }
  })()
  return()=>{active=false}
 },[])
 useEffect(()=>{
  let active=true
  loadPublicCourses()
   .then(rows=>{if(active)setCourses(rows)})
   .catch(error=>{
    console.error(error)
    if(active)setCourses([DIGITAL_LITERACY_FALLBACK])
   })
   .finally(()=>{if(active)setLoading(false)})
  return()=>{active=false}
 },[])

 const normalize=(value:string)=>value.normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLocaleLowerCase('pt-BR').trim()
 const term=normalize(workQuery)
 const matches=(values:Array<string|null>)=>!term||values.some(value=>normalize(value||'').includes(term))
 const filteredCourses=courses.filter(course=>
  (workFilter==='all'||workFilter==='course'||(workFilter==='free'&&course.access_type==='free'))&&
  matches([course.title,course.description,course.category]))
 const filteredWorks=works.filter(work=>
  (workFilter==='all'||(workFilter==='ebook'&&Boolean(work.ebook_status))||(workFilter==='audiobook'&&Boolean(work.audiobook_status)))&&
  matches([work.title,work.description,work.release_code]))
 const showWorks=workFilter==='all'||workFilter==='ebook'||workFilter==='audiobook'
 const showCourses=workFilter==='all'||workFilter==='course'||workFilter==='free'
 const busy=(showWorks&&worksLoading)||(showCourses&&loading)
 const card='group flex min-w-0 flex-col overflow-hidden rounded-xl border border-white/10 bg-[#151517] text-left transition-colors hover:border-[#d8925e]/50 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-[#dfa269]'
 const artwork='aspect-[4/3] overflow-hidden border-b border-white/[.06] bg-[#101113] sm:aspect-[16/10]'

 return <PublicLayout><section className="mx-auto max-w-6xl px-4 pb-14 pt-6 sm:px-5 sm:pb-20 sm:pt-9" aria-labelledby="academy-title">
  <div className="flex items-start justify-between gap-3">
   <div>
    <h1 id="academy-title" className="text-3xl font-bold tracking-tight sm:text-4xl">Academia</h1>
    <p className="mt-1 text-sm text-gray-400">Leia. Ouça. Aprenda.</p>
   </div>
   <Link to={isAuthenticated?'/app/academia':'/login?next=%2Fapp%2Facademia'} className="inline-flex min-h-11 shrink-0 items-center gap-2 rounded-xl border border-white/15 px-3 text-xs font-semibold text-gray-200 hover:bg-white/5 sm:px-4">
    <svg aria-hidden="true" width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5"><circle cx="12" cy="7" r="4"/><path d="M4 22v-3a8 8 0 0116 0v3"/></svg>
    Minha Academia
   </Link>
  </div>
  <div id="obras-digitais" className="mt-5 scroll-mt-24 sm:mt-6">
   <span id="cursos-gratuitos" className="block scroll-mt-24"/>
   <div className="relative">
    <svg aria-hidden="true" className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-gray-500" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5"><circle cx="10.5" cy="10.5" r="7"/><path d="m16 16 5 5"/></svg>
    <input value={workQuery} onChange={event=>setWorkQuery(event.target.value)} type="search" aria-label="Buscar conteúdo" placeholder="Buscar conteúdo" className="min-h-11 w-full rounded-xl border border-white/10 bg-[#17181a] py-2 pl-11 pr-4 text-sm outline-none focus:border-[#DFA269]"/>
   </div>
   <div className="mt-3 flex gap-2 overflow-x-auto pb-2" role="group" aria-label="Filtrar conteúdos">
    {([['all','Todos'],['ebook','E-books'],['audiobook','Audiobooks'],['course','Cursos'],['free','Gratuitos']] as const).map(([key,label])=>
     <button key={key} aria-pressed={workFilter===key} type="button" onClick={()=>setWorkFilter(key)} className={'min-h-11 shrink-0 rounded-full border px-4 text-xs font-semibold transition-colors focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#dfa269] '+(workFilter===key?'border-[#b96b3e] bg-[#b96b3e] text-white':'border-white/15 text-gray-300 hover:bg-white/5')}>{label}</button>)}
   </div>
  </div>
  {busy&&<LoadingState label="Carregando conteúdos..."/>}
  {showWorks&&worksError&&<p role="alert" className="my-3 rounded-xl border border-amber-500/20 p-3 text-xs text-amber-200">{worksError}</p>}
  <div className="mt-3 grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-5" aria-busy={busy}>
   {filteredCourses.map(course=><Link key={'course-'+course.id}
    to={course.slug==='letramento-digital'?'/curso/letramento-digital':(isAuthenticated?'/app/academia/'+course.id:'/cadastro?next='+encodeURIComponent('/app/academia/'+course.id))}
    className={card}>
    <div className={artwork} aria-hidden="true">
     {course.cover_url?<img src={course.cover_url} alt="" className="h-full w-full object-cover" loading="lazy"/>:
      course.slug==='letramento-digital'?<DigitalLiteracyCover compact className="academy-catalog-course-cover rounded-none" style={{minHeight:0}}/>:
      <div className="flex h-full items-center justify-center text-4xl text-[#dfa269]">▶</div>}
    </div>
    <div className="flex flex-1 flex-col p-3">
     <h2 className="text-xs font-bold leading-snug text-gray-100 sm:text-[13px]">{course.slug==='letramento-digital'?'Letramento Digital':course.title}</h2>
     <p className="mt-2 text-[10px] text-gray-400 sm:text-xs">Curso{course.estimated_minutes?' · '+course.estimated_minutes+' min':''}</p>
     <div className="mt-auto flex items-center justify-between gap-2 pt-2">
      {course.access_type==='free'?<span className="rounded-md bg-emerald-400/10 px-2 py-1 text-[10px] font-semibold text-emerald-300 sm:text-xs">Gratuito</span>:<span className="text-xs text-[#dfa269]">Conhecer curso</span>}
      <span aria-hidden="true" className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full border border-white/20 text-gray-300 group-hover:border-[#dfa269] group-hover:text-[#dfa269]">→</span>
     </div>
     <span className="sr-only">Conhecer curso →</span>
    </div>
   </Link>)}
   {filteredWorks.map(work=>{
    const offer=prices.find(price=>price.release_code===work.release_code&&price.checkout_enabled)
    const validPrices=[workFilter!=='audiobook'&&work.ebook_status&&offer?.ebook_cents,workFilter!=='ebook'&&work.audiobook_status&&offer?.audiobook_cents]
     .filter((value):value is number=>typeof value==='number'&&Number.isSafeInteger(value)&&value>0)
    const startPrice=validPrices.length?Math.min(...validPrices):null
    return <Link key={'work-'+work.release_code} to={'/l/'+encodeURIComponent(work.landing_slug)} className={card}>
     <div className={artwork}>
      {work.cover_url?<img src={work.cover_url} alt="" className="h-full w-full object-contain" loading="lazy"/>:
       <div aria-hidden="true" className="flex h-full flex-col items-center justify-center bg-gradient-to-br from-[#542a23] via-[#a05230] to-[#19191c] text-center font-black tracking-tight text-white/90"><span>SAGA NEGRA</span><span className="mt-2 text-sm text-[#ffcfab]">{work.release_code}</span></div>}
     </div>
     <div className="flex flex-1 flex-col p-3">
      <h2 className="text-xs font-bold leading-snug text-gray-100 sm:text-[13px]">{work.title}</h2>
      <p className="mt-2 text-[10px] leading-5 text-gray-400 sm:text-xs">
       {[work.ebook_status&&'E-book',work.audiobook_status&&'Audiobook'].filter(Boolean).join(' · ')||'Em preparação'}
      </p>
      <div className="mt-auto flex items-center justify-between gap-1 pt-2">
       <span className="text-[10px] font-semibold leading-5 text-[#f0a36c] sm:text-xs">{startPrice!==null?'A partir de '+formatAcademyMoney(startPrice):'Conhecer obra'}</span>
       <span aria-hidden="true" className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full border border-white/20 text-gray-300 group-hover:border-[#dfa269] group-hover:text-[#dfa269]">→</span>
      </div>
      <span className="sr-only">Conhecer obra →</span>
     </div>
    </Link>
   })}
  </div>
  {!busy&&filteredCourses.length+filteredWorks.length===0&&!(showWorks&&worksError)&&<div role="status" className="py-12 text-center">
   <p className="text-sm text-gray-400">Nenhum conteúdo encontrado.</p>
   {(workQuery||workFilter!=='all')&&<button type="button" onClick={()=>{setWorkQuery('');setWorkFilter('all')}} className="mt-3 min-h-11 rounded-xl px-4 text-xs font-semibold text-[#dfa269]">Limpar filtros</button>}
  </div>}
 </section></PublicLayout>
}
