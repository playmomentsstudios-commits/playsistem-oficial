import { useEffect,useMemo,useState } from 'react'
import { useParams,Link } from 'react-router-dom'
import { academyApi } from '../../api/academy'
import { useToast } from '../../contexts/ToastContext'

function embedUrl(source:string,url:string){
 if(source==='youtube'){const id=url.match(/(?:youtu\.be\/|v=|embed\/)([^?&/]+)/)?.[1];return id?`https://www.youtube.com/embed/${id}`:url}
 if(source==='vimeo'){const id=url.match(/vimeo\.com\/(?:video\/)?(\d+)/)?.[1];return id?`https://player.vimeo.com/video/${id}`:url}
 if(source==='drive'){const id=url.match(/drive\.google\.com\/file\/d\/([^/]+)/)?.[1]||url.match(/[?&]id=([^&]+)/)?.[1];return id?`https://drive.google.com/file/d/${id}/preview`:url}
 return url
}
export function AcademyCoursePage(){
 const {id}=useParams();const toast=useToast();const [data,setData]=useState<any>(null);const [active,setActive]=useState<any>(null);const [loading,setLoading]=useState(true);const [driveUrl,setDriveUrl]=useState('');const [materials,setMaterials]=useState<any[]>([])
 const load=async()=>{if(!id)return;try{const value=await academyApi.courseForStudent(id);setData(value);const lessons=value.modules.flatMap((m:any)=>m.lessons||[]);setActive((current:any)=>current&&lessons.find((l:any)=>l.id===current.id)||lessons[0]||null)}catch(e:any){toast(e.message,'error')}finally{setLoading(false)}}
 useEffect(()=>{void load()},[id])
 useEffect(()=>{setDriveUrl('');setMaterials([]);if(active?.id)academyApi.lessonMaterials(active.id).then(setMaterials).catch(()=>{});if(active?.video_source==='drive'&&active?.video_drive_file_id){academyApi.mediaTicket('lesson',active.id).then(x=>setDriveUrl(x.url)).catch((e:any)=>toast(e.message,'error'))}},[active?.id])
 const completed=useMemo(()=>new Set((data?.progress||[]).filter((p:any)=>p.completed).map((p:any)=>p.lesson_id)),[data])
 const lessons=data?.modules?.flatMap((m:any)=>m.lessons||[])||[];const percent=lessons.length?Math.round(completed.size/lessons.length*100):0
 const toggle=async()=>{if(!active||!data?.enrollment)return;try{await academyApi.setLessonComplete(data.enrollment.id,active.id,!completed.has(active.id));await load()}catch(e:any){toast(e.message,'error')}}
 if(loading)return <div className="py-16 text-center text-sm text-gray-500">Carregando conteúdo...</div>
 if(!data)return <div className="pm-surface p-8">Conteúdo indisponível.</div>
 return <div className="max-w-7xl mx-auto"><div className="mb-4"><Link to="/app/academia" className="text-xs text-gray-500 hover:text-white">← Minha Academia</Link></div>
  <div className="grid xl:grid-cols-[1fr_340px] gap-4">
   <main><div className="aspect-video rounded-2xl overflow-hidden bg-black border border-white/8 flex items-center justify-center">{(active?.video_source==='youtube'||active?.video_source==='vimeo'||(active?.video_source==='drive'&&active?.video_url&&!active?.video_drive_file_id))?<iframe className="w-full h-full" src={embedUrl(active.video_source,active.video_url||'')} allow="autoplay; fullscreen; picture-in-picture" allowFullScreen/>:active?.video_source==='drive'&&driveUrl?<video className="w-full h-full bg-black" controls controlsList="nodownload noremoteplayback" disablePictureInPicture preload="metadata" src={driveUrl} onContextMenu={e=>e.preventDefault()}/>:<div className="text-center text-gray-600"><div className="text-4xl mb-3">▶</div><p className="text-sm">Esta aula ainda não possui vídeo.</p></div>}</div>
    <div className="pm-surface mt-4 p-5"><div className="flex flex-wrap items-start justify-between gap-4"><div><p className="text-[10px] uppercase tracking-wider text-[#ff5364]">{data.course.title}</p><h1 className="text-xl md:text-2xl font-bold mt-1">{active?.title||'Conteúdo'}</h1></div>{active&&data.enrollment&&<button onClick={toggle} className={'min-h-10 px-4 rounded-xl text-xs font-bold '+(completed.has(active.id)?'bg-emerald-500/10 text-emerald-300 border border-emerald-500/20':'bg-[#E30613] text-white')}>{completed.has(active.id)?'✓ Aula concluída':'Marcar como concluída'}</button>}</div>{active?.description&&<p className="text-sm text-gray-400 leading-relaxed mt-4">{active.description}</p>}{materials.length>0&&<div className="mt-5 pt-4 border-t border-white/8"><p className="text-xs font-semibold mb-2">Materiais da aula</p><div className="flex flex-wrap gap-2">{materials.map((m:any)=><button key={m.id} onClick={async()=>{try{const t=await academyApi.mediaTicket('material',m.id);window.open(t.url,'_blank','noopener,noreferrer')}catch(e:any){toast(e.message,'error')}}} className="px-3 min-h-9 rounded-lg bg-white/[.05] hover:bg-white/[.08] text-xs text-gray-300">📎 {m.title}</button>)}</div></div>}</div>
   </main>
   <aside className="pm-surface overflow-hidden h-fit xl:sticky xl:top-20"><div className="p-4 border-b border-white/8"><div className="flex justify-between text-xs"><span className="font-semibold">Seu progresso</span><span className="text-gray-500">{percent}%</span></div><div className="h-1.5 bg-white/[.05] rounded-full mt-3 overflow-hidden"><div className="h-full bg-[#E30613] rounded-full" style={{width:`${percent}%`}}/></div></div>
    <div className="max-h-[70vh] overflow-y-auto">{data.modules.map((m:any,i:number)=><div key={m.id}><div className="px-4 py-3 bg-white/[.02] border-b border-white/[.05]"><p className="text-[9px] uppercase tracking-wider text-gray-600">Módulo {i+1}</p><p className="text-xs font-semibold mt-1">{m.title}</p></div>{(m.lessons||[]).map((l:any,j:number)=><button key={l.id} onClick={()=>setActive(l)} className={'w-full px-4 py-3 border-b border-white/[.04] text-left flex gap-3 hover:bg-white/[.025] '+(active?.id===l.id?'bg-white/[.035]':'')}><span className={'w-6 h-6 rounded-full shrink-0 flex items-center justify-center text-[9px] '+(completed.has(l.id)?'bg-emerald-500/10 text-emerald-300':'bg-white/[.05] text-gray-500')}>{completed.has(l.id)?'✓':j+1}</span><span className="text-xs text-gray-300 leading-5">{l.title}</span></button>)}</div>)}</div>
   </aside>
  </div>
 </div>
}
