import { useEffect,useState } from 'react'
import { Link } from 'react-router-dom'
import { PublicLayout } from '../../layouts/PublicLayout'
import { supabase } from '../../lib/supabase'
import { useAuth } from '../../contexts/AuthContext'
import { LoadingState } from '../../components/ui/AsyncState'

export function PublicAcademyPage(){
 const {isAuthenticated}=useAuth();const [courses,setCourses]=useState<any[]>([]);const [loading,setLoading]=useState(true);const [showFree,setShowFree]=useState(false)
 useEffect(()=>{supabase.rpc('academy_public_courses').then(({data,error})=>{setCourses(!error&&Array.isArray(data)?data:[]);setLoading(false)})},[])
 return <PublicLayout><main>
  <section className="px-5 py-14 md:py-20 text-center"><div className="max-w-4xl mx-auto"><p className="text-xs uppercase tracking-[.22em] font-bold text-[#E30613]">Academia Play Moments</p><h1 className="text-4xl md:text-6xl font-extrabold mt-4 leading-tight">Conhecimento para <span className="text-[#E30613]">fazer acontecer.</span></h1><p className="max-w-2xl mx-auto text-gray-400 mt-5 leading-relaxed">Cursos e formações práticas em tecnologia, comunicação e criação. Comece pelos conteúdos gratuitos e avance no seu ritmo.</p><div className="flex flex-wrap justify-center gap-3 mt-7"><button type="button" onClick={()=>setShowFree(true)} className="px-6 py-3 rounded-xl bg-[#E30613] text-white text-sm font-bold">Começar gratuitamente</button>{!isAuthenticated&&<Link to="/cadastro?next=%2Fapp%2Facademia" className="px-6 py-3 rounded-xl border border-white/10 text-sm font-bold text-gray-300">Criar conta</Link>}</div></div></section>
  {showFree&&<section id="cursos-gratuitos" className="px-5 pb-20 max-w-6xl mx-auto"><div className="flex items-end justify-between gap-4 mb-5"><div><p className="text-[10px] uppercase tracking-[.18em] text-gray-600">Comece agora</p><h2 className="text-2xl font-bold mt-1">Cursos gratuitos</h2></div>{isAuthenticated&&<Link to="/app/academia" className="text-xs font-bold text-[#ff5364]">Minha Academia →</Link>}</div>
   {loading?<LoadingState label="Buscando cursos disponíveis..." />:courses.length===0?<div className="pm-surface p-8 text-center text-sm text-gray-500">Os primeiros conteúdos gratuitos estão sendo preparados.</div>:<div className="grid md:grid-cols-2 lg:grid-cols-3 gap-4">{courses.map(c=><Link key={c.id} to={c.slug==='letramento-digital'?'/curso/letramento-digital':(isAuthenticated?'/app/academia/'+c.id:'/cadastro?next=%2Fapp%2Facademia')} className="pm-surface pm-surface-interactive overflow-hidden group"><div className="aspect-video bg-white/[.025]">{c.cover_url?<img src={c.cover_url} alt={`Capa do curso ${c.title}`} className="w-full h-full object-cover"/>:<div className="w-full h-full flex items-center justify-center text-4xl text-[#E30613]">▶</div>}</div><div className="p-5"><div className="flex items-center justify-between"><span className="text-[9px] uppercase tracking-wider text-emerald-300">Gratuito</span>{c.estimated_minutes&&<span className="text-[10px] text-gray-600">{c.estimated_minutes} min</span>}</div><h3 className="font-bold text-lg mt-2 group-hover:text-white">{c.title}</h3><p className="text-xs text-gray-500 mt-2 leading-relaxed line-clamp-3">{c.description}</p><p className="text-xs font-bold text-[#ff5364] mt-5">Conhecer curso →</p></div></Link>)}</div>}
  </section>}
 </main></PublicLayout>
}
