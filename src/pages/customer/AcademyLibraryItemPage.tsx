import { useEffect,useRef,useState } from 'react'
import { Link,useParams } from 'react-router-dom'
import { academyLibraryApi,type LibraryItem } from '../../api/academyLibrary'
import { AcademyNavigation } from '../../components/academy/AcademyNavigation'
import { LoadingState } from '../../components/ui/AsyncState'

export function AcademyLibraryItemPage(){
 const {id}=useParams()
 const audioRef=useRef<HTMLAudioElement>(null)
 const [item,setItem]=useState<LibraryItem|null>(null)
 const [stream,setStream]=useState('')
 const [loading,setLoading]=useState(true)
 const [error,setError]=useState('')
 const [rate,setRate]=useState(1)
 useEffect(()=>{
  let active=true
  setLoading(true);setError('');setItem(null);setStream('')
  if(!id){setError('Conteúdo não encontrado.');setLoading(false);return}
  academyLibraryApi.mine().then(async rows=>{
   const owned=rows.find(x=>x.id===id)
   if(!owned)throw new Error('Este conteúdo não está liberado para sua conta.')
   const media=await academyLibraryApi.mediaTicket(owned.id)
   if(!active)return
   if(media.mime_type!==owned.mime_type)throw new Error('Formato da mídia inconsistente.')
   // Preflight on the SAME origin catches expired tickets and upstream Drive
   // errors before showing a blank PDF iframe or an audio element at 0:00.
   const probe=await fetch(media.url,{method:'HEAD',cache:'no-store'})
   if(!probe.ok){
    if(probe.status===403)throw new Error('Seu acesso temporário expirou. Atualize para gerar um novo link.')
    throw new Error('O arquivo não pôde ser carregado do Drive (erro '+probe.status+'). Tente novamente.')
   }
   const receivedType=String(probe.headers.get('Content-Type')||'').split(';')[0].toLowerCase()
   if(receivedType!==owned.mime_type)throw new Error('O arquivo recebido não corresponde ao formato esperado.')
   if(!active)return
   setItem(owned);setStream(media.url)
  }).catch((e:any)=>{if(active)setError(e?.message||'Erro ao abrir conteúdo.')})
   .finally(()=>{if(active)setLoading(false)})
  return()=>{active=false}
 },[id])
 function restoreAudioPosition(){
  if(!audioRef.current||!item)return
  try{
   const saved=Number(window.localStorage.getItem('sagamente.library.position.'+item.id)||0)
   if(Number.isFinite(saved)&&saved>0&&Number.isFinite(audioRef.current.duration)){
    audioRef.current.currentTime=Math.min(saved,Math.max(0,audioRef.current.duration-5))
   }
  }catch{}
  audioRef.current.playbackRate=rate
 }
 function saveAudioPosition(){
  if(!audioRef.current||!item)return
  try{window.localStorage.setItem('sagamente.library.position.'+item.id,String(Math.floor(audioRef.current.currentTime)))}catch{}
 }
 return <div className="mx-auto max-w-5xl">
  <AcademyNavigation active="mine"/>
  <Link to="/app/academia" className="mb-4 inline-flex min-h-10 items-center text-xs font-semibold text-[#E7AD79] hover:underline">← Voltar à Minha Academia</Link>
  {loading&&<LoadingState label="Preparando seu conteúdo privado..."/>}
  {error&&<div role="alert" className="rounded-xl border border-red-500/30 bg-red-500/10 p-4">
   <p className="text-sm text-red-200">{error}</p>
   <button type="button" onClick={()=>window.location.reload()} className="mt-3 rounded-lg border border-white/20 px-3 py-2 text-xs">Tentar novamente</button>
  </div>}
  {!loading&&item&&stream&&<section className="overflow-hidden rounded-2xl border border-white/10 bg-[#17181B]">
   <header className="border-b border-white/10 p-4 sm:p-5">
    <p className="text-[10px] font-bold uppercase tracking-[.18em] text-[#E2A46C]">SAGA NEGRA · Release {item.release_code} · {item.format==='ebook'?'E-book':'Audiobook'}</p>
    <h1 className="mt-2 text-xl font-bold text-white sm:text-2xl">{item.title}</h1>
    <p className="mt-1 text-xs text-gray-400">Disponível exclusivamente para sua conta na Academia.</p>
   </header>
   {item.format==='audiobook'?<div className="space-y-5 p-5 sm:p-7">
    <div className="flex aspect-[3/1] max-h-52 items-center justify-center rounded-xl bg-gradient-to-br from-[#56321C] via-[#29221F] to-[#141416]">
     <span className="text-5xl text-[#E4A36C]" aria-hidden="true">♫</span>
    </div>
    <div className="rounded-xl border border-white/10 bg-black/30 p-4">
     <audio ref={audioRef} key={item.id} controls controlsList="nodownload" preload="metadata" src={stream} className="w-full" onLoadedMetadata={restoreAudioPosition} onTimeUpdate={saveAudioPosition} onEnded={()=>{try{window.localStorage.removeItem('sagamente.library.position.'+item.id)}catch{}}} onError={()=>setError('O arquivo não foi reproduzido. Verifique o acesso ao Drive ou recarregue a página.')}>
      Seu navegador não suporta reprodução de áudio.
     </audio>
     <div className="mt-4 flex flex-wrap items-center justify-between gap-2">
      <label htmlFor="saga-audio-speed" className="text-xs text-gray-300">Velocidade</label>
      <select id="saga-audio-speed" value={rate} onChange={event=>{const next=Number(event.target.value);setRate(next);if(audioRef.current)audioRef.current.playbackRate=next}} className="min-h-10 rounded-lg border border-white/20 bg-[#222328] px-3 text-sm text-white">
       {[0.75,1,1.25,1.5,2].map(value=><option key={value} value={value}>{value}×</option>)}
      </select>
     </div>
     <p className="mt-3 text-xs text-gray-500">Pause, avance ou retorne pelo controle de reprodução. A posição é lembrada neste dispositivo.</p>
    </div>
   </div>:<div className="p-3 sm:p-5">
    <iframe title={'Leitor digital — '+item.title} src={stream} referrerPolicy="no-referrer" className="h-[74vh] min-h-[380px] w-full rounded-xl border border-white/10 bg-white"/>
    <p className="mt-3 text-xs text-gray-400">Leitura no navegador. Se o PDF não carregar, atualize a página para renovar o acesso temporário.</p>
   </div>}
  </section>}
 </div>
}
