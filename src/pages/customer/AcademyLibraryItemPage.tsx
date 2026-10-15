import {useEffect,useState} from 'react'
import {Link,useParams} from 'react-router-dom'
import {academyLibraryApi,type LibraryItem} from '../../api/academyLibrary'
import {AcademyNavigation} from '../../components/academy/AcademyNavigation'
import {AcademyAudiobookCaptions} from '../../components/academy/AcademyAudiobookCaptions'
import {useAcademyAudio} from '../../contexts/AcademyAudioContext'
import {LoadingState} from '../../components/ui/AsyncState'

const stamp=(seconds:number)=>{
 const safe=Number.isFinite(seconds)?Math.max(0,Math.floor(seconds)):0
 return Math.floor(safe/60)+':'+String(safe%60).padStart(2,'0')
}
async function verifyReaderMedia(item:LibraryItem){
 const media=await academyLibraryApi.mediaTicket(item.id)
 if(media.mime_type!==item.mime_type)throw new Error('Formato da mídia inconsistente.')
 let url=media.url
 let response:Response
 try{response=await fetch(url,{method:'HEAD',cache:'no-store'})}
 catch{response=new Response(null,{status:503})}
 if(response.status===503){
  url=media.fallbackUrl
  try{response=await fetch(url,{method:'HEAD',cache:'no-store'})}
  catch{throw new Error('O serviço de mídia não está acessível. Verifique a conexão e tente novamente.')}
 }
 if(!response.ok){
  const stage=response.headers.get('X-Academy-Media-Stage')
  if(response.status===502&&stage==='drive_metadata')throw new Error('A integração do Google Drive não encontrou o arquivo.')
  if(response.status===502&&stage==='drive_permission')throw new Error('O Google Drive não permitiu acessar o arquivo.')
  if(response.status===403)throw new Error('Seu acesso temporário expirou ou foi revogado.')
  throw new Error('O arquivo não pôde ser carregado (erro '+response.status+'). Tente novamente.')
 }
 const receivedType=String(response.headers.get('Content-Type')||'').split(';')[0].toLowerCase()
 if(receivedType!==item.mime_type)throw new Error('O arquivo recebido não corresponde ao formato esperado.')
 return url
}

