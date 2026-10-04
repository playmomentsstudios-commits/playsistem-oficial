import { useEffect,useState } from 'react'
import { Link } from 'react-router-dom'
import { PublicLayout } from '../../layouts/PublicLayout'
import { DigitalLiteracyCover } from '../../components/academy/DigitalLiteracyCover'
import { supabase } from '../../lib/supabase'
import { useAuth } from '../../contexts/AuthContext'
import { LoadingState } from '../../components/ui/AsyncState'

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
 const [loading,setLoading]=useState(true)

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
    <p className="text-xs uppercase tracking-[.22em] font-bold text-[#E30613]">Academia Play Moments</p>
    <h1 className="text-[2.35rem] sm:text-4xl md:text-6xl font-extrabold mt-4 leading-[1.02]">
     Conhecimento para <span className="text-[#E30613]">fazer acontecer.</span>
    </h1>
    <p className="max-w-2xl mx-auto text-sm sm:text-base text-gray-400 mt-4 sm:mt-5 leading-relaxed">
     Cursos e formações práticas em tecnologia, comunicação e criação. Comece pelos conteúdos gratuitos e avance no seu ritmo.
    </p>
    <div className="flex flex-col sm:flex-row sm:flex-wrap justify-center gap-3 mt-6 sm:mt-7">
     <button type="button" onClick={goToFreeCourses} className="w-full sm:w-auto min-h-12 px-6 py-3 rounded-xl bg-[#E30613] text-white text-sm font-bold">
      Começar gratuitamente
     </button>
     {!isAuthenticated&&<Link to="/cadastro?next=%2Fapp%2Facademia" className="w-full sm:w-auto min-h-12 inline-flex items-center justify-center px-6 py-3 rounded-xl border border-white/10 text-sm font-bold text-gray-300">Criar conta</Link>}
    </div>
   </div>
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
          : <div className="w-full h-full flex items-center justify-center text-4xl text-[#E30613]">▶</div>}
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
