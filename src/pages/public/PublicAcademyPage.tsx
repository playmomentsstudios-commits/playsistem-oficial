import { useEffect,useState } from 'react'
import { Link } from 'react-router-dom'
import { PublicLayout } from '../../layouts/PublicLayout'
import { DigitalLiteracyCover } from '../../components/academy/DigitalLiteracyCover'
import { supabase } from '../../lib/supabase'
import { useAuth } from '../../contexts/AuthContext'
import { LoadingState } from '../../components/ui/AsyncState'

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
 const [workFilter,setWorkFilter]=useState<'all'|'ebook'|'audiobook'>('all')
 const [workQuery,setWorkQuery]=useState('')
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
  loadPublicCourses()
   .then(rows=>{if(active)setCourses(rows)})
   .catch(error=>{
    console.error(error)
    if(active)setCourses([DIGITAL_LITERACY_FALLBACK])
   })
   .finally(()=>{if(active)setLoading(false)})
  return()=>{active=false}
 },[])

 function goToFreeCourses(){
  document.getElementById('cursos-gratuitos')?.scrollIntoView({behavior:'smooth',block:'start'})
 }

 return <PublicLayout><main>
  <section className="px-4 sm:px-5 py-10 sm:py-14 md:py-20 text-center">
   <div className="max-w-4xl mx-auto">
    <p className="text-xs uppercase tracking-[.22em] font-bold text-[#A65A2A]">Academia Sagamente</p>
    <h1 className="text-[2.35rem] sm:text-4xl md:text-6xl font-extrabold mt-4 leading-[1.02]">
     Conhecimento para <span className="text-[#A65A2A]">fazer acontecer.</span>
    </h1>
    <p className="max-w-2xl mx-auto text-sm sm:text-base text-gray-400 mt-4 sm:mt-5 leading-relaxed">
     Cursos, e-books e audiobooks para aprender, refletir e criar. Conheça as obras, experimente as prévias gratuitas e escolha como continuar.
    </p>
    <div className="flex flex-col sm:flex-row sm:flex-wrap justify-center gap-3 mt-6 sm:mt-7">
     <button type="button" onClick={goToFreeCourses} className="w-full sm:w-auto min-h-12 px-6 py-3 rounded-xl bg-[#A65A2A] text-white text-sm font-bold">
      Começar gratuitamente
     </button>
     {!isAuthenticated&&<Link to="/cadastro?next=%2Fapp%2Facademia" className="w-full sm:w-auto min-h-12 inline-flex items-center justify-center px-6 py-3 rounded-xl border border-white/10 text-sm font-bold text-gray-300">Criar conta</Link>}
    </div>
   </div>
  </section>

  <section id="obras-digitais" className="mx-auto max-w-6xl scroll-mt-24 px-4 pb-14 sm:px-5 sm:pb-20">
   <div className="mb-5 flex flex-wrap items-end justify-between gap-3">
    <div><p className="text-[10px] font-bold uppercase tracking-[.18em] text-[#DFA269]">Biblioteca digital</p>
     <h2 className="mt-1 text-2xl font-bold">Conheça nossas obras</h2>
     <p className="mt-2 max-w-2xl text-xs leading-6 text-gray-400">Uma apresentação para cada obra, com amostras de leitura e áudio quando disponíveis. Conheça os formatos antes de solicitar acesso.</p>
    </div>
    {isAuthenticated&&<Link to="/app/academia/biblioteca" className="text-xs font-bold text-[#DFA269]">Minha biblioteca →</Link>}
   </div>
   <div className="mb-5 flex flex-wrap items-center gap-2">
    <input value={workQuery} onChange={event=>setWorkQuery(event.target.value)} type="search" aria-label="Buscar obras" placeholder="Buscar obras por título ou tema..." className="min-h-11 min-w-[180px] flex-1 rounded-xl border border-white/10 bg-[#151517] px-4 text-sm outline-none focus:border-[#DFA269]"/>
    {([['all','Todos'],['ebook','E-books'],['audiobook','Audiobooks']] as const).map(([key,label])=>
     <button key={key} aria-pressed={workFilter===key} type="button" onClick={()=>setWorkFilter(key)} className={'min-h-11 rounded-xl px-3 text-xs font-bold '+(workFilter===key?'bg-[#A65A2A] text-white':'border border-white/10 text-gray-300')}>{label}</button>)}
   </div>
   {worksLoading?<LoadingState label="Carregando obras digitais..."/>:
    worksError?<div role="alert" className="rounded-xl border border-amber-500/20 p-4 text-sm text-amber-200">{worksError}</div>:
    <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">{works.filter(work=>{
     const term=workQuery.toLocaleLowerCase('pt-BR').trim()
     return (!term||[work.title,work.description,work.release_code].some(v=>String(v||'').toLocaleLowerCase('pt-BR').includes(term)))&&
      (workFilter==='all'||Boolean(workFilter==='ebook'?work.ebook_status:work.audiobook_status))
    }).map(work=>{
     const available=work.ebook_status==='published'||work.audiobook_status==='published'
     return <article key={work.release_code} className="flex min-w-0 flex-col overflow-hidden rounded-2xl border border-white/10 bg-[#151517]">
      <div className="flex gap-4 p-4">
       <div className="aspect-[3/4] w-24 shrink-0 overflow-hidden rounded-xl bg-gradient-to-br from-[#542a23] via-[#a05230] to-[#19191c]">
        {work.cover_url?<img src={work.cover_url} alt="" className="h-full w-full object-cover" loading="lazy"/>:<div className="flex h-full flex-col items-center justify-center px-2 text-center text-xs font-black tracking-tight text-white/90"><span>SAGA</span><span>NEGRA</span><span className="mt-3 text-base text-[#ffcfab]">{work.release_code}</span></div>}
       </div>
       <div className="min-w-0 flex-1">
        <p className="text-[10px] font-bold uppercase tracking-widest text-[#dda371]">Obra · {work.release_code}</p>
        <h3 className="mt-2 text-sm font-bold leading-snug">{work.title}</h3>
        <p className="mt-2 line-clamp-3 text-xs leading-5 text-gray-400">{work.description||'Uma reflexão da biblioteca digital Sagamente.'}</p>
       </div>
      </div>
      <div className="mt-auto border-t border-white/[.06] px-4 pb-4 pt-3">
       <div className="mb-3 flex flex-wrap gap-2 text-[10px] font-semibold text-gray-400">
        {work.ebook_status&&<span className="rounded-lg border border-white/10 px-2 py-1">E-book</span>}
        {work.audiobook_status&&<span className="rounded-lg border border-white/10 px-2 py-1">Audiobook</span>}
        <span className="rounded-lg border border-white/10 px-2 py-1">{available?'Acesso mediante liberação':'Pré-lançamento'}</span>
       </div>
       <Link to={'/l/'+encodeURIComponent(work.landing_slug)} className="flex min-h-11 items-center justify-center rounded-xl bg-[#A65A2A] px-4 text-sm font-bold text-white">Ver obra →</Link>
      </div>
     </article>
    })}</div>}
   {!worksLoading&&!worksError&&works.length===0&&<p className="text-sm text-gray-400">Nenhuma obra pública disponível neste momento.</p>}
  </section>

  <section id="cursos-gratuitos" className="scroll-mt-24 px-4 sm:px-5 pb-16 sm:pb-20 max-w-6xl mx-auto">
   <div className="flex items-end justify-between gap-4 mb-4 sm:mb-5">
    <div>
     <p className="text-[10px] uppercase tracking-[.18em] text-gray-600">Comece agora</p>
     <h2 className="text-xl sm:text-2xl font-bold mt-1">Cursos gratuitos</h2>
    </div>
    {isAuthenticated&&<Link to="/app/academia" className="text-xs font-bold text-[#ff5364]">Minha Academia →</Link>}
   </div>

   {loading
    ? <LoadingState label="Buscando cursos disponíveis..." />
    : <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
      {courses.map(c=><Link
       key={c.id}
       to={c.slug==='letramento-digital'?'/curso/letramento-digital':(isAuthenticated?'/app/academia/'+c.id:'/cadastro?next=%2Fapp%2Facademia')}
       className="pm-surface pm-surface-interactive overflow-hidden group rounded-2xl"
      >
       <div className="aspect-video bg-white/[.025] overflow-hidden">
        {c.cover_url
         ? <img src={c.cover_url} alt={`Capa do curso ${c.title}`} className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-105"/>
         : c.slug==='letramento-digital'
          ? <DigitalLiteracyCover compact className="rounded-none transition-transform duration-500 group-hover:scale-[1.02]"/>
          : <div className="w-full h-full flex items-center justify-center text-4xl text-[#A65A2A]">▶</div>}
       </div>
       <div className="p-4 sm:p-5">
        <div className="flex items-center justify-between">
         <span className="text-[9px] uppercase tracking-wider text-emerald-300">Gratuito</span>
         {c.estimated_minutes&&<span className="text-[10px] text-gray-600">{c.estimated_minutes} min</span>}
        </div>
        <h3 className="font-bold text-base sm:text-lg mt-2 group-hover:text-white leading-snug">{c.title}</h3>
        <p className="text-xs text-gray-500 mt-2 leading-relaxed line-clamp-3">{c.description}</p>
        <p className="text-xs font-bold text-[#ff5364] mt-5">Conhecer curso →</p>
       </div>
      </Link>)}
     </div>}
  </section>
 </main></PublicLayout>
}