export function AcademyLibraryItemPage(){
 const {id}=useParams()
 const audio=useAcademyAudio()
 const [item,setItem]=useState<LibraryItem|null>(null)
 const [stream,setStream]=useState('')
 const [loading,setLoading]=useState(true)
 const [error,setError]=useState('')
 const [attempt,setAttempt]=useState(0)
 const playItem=audio.playItem
 useEffect(()=>{
  let active=true
  setLoading(true);setError('');setItem(null);setStream('')
  if(!id){setError('Conteúdo não encontrado.');setLoading(false);return}
  void academyLibraryApi.mine().then(async rows=>{
   const owned=rows.find(x=>x.id===id)
   if(!owned)throw new Error('Este conteúdo não está liberado para sua conta.')
   if(owned.format==='audiobook'){
    if(active){
     setItem(owned)
     // Prepare the persistent player if this route was opened directly.
     // Do not restart another page's playback when revisiting the same item.
     if(audio.current?.id!==owned.id)void playItem(owned.id,false)
    }
    return
   }
   const url=await verifyReaderMedia(owned)
   if(active){setItem(owned);setStream(url)}
  }).catch(e=>{if(active)setError(e instanceof Error?e.message:'Não foi possível abrir o conteúdo.')})
   .finally(()=>{if(active)setLoading(false)})
  return()=>{active=false}
 },[id,attempt,playItem])
 const isAudio=item?.format==='audiobook'
 const currentAudio=isAudio&&audio.current?.id===item.id
 const play=()=>{
  if(!item)return
  if(!currentAudio)void audio.playItem(item.id,true)
  else audio.toggle()
 }
 const jump=(offset:number)=>{
  audio.seek(audio.position+offset)
 }
 return <div className="mx-auto max-w-5xl">
  <AcademyNavigation active="mine"/>
  <Link to="/app/academia" className="mb-4 inline-flex min-h-10 items-center text-xs font-semibold text-[#E7AD79] hover:underline">← Voltar à Minha Academia</Link>
  {loading&&<LoadingState label="Preparando seu conteúdo privado..."/>}
  {error&&<div role="alert" className="rounded-xl border border-red-500/30 bg-red-500/10 p-4">
   <p className="text-sm text-red-200">{error}</p>
   <button type="button" onClick={()=>setAttempt(n=>n+1)} className="mt-3 rounded-lg border border-white/20 px-3 py-2 text-xs">Tentar novamente</button>
  </div>}
  {!loading&&item&&(isAudio||stream)&&<section className="overflow-hidden rounded-2xl border border-white/10 bg-[#17181B]">
   <header className="border-b border-white/10 p-4 sm:p-5">
    <p className="text-[10px] font-bold uppercase tracking-[.18em] text-[#E2A46C]">{/^\d{2}$/.test(item.release_code)?'SAGA NEGRA · Release '+item.release_code:'Biblioteca Sagamente'} · {item.format==='ebook'?'E-book':'Audiobook'}</p>
    <h1 className="mt-2 text-xl font-bold text-white sm:text-2xl">{item.title}</h1>
    <p className="mt-1 text-xs text-gray-400">Disponível exclusivamente para sua conta na Academia.</p>
   </header>
   {item.format==='audiobook'?<div className="space-y-5 p-5 sm:p-7">
    <AcademyAudiobookCaptions itemId={item.id} audioRef={audio.audioRef}>
     <div className="rounded-xl border border-white/10 bg-black/30 p-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
       <div className="min-w-0 flex-1">
        <p className="text-sm font-semibold text-white">Player da Academia</p>
        <p className="mt-1 text-xs text-gray-400">A reprodução continua quando você sai desta página, com controles no miniplayer.</p>
       </div>
       <span className="text-xs tabular-nums text-[#d8b59a]">{currentAudio?stamp(audio.position):'0:00'} / {currentAudio?stamp(audio.duration):'0:00'}</span>
      </div>
      <div className="mt-4 flex items-center justify-center gap-2 sm:gap-4">
       <button type="button" aria-label="Audiobook anterior" disabled={audio.loading||!audio.queue.length} onClick={audio.previous} className="min-h-11 rounded-xl border border-white/15 px-3 text-sm text-white disabled:opacity-40">⏮</button>
       <button type="button" aria-label="Voltar 15 segundos" onClick={()=>jump(-15)} disabled={!currentAudio||!audio.duration} className="min-h-11 rounded-xl border border-white/15 px-3 text-sm text-white disabled:opacity-40">−15s</button>
       <button type="button" onClick={play} disabled={audio.loading&&currentAudio} className="min-h-12 min-w-28 rounded-xl bg-[#E99156] px-5 text-sm font-bold text-[#1b100b] disabled:opacity-50">
        {audio.loading&&currentAudio?'Carregando...':currentAudio&&audio.playing?'Ⅱ Pausar':'▶ Ouvir'}
       </button>
       <button type="button" aria-label="Avançar 15 segundos" onClick={()=>jump(15)} disabled={!currentAudio||!audio.duration} className="min-h-11 rounded-xl border border-white/15 px-3 text-sm text-white disabled:opacity-40">+15s</button>
       <button type="button" aria-label="Próximo audiobook" disabled={audio.loading||audio.queue.length<2} onClick={audio.next} className="min-h-11 rounded-xl border border-white/15 px-3 text-sm text-white disabled:opacity-40">⏭</button>
      </div>
      <input aria-label="Progresso do audiobook" type="range" min={0} max={currentAudio&&audio.duration>0?audio.duration:1} step={1}
       value={currentAudio?Math.min(audio.position,audio.duration||1):0}
       onChange={e=>audio.seek(Number(e.target.value))} disabled={!currentAudio||!audio.duration}
       className="mt-5 w-full accent-[#E99156]"/>
      <div className="mt-3 flex flex-wrap items-center justify-between gap-3">
       <label htmlFor="saga-audio-speed" className="flex items-center gap-2 text-xs text-gray-300">Velocidade
        <select id="saga-audio-speed" value={audio.rate} onChange={event=>audio.setSpeed(Number(event.target.value))}
         className="min-h-10 rounded-lg border border-white/20 bg-[#222328] px-3 text-sm text-white">
         {[0.75,1,1.25,1.5,2].map(value=><option key={value} value={value}>{value}×</option>)}
        </select>
       </label>
       <label className="inline-flex items-center gap-2 text-xs text-[#dfc4b1]">
        <input type="checkbox" checked={audio.autoplay} onChange={e=>audio.setAutoplay(e.target.checked)} className="accent-[#E99156]"/>
        Tocar o próximo automaticamente
       </label>
      </div>
      {currentAudio&&audio.error&&<p role="alert" className="mt-4 rounded-lg border border-amber-500/20 p-3 text-xs text-amber-200">{audio.error}
       <button type="button" onClick={audio.retry} className="ml-2 font-bold underline">Tentar novamente</button></p>}
      <p className="mt-3 text-xs text-gray-500">A posição é lembrada neste dispositivo. Para trocar de audiobook, use o miniplayer ou a playlist sem voltar à biblioteca.</p>
     </div>
    </AcademyAudiobookCaptions>
   </div>:<div className="p-3 sm:p-5">
    <iframe title={'Leitor digital — '+item.title} src={stream} referrerPolicy="no-referrer" className="h-[74vh] min-h-[380px] w-full rounded-xl border border-white/10 bg-white"/>
    <p className="mt-3 text-xs text-gray-400">Leitura no navegador. Se o PDF não carregar, tente novamente para renovar o acesso temporário.</p>
   </div>}
  </section>}
 </div>
}
