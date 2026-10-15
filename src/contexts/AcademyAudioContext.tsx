import {
 createContext,useCallback,useContext,useEffect,useRef,useState,
 type ReactNode,type RefObject
} from 'react'
import {useLocation} from 'react-router-dom'
import {useAuth} from './AuthContext'
import {academyLibraryApi,type LibraryItem} from '../api/academyLibrary'
import {AcademyAudioDock} from '../components/academy/AcademyAudioDock'

type AudioContextValue={
 audioRef:RefObject<HTMLAudioElement|null>
 current:LibraryItem|null
 queue:LibraryItem[]
 playing:boolean
 loading:boolean
 error:string
 duration:number
 position:number
 rate:number
 autoplay:boolean
 repeat:boolean
 playItem:(id:string,autoplay?:boolean)=>Promise<void>
 toggle:()=>void
 next:()=>void
 previous:()=>void
 seek:(value:number)=>void
 setSpeed:(value:number)=>void
 setAutoplay:(value:boolean)=>void
 setRepeat:(value:boolean)=>void
 retry:()=>void
 refresh:()=>Promise<void>
}
const AudioContext=createContext<AudioContextValue|null>(null)
const POSITION_KEY='sagamente.library.position.'
const OPTIONS_KEY='sagamente.academy.autoplay'
const LOOP_KEY='sagamente.academy.repeat'
const safeSaved=(key:string,defaultValue:boolean)=>{try{return window.localStorage.getItem(key)!=='false'&&
 (window.localStorage.getItem(key)!==null||defaultValue)}catch{return defaultValue}}
