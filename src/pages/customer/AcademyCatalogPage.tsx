import { useEffect,useMemo,useState } from 'react'
import { Link,useNavigate } from 'react-router-dom'
import { academyApi,type Course } from '../../api/academy'
import { academyDigitalApi,type DigitalPublication } from '../../api/academyDigital'
import { AcademyNavigation } from '../../components/academy/AcademyNavigation'
import { LoadingState,ErrorState } from '../../components/ui/AsyncState'

type Category='all'|'ebook'|'audiobook'|'course'|'mentoring'
const categories:{key:Category;label:string}[]=[
 {key:'all',label:'Tudo'},
 {key:'ebook',label:'E-books'},
 {key:'audiobook',label:'Audiobooks'},
 {key:'course',label:'Cursos'},
 {key:'mentoring',label:'Mentorias'},
]
const savedDensity=()=>{try{return window.localStorage.getItem('sagamente.academy.density')==='compact'}catch{return false}}

export function AcademyCatalogPage(){
 const navigate=useNavigate()
 const [courses,setCourses]=useState<Course[]>([])
 const [publications,setPublications]=useState<DigitalPublication[]>([])
 const [digitalOwned,setDigitalOwned]=useState<Set<string>>(new Set())
 const [owned,setOwned]=useState<Set<string>>(new Set())
 const [loading,setLoading]=useState(true)
 const [error,setError]=useState('')
 const [filter,setFilter]=useState<Category>('all')
 const [search,setSearch]=useState('')
 const [busy,setBusy]=useState('')
 const [compact]=useState(savedDensity)

 useEffect(()=>{
  let active=true
  Promise.all([academyApi.freeCourses(),academyApi.myCourses(),academyDigitalApi.catalog().catch(()=>[]),academyDigitalApi.myLibrary().catch(()=>[])])
   .then(([available,mine,published,library])=>{if(!active)return;setCourses(available as Course[]);setOwned(new Set(mine.map((e:any)=>e.course_id)));setPublications(published);setDigitalOwned(new Set(library.map(x=>x.publication_id)))})
   .catch((e:any)=>{if(active)setError(e.message||'Não foi possível carregar o catálogo.')})
   .finally(()=>{if(active)setLoading(false)})
  return()=>{active=false}
 },[])

 const results=useMemo(()=>courses.filter(c=>(filter==='all'||filter==='course')&&
  [c.title,c.description,c.category,c.instructor_name].some(x=>String(x||'').toLocaleLowerCase('pt-BR').includes(search.trim().toLocaleLowerCase('pt-BR')))),[courses,filter,search])
 const digitalResults=useMemo(()=>publications.filter(p=>(filter==='all'||filter===p.kind)&&
  [p.title,p.summary,p.author].some(x=>String(x||'').toLocaleLowerCase('pt-BR').includes(search.trim().toLocaleLowerCase('pt-BR')))),[publications,filter,search])

 async function access(course:Course){
  if(owned.has(course.id)){navigate('/app/academia/'+course.id);return}
  try{
   setBusy(course.id);setError('')
   await academyApi.selfEnroll(course.id)
   navigate('/app/academia/'+course.id)
  }catch(e:any){setError(e.message||'Não foi possível liberar o curso.')}finally{setBusy('')}
 }

 return <div className="mx-auto max-w-6xl">
  <AcademyNavigation active="catalog"/>
  <header className="mb-6">
   <p className="text-[11px] font-semibold uppercase tracking-[.17em] text-[#DFA269]">Biblioteca de conhecimento</p>
   <h1 className="mt-1 text-2xl font-bold tracking-tight text-white sm:text-3xl">Academia</h1>
   <p className="mt-2 max-w-2xl text-sm leading-relaxed text-gray-400">Explore e-books, audiobooks, cursos e mentorias. Aqui você encontra os conteúdos disponíveis; na Minha Academia ficam somente os conteúdos liberados para você.</p>
  </header>
  <section aria-label="Pesquisar conteúdos" className="mb-4">
   <label htmlFor="academy-catalog-search" className="sr-only">Buscar na Academia</label>
   <input id="academy-catalog-search" value={search} onChange={e=>setSearch(e.target.value)}
    placeholder="Buscar por título, assunto ou autor..."
    className="min-h-11 w-full rounded-xl border border-white/10 bg-white/[.035] px-4 text-sm text-white outline-none placeholder:text-gray-500 focus:border-[#DFA269]"/>
  </section>
  <nav aria-label="Filtrar formato" className="mb-5 flex flex-wrap gap-2">
   {categories.map(category=><button type="button" key={category.key} onClick={()=>setFilter(category.key)} aria-pressed={filter===category.key}
    className={'min-h-10 rounded-xl border px-3.5 py-2 text-xs font-semibold transition-colors '+(filter===category.key?'border-[#A65A2A] bg-[#A65A2A] text-white':'border-white/10 bg-white/[.025] text-gray-400 hover:border-white/20 hover:text-white')}>{category.label}</button>)}
  </nav>
  {error&&<div role="alert" className="mb-4 rounded-xl border border-red-500/30 bg-red-500/10 px-4 py-3 text-sm text-red-200">{error}</div>}
  {loading?<LoadingState label="Carregando conteúdos disponíveis..."/>:error&&courses.length===0?<ErrorState message={error} action={<button type="button" onClick={()=>window.location.reload()} className="rounded-lg border border-white/10 px-4 py-2 text-sm">Tentar novamente</button>}/>:results.length>0||digitalResults.length>0?<section aria-label="Conteúdos disponíveis" className={'grid sm:grid-cols-2 lg:grid-cols-3 '+(compact?'gap-2':'gap-4')}>
   {results.map(course=><article key={course.id} className="overflow-hidden rounded-2xl border border-white/10 bg-[#17181C] transition-colors hover:border-white/20">
    <div className={(compact?'aspect-[16/7]':'aspect-video')+' overflow-hidden bg-gradient-to-br from-[#3A271B] via-[#201B1B] to-[#17181C]'}>
     {course.cover_url?<img loading="lazy" src={course.cover_url} alt="" className="h-full w-full object-cover"/>:<div className="flex h-full items-center justify-center text-4xl text-[#DFA269]" aria-hidden="true">▣</div>}
    </div>
    <div className={compact?'p-3':'p-4'}>
     <div className="flex flex-wrap items-center justify-between gap-2"><span className="rounded-full bg-[#A65A2A]/20 px-2 py-1 text-[10px] font-semibold text-[#F2AE74]">Curso</span><span className="text-[11px] text-emerald-300">Gratuito</span></div>
     <h2 className="mt-3 line-clamp-2 text-base font-semibold text-white">{course.title}</h2>
     <p className="mt-1 line-clamp-2 text-xs leading-relaxed text-gray-400">{course.description||'Explore este conteúdo em seu ritmo.'}</p>
     <div className="mt-3 flex flex-wrap items-center justify-between gap-3">
      <span className="text-[11px] text-gray-500">{course.estimated_minutes?course.estimated_minutes+' min':'Estude no seu ritmo'}</span>
      <button type="button" onClick={()=>void access(course)} disabled={busy===course.id} className="min-h-10 rounded-lg bg-[#A65A2A] px-3 py-2 text-xs font-bold text-white hover:bg-[#BC703A] disabled:opacity-50">
       {busy===course.id?'Liberando…':owned.has(course.id)?'Continuar →':'Começar gratuitamente →'}
      </button>
     </div>
    </div>
   </article>)}
   {digitalResults.map(publication=><article key={publication.id} className="overflow-hidden rounded-2xl border border-white/10 bg-[#17181C] transition-colors hover:border-white/20">
    <div className={(compact?'aspect-[16/7]':'aspect-video')+' overflow-hidden bg-gradient-to-br from-[#39251B] to-[#1B1D22]'}>
     {publication.cover_url?<img loading="lazy" src={publication.cover_url} alt="" className="h-full w-full object-cover"/>:<div className="flex h-full items-center justify-center text-5xl text-[#DFA269]" aria-hidden="true">{publication.kind==='ebook'?'▤':'♫'}</div>}
    </div>
    <div className={compact?'p-3':'p-4'}>
     <span className="rounded-full bg-[#A65A2A]/20 px-2 py-1 text-[10px] font-bold text-[#F2AE74]">{publication.kind==='ebook'?'E-book':'Audiobook'}</span>
     <h2 className="mt-3 line-clamp-2 text-base font-semibold text-white">{publication.title}</h2>
     <p className="mt-1 line-clamp-2 text-xs leading-relaxed text-gray-400">{publication.summary||'Conheça esta publicação.'}</p>
     <div className="mt-3 flex flex-wrap items-center justify-between gap-2">
      <span className="text-[11px] text-gray-400">{publication.kind==='audiobook'?publication.duration_minutes?publication.duration_minutes+' minutos':'Áudio':publication.page_count?publication.page_count+' páginas':'Leitura digital'}</span>
      {digitalOwned.has(publication.id)?<Link to={'/app/academia/obra/'+publication.id} className="inline-flex min-h-10 items-center rounded-lg bg-[#A65A2A] px-3 text-xs font-bold text-white">{publication.kind==='ebook'?'Ler':'Ouvir'} →</Link>:<span className="text-[11px] text-[#F2AE74]">Disponível após aquisição</span>}
     </div>
    </div>
   </article>)}
  </section>:<section className="rounded-2xl border border-dashed border-white/15 bg-white/[.025] px-5 py-10 text-center">
   <h2 className="text-base font-semibold text-white">{search.trim()?'Nenhum conteúdo encontrado':'Ainda não há publicações nesta categoria'}</h2>
   <p className="mx-auto mt-2 max-w-md text-sm text-gray-400">{search.trim()?'Experimente outro termo ou selecione Tudo.':'Os e-books, audiobooks e mentorias serão apresentados aqui quando houver publicações reais e acesso seguro configurado.'}</p>
   <button type="button" onClick={()=>{setSearch('');setFilter('all')}} className="mt-4 min-h-10 rounded-lg border border-white/15 px-4 text-xs font-semibold text-gray-200">Ver conteúdos disponíveis</button>
  </section>}
  <div className="mt-6 flex flex-wrap items-center justify-between gap-3 rounded-xl border border-white/10 bg-white/[.025] p-4">
   <p className="text-xs text-gray-400">Já tem algum conteúdo liberado? Encontre-o sem misturar com toda a vitrine.</p>
   <Link to="/app/academia" className="text-sm font-semibold text-[#F2AE74] hover:underline">Abrir Minha Academia →</Link>
  </div>
 </div>
}
