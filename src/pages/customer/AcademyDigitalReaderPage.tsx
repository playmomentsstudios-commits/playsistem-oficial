import { useEffect,useRef,useState } from 'react'
import { Link,useParams } from 'react-router-dom'
import { academyDigitalApi,type DigitalPublication } from '../../api/academyDigital'

const speedOptions=[0.75,1,1.25,1.5,2]
export function AcademyDigitalReaderPage({adminPreview=false}:{adminPreview?:boolean}){
 const {id}=useParams()
 const [content,setContent]=useState<DigitalPublication|null>(null)
 const [src,setSrc]=useState('')
 const [loading,setLoading]=useState(true)
 const [error,setError]=useState('')
 const [speed,setSpeed]=useState(1)
 const audio=useRef<HTMLAudioElement|null>(null)
 const positionKey='sagamente.academy.audio.'+id
 useEffect(()=>{
  if(!id)return
  let mounted=true
  setLoading(true);setError('');setSrc('')
  Promise.all([academyDigitalApi.publication(id),academyDigitalApi.mediaUrl(id)])
   .then(([publication,media])=>{if(!mounted)return;setContent(publication);setSrc(media.url)})
   .catch(e=>{if(mounted)setError(e.message||'Conteúdo indisponível.')})
   .finally(()=>{if(mounted)setLoading(false)})
  return()=>{mounted=false}
 },[id])
 function resume(){
  const element=audio.current
  if(!element||!Number.isFinite(element.duration))return
  try{
   const saved=Number(window.localStorage.getItem(positionKey)||0)
   if(saved>0&&saved<element.duration-10)element.currentTime=saved
  }catch{}
 }
 function remember(){
  const element=audio.current
  if(!element)return
  try{window.localStorage.setItem(positionKey,String(Math.floor(element.currentTime)))}catch{}
 }
 function changeSpeed(value:number){
  setSpeed(value);if(audio.current)audio.current.playbackRate=value
 }
 return <div className="mx-auto max-w-6xl">
  <Link to={adminPreview?'/admin/academia/publicacoes':'/app/academia'} className="text-xs font-semibold text-[#F2AE74] hover:underline">← {adminPreview?'Publicações digitais':'Minha Academia'}</Link>
  {loading?<div className="mt-6 rounded-2xl border border-white/10 p-8 text-sm text-gray-400">Preparando seu conteúdo…</div>:error?<section role="alert" className="mt-6 rounded-2xl border border-white/10 bg-[#18191c] p-6">
   <h1 className="text-xl font-bold">Não foi possível abrir</h1>
   <p className="mt-2 text-sm text-gray-400">{error}</p>
   <p className="mt-2 text-xs text-gray-500">O acesso requer uma compra confirmada ou liberação administrativa. Se acabou de pagar, confira o status do pedido antes de tentar novamente.</p>
   <Link to={adminPreview?'/admin/academia/publicacoes':'/app/academia'} className="mt-5 inline-flex rounded-lg border border-white/15 px-4 py-2 text-xs text-gray-100">Voltar</Link>
  </section>:content&&<div className="mt-5">
   <div className="mb-4 flex flex-wrap items-end justify-between gap-3">
    <div><span className="text-[11px] font-bold uppercase tracking-[.15em] text-[#F2AE74]">{content.kind==='ebook'?'E-book':'Audiobook'}</span><h1 className="mt-1 text-2xl font-bold text-white">{content.title}</h1>{content.author&&<p className="mt-1 text-xs text-gray-400">{content.author}</p>}</div>
    <span className="text-xs text-gray-400">{content.kind==='audiobook'&&content.duration_minutes?content.duration_minutes+' min':content.page_count?content.page_count+' páginas':''}</span>
   </div>
   {content.kind==='ebook'?<div className="overflow-hidden rounded-2xl border border-white/10 bg-[#24262c]">
    <iframe src={src} title={'Leitor de '+content.title} className="block h-[75vh] min-h-[420px] w-full bg-white"/>
    <p className="border-t border-white/10 bg-[#18191c] px-4 py-3 text-xs text-gray-400">Leitor PDF protegido por acesso temporário. Para ampliar ou navegar nas páginas, use os controles do leitor do navegador.</p>
   </div>:<section className="rounded-2xl border border-white/10 bg-[#18191c] p-5 sm:p-8">
    <div className="mx-auto max-w-2xl">
     {content.cover_url?<img src={content.cover_url} alt={'Capa de '+content.title} className="mx-auto mb-6 aspect-[4/5] max-h-[320px] rounded-xl object-cover"/>:<div className="mx-auto mb-6 flex aspect-[4/3] max-h-48 max-w-64 items-center justify-center rounded-2xl bg-[#392519] text-5xl text-[#EDA76C]" aria-hidden="true">♫</div>}
     <audio ref={audio} src={src} controls controlsList="nodownload" preload="metadata" onLoadedMetadata={resume} onTimeUpdate={remember} onEnded={()=>{try{window.localStorage.removeItem(positionKey)}catch{}}} className="w-full" aria-label={'Reproduzir audiobook '+content.title}/>
     <div className="mt-4 flex items-center justify-between gap-3"><label htmlFor="academy-audio-speed" className="text-xs text-gray-400">Velocidade de reprodução</label>
      <select id="academy-audio-speed" value={speed} onChange={e=>changeSpeed(Number(e.target.value))} className="rounded-lg border border-white/15 bg-[#24262C] px-3 py-2 text-xs text-white">
       {speedOptions.map(value=><option value={value} key={value}>{value}×</option>)}
      </select>
     </div>
     <p className="mt-3 text-xs text-gray-500">A reprodução retoma no mesmo dispositivo. O áudio é fornecido temporariamente pelo serviço autorizado da Academia.</p>
    </div>
   </section>}
   {content.summary&&<details className="mt-4 rounded-xl border border-white/10 bg-white/[.025] p-4"><summary className="cursor-pointer text-sm font-semibold">Sobre esta obra</summary><p className="mt-3 text-sm leading-relaxed text-gray-400">{content.summary}</p></details>}
  </div>}
 </div>
}