const formatProblem=(error:unknown)=>error instanceof Error?error.message:'Não foi possível iniciar o audiobook.'
async function verifiedMediaUrl(id:string,expected:'audio/mpeg'){
 const media=await academyLibraryApi.mediaTicket(id)
 if(media.mime_type!==expected)throw new Error('O arquivo retornado não é um audiobook MP3.')
 let url=media.url
 let probe:Response
 try{probe=await fetch(url,{method:'HEAD',cache:'no-store'})}
 catch{probe=new Response(null,{status:503})}
 if(probe.status===503){
  url=media.fallbackUrl
  try{probe=await fetch(url,{method:'HEAD',cache:'no-store'})}
  catch{throw new Error('O serviço de áudio está indisponível. Verifique a conexão e tente novamente.')}
 }
 if(!probe.ok){
  if(probe.status===403)throw new Error('O acesso temporário expirou ou foi revogado. Tente novamente.')
  if(probe.status===502)throw new Error('O Google Drive não conseguiu fornecer este audiobook. Tente novamente ou informe a equipe.')
  throw new Error('O audiobook não pôde ser carregado (erro '+probe.status+').')
 }
 const returnedType=String(probe.headers.get('Content-Type')||'').split(';')[0].toLowerCase()
 if(returnedType!=='audio/mpeg')throw new Error('O servidor retornou um arquivo diferente de MP3.')
 return url
}
export function useAcademyAudio(){
 const context=useContext(AudioContext)
 if(!context)throw new Error('O player da Academia não foi inicializado.')
 return context
}
export function AcademyAudioProvider({children}:{children:ReactNode}){
 const {isAuthenticated,user}=useAuth()
 const location=useLocation()
 const audioRef=useRef<HTMLAudioElement>(null)
 const [queue,setQueue]=useState<LibraryItem[]>([])
 const [current,setCurrent]=useState<LibraryItem|null>(null)
 const [source,setSource]=useState('')
 const [playing,setPlaying]=useState(false)
 const [loading,setLoading]=useState(false)
 const [error,setError]=useState('')
 const [duration,setDuration]=useState(0)
 const [position,setPosition]=useState(0)
 const [rate,setRate]=useState(1)
 const [autoplay,setAutoplayValue]=useState(()=>safeSaved(OPTIONS_KEY,true))
 const [repeat,setRepeatValue]=useState(()=>safeSaved(LOOP_KEY,false))
 const currentRef=useRef<LibraryItem|null>(null)
 const queueRef=useRef<LibraryItem[]>([])
 const requestRef=useRef(0)
 const pendingAutoRef=useRef(false)
 const pendingIdRef=useRef<string|null>(null)
 const autoplayRef=useRef(autoplay)
 const repeatRef=useRef(repeat)
 const playRef=useRef<(id:string,auto?:boolean,force?:boolean)=>Promise<void>>(async()=>{})
 const visible=isAuthenticated&&(location.pathname.startsWith('/app')||location.pathname.startsWith('/conta'))
 useEffect(()=>{currentRef.current=current},[current])
 useEffect(()=>{queueRef.current=queue},[queue])
 useEffect(()=>{autoplayRef.current=autoplay},[autoplay])
 useEffect(()=>{repeatRef.current=repeat},[repeat])
 const refresh=useCallback(async()=>{
  if(!isAuthenticated)return
  const items=await academyLibraryApi.mine()
  const owned=items.filter(row=>row.format==='audiobook')
  setQueue(owned);queueRef.current=owned
  const selected=currentRef.current
  if(selected&&!owned.some(row=>row.id===selected.id)){
   // A revoked audiobook may still have a cached media ticket: stop it.
   requestRef.current++;audioRef.current?.pause();setCurrent(null);currentRef.current=null
   setSource('');setError('Este conteúdo não está mais liberado para sua conta.')
  }
 },[isAuthenticated])
 useEffect(()=>{
  if(!isAuthenticated){
   requestRef.current++
   audioRef.current?.pause()
   setQueue([]);queueRef.current=[];setCurrent(null);currentRef.current=null
   setSource('');setPlaying(false);setError('')
   return
  }
  let alive=true
  void refresh().catch(e=>{if(alive)setError(formatProblem(e))})
  return()=>{alive=false}
 },[isAuthenticated,user?.id,refresh])
 useEffect(()=>{
  if(!isAuthenticated)return
  const update=()=>{if(document.visibilityState==='visible')void refresh().catch(()=>undefined)}
  document.addEventListener('visibilitychange',update)
  return()=>document.removeEventListener('visibilitychange',update)
 },[isAuthenticated,refresh])
 const attemptPlay=useCallback(async()=>{
  const el=audioRef.current
  if(!el)return
  try{await el.play();setError('')}
  catch{
   // Mobile browsers may require a fresh user gesture after fetching a ticket.
   setPlaying(false);setError('Toque em reproduzir para continuar. O navegador bloqueou o início automático.')
  }
 },[])
 const playItem=useCallback(async(id:string,auto=true,force=false)=>{
  if(!isAuthenticated)return
  if(pendingIdRef.current===id&&!force){
   if(auto)pendingAutoRef.current=true
   return
  }
  const existing=currentRef.current
  if(!force&&existing?.id===id&&audioRef.current?.src&&audioRef.current.readyState>0){
   if(auto)void attemptPlay()
   return
  }
  const sequence=++requestRef.current
  pendingIdRef.current=id
  pendingAutoRef.current=auto
  setLoading(true);setError('');setPlaying(false);setSource('');setDuration(0);setPosition(0)
  audioRef.current?.pause()
  let owned=queueRef.current.find(row=>row.id===id)
  try{
   if(!owned){
    const rows=await academyLibraryApi.mine()
    if(requestRef.current!==sequence)return
    const authorized=rows.filter(row=>row.format==='audiobook')
    queueRef.current=authorized;setQueue(authorized)
    owned=authorized.find(row=>row.id===id)
   }
   if(!owned)throw new Error('Este audiobook não está liberado para sua conta.')
   currentRef.current=owned;setCurrent(owned)
   const url=await verifiedMediaUrl(owned.id,'audio/mpeg')
   if(requestRef.current!==sequence)return
   setSource(url)
  }catch(e){
   if(requestRef.current===sequence){setError(formatProblem(e));pendingAutoRef.current=false}
  }finally{if(requestRef.current===sequence){pendingIdRef.current=null;setLoading(false)}}
 },[isAuthenticated,attemptPlay])
 playRef.current=playItem
 const shift=useCallback((direction:-1|1,auto=true)=>{
  const rows=queueRef.current,selected=currentRef.current
  if(!rows.length)return
  const idx=rows.findIndex(x=>x.id===selected?.id)
  let target=idx+direction
  if(idx<0)target=0
  if(target<0||target>=rows.length){
   if(!repeatRef.current)return
   target=(target+rows.length)%rows.length
  }
  const next=rows[target]
  if(next)void playRef.current(next.id,auto)
 },[])
 const next=useCallback(()=>shift(1,true),[shift])
 const previous=useCallback(()=>{
  if((audioRef.current?.currentTime||0)>5){if(audioRef.current)audioRef.current.currentTime=0;return}
  shift(-1,true)
 },[shift])
 const toggle=useCallback(()=>{
  const el=audioRef.current
  if(!currentRef.current){
   const first=queueRef.current[0];if(first)void playRef.current(first.id,true)
  }else if(el?.paused){
   if(el.src)void attemptPlay()
   else void playRef.current(currentRef.current.id,true)
  }else el?.pause()
 },[attemptPlay])
 const seek=useCallback((seconds:number)=>{
  const el=audioRef.current
  if(!el||!Number.isFinite(el.duration)||el.duration<=0)return
  el.currentTime=Math.max(0,Math.min(seconds,el.duration))
  setPosition(el.currentTime)
 },[])
 const setSpeed=useCallback((value:number)=>{
  if(![0.75,1,1.25,1.5,2].includes(value))return
  setRate(value)
  if(audioRef.current)audioRef.current.playbackRate=value
 },[])
 const setAutoplay=useCallback((value:boolean)=>{
  setAutoplayValue(value)
  try{window.localStorage.setItem(OPTIONS_KEY,String(value))}catch{}
 },[])
 const setRepeat=useCallback((value:boolean)=>{
  setRepeatValue(value)
  try{window.localStorage.setItem(LOOP_KEY,String(value))}catch{}
 },[])
 const retry=useCallback(()=>{if(currentRef.current)void playRef.current(currentRef.current.id,true,true)},[])
 const loaded=useCallback(()=>{
  const el=audioRef.current,item=currentRef.current
  if(!el||!item)return
  setDuration(Number.isFinite(el.duration)?el.duration:0)
  el.playbackRate=rate
  try{
   const saved=Number(window.localStorage.getItem(POSITION_KEY+item.id)||0)
   if(saved>0&&Number.isFinite(saved)&&Number.isFinite(el.duration)){
    el.currentTime=Math.min(saved,Math.max(0,el.duration-5))
   }
  }catch{}
  setPosition(el.currentTime||0)
  if(pendingAutoRef.current){pendingAutoRef.current=false;void attemptPlay()}
 },[attemptPlay,rate])
 const timeUpdate=useCallback(()=>{
  const el=audioRef.current,item=currentRef.current
  if(!el||!item)return
  const seconds=el.currentTime||0
  setPosition(seconds)
  if(Number.isFinite(el.duration))setDuration(el.duration)
  try{window.localStorage.setItem(POSITION_KEY+item.id,String(Math.floor(seconds)))}catch{}
  if('mediaSession' in navigator&&typeof navigator.mediaSession.setPositionState==='function'&&Number.isFinite(el.duration)&&el.duration>0){
   try{navigator.mediaSession.setPositionState({duration:el.duration,playbackRate:el.playbackRate,position:Math.min(seconds,el.duration)})}catch{}
  }
 },[])
 const ended=useCallback(()=>{
  const item=currentRef.current
  if(item){try{window.localStorage.removeItem(POSITION_KEY+item.id)}catch{}}
  setPlaying(false);setPosition(0)
  if(autoplayRef.current)shift(1,true)
 },[shift])
 useEffect(()=>{
  if(!('mediaSession' in navigator)||!current)return
  const session=navigator.mediaSession
  session.metadata=new MediaMetadata({
   title:current.title,artist:'Academia Sagamente',
   album:'SAGA NEGRA · Release '+current.release_code,
   ...(current.cover_url?{artwork:[{src:new URL(current.cover_url,window.location.origin).toString(),sizes:'512x512'}]}:{})
  })
  const handlers:Record<string,MediaSessionActionHandler>={
   play:()=>{void attemptPlay()},pause:()=>audioRef.current?.pause(),
   nexttrack:()=>shift(1,true),previoustrack:()=>previous(),
   seekbackward:details=>{const el=audioRef.current;if(el)seek(el.currentTime-(details.seekOffset||15))},
   seekforward:details=>{const el=audioRef.current;if(el)seek(el.currentTime+(details.seekOffset||15))},
   seekto:details=>{if(typeof details.seekTime==='number')seek(details.seekTime)}
  }
  for(const [action,handler] of Object.entries(handlers)){
   try{session.setActionHandler(action as MediaSessionAction,handler)}catch{}
  }
  return()=>{for(const name of Object.keys(handlers)){try{session.setActionHandler(name as MediaSessionAction,null)}catch{}}}
 },[current,attemptPlay,previous,seek,shift])
 useEffect(()=>{
  if('mediaSession' in navigator)navigator.mediaSession.playbackState=playing?'playing':'paused'
 },[playing])
 const value:AudioContextValue={
  audioRef,current,queue,playing,loading,error,duration,position,rate,autoplay,repeat,
  playItem,toggle,next,previous,seek,setSpeed,setAutoplay,setRepeat,retry,refresh
 }
 return <AudioContext.Provider value={value}>
  {children}
  <audio ref={audioRef} src={source||undefined} preload="auto" playsInline
   aria-label="Reprodutor permanente de audiobooks da Academia Sagamente"
   onLoadedMetadata={loaded} onTimeUpdate={timeUpdate} onPlay={()=>setPlaying(true)}
   onPause={()=>setPlaying(false)} onEnded={ended}
   onError={()=>{if(source)setError('Não foi possível continuar o áudio. Toque em tentar novamente para renovar o acesso.')}}/>
  {visible&&current&&<AcademyAudioDock/>}
 </AudioContext.Provider>
}
