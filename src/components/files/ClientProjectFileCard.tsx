import { useEffect,useRef,useState } from 'react'
import { portalApi } from '../../api/portal'

type Props = {
  file:any
  onOpen:(file:any)=>void
  compact?:boolean
}

function kind(file:any){
  const type=String(file.mime_type||file.file_type||'').toLowerCase()
  if(type.startsWith('image/'))return {label:'Imagem',symbol:'▧',previewable:true}
  if(type.includes('pdf'))return {label:'PDF',symbol:'▤',previewable:true}
  if(type.startsWith('video/'))return {label:'Vídeo',symbol:'▶',previewable:false}
  if(type.startsWith('audio/'))return {label:'Áudio',symbol:'♫',previewable:false}
  return {label:'Arquivo',symbol:'◇',previewable:false}
}

/**
 * Secure, on-demand artwork preview. Never exposes Drive URLs or downloads the
 * original image (which may be tens of megabytes) merely to draw a card.
 */
export function ClientProjectFileCard({file,onOpen,compact=false}:Props){
  const buttonRef=useRef<HTMLButtonElement>(null)
  const [thumbnail,setThumbnail]=useState<string|null>(null)
  const [state,setState]=useState<'waiting'|'loading'|'ready'|'unavailable'>('waiting')
  const type=kind(file)
  const canFetch=Boolean(file?.client_visible&&type.previewable
    &&file.storage_provider==='google_drive'&&file.drive_file_id)

  useEffect(()=>{
    let disposed=false
    let objectUrl:string|null=null
    let started=false
    let observer:IntersectionObserver|null=null
    setThumbnail(null)
    setState('waiting')
    if(!canFetch)return

    const start=()=>{
      if(started||disposed)return
      started=true
      setState('loading')
      void portalApi.driveFileThumbnailBlobUrl(file.id).then(url=>{
        if(disposed){URL.revokeObjectURL(url);return}
        objectUrl=url
        setThumbnail(url)
        setState('ready')
      }).catch(()=>{
        if(!disposed)setState('unavailable')
      })
    }

    const node=buttonRef.current
    if(node&&typeof IntersectionObserver!=='undefined'){
      observer=new IntersectionObserver(entries=>{
        if(entries.some(entry=>entry.isIntersecting)){
          observer?.disconnect()
          start()
        }
      },{rootMargin:'180px 0px',threshold:0.01})
      observer.observe(node)
    }else start()

    return ()=>{
      disposed=true
      observer?.disconnect()
      if(objectUrl)URL.revokeObjectURL(objectUrl)
    }
  },[file.id,file.drive_file_id,canFetch])

  return <button type="button" ref={buttonRef} onClick={()=>onOpen(file)}
    aria-label={'Visualizar '+file.name}
    className={'group min-w-0 w-full overflow-hidden rounded-xl border border-white/10 bg-[#161719] text-left hover:border-[#A65A2A]/60 hover:bg-[#1b1a19] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#DFA269] transition-colors '+(compact?'':'shadow-sm')}>
    <div className={'relative w-full bg-[#0b0c0e] overflow-hidden flex items-center justify-center '+(compact?'h-28 sm:h-32':'h-36 sm:h-44')}>
      {thumbnail ? <img src={thumbnail} alt={'Prévia de '+file.name} loading="lazy"
        className="w-full h-full object-contain group-hover:scale-[1.025] transition-transform duration-300"
        onError={()=>{setState('unavailable');setThumbnail(null)}}/>
        : <div className="flex flex-col items-center justify-center gap-2 text-[#797D81]">
            <span aria-hidden="true" className="text-4xl">{type.symbol}</span>
            {state==='loading'&&<span className="text-[11px] animate-pulse">Carregando prévia...</span>}
            {state==='unavailable'&&<span className="text-[11px]">Prévia indisponível</span>}
            {!canFetch&&<span className="text-[11px]">{type.label}</span>}
          </div>}
      <span className="absolute left-2 top-2 rounded-md bg-black/75 px-2 py-1 text-[10px] font-semibold text-white">{type.label}</span>
      <span className="absolute bottom-2 right-2 rounded-lg bg-black/75 px-2.5 py-1.5 text-[10px] text-white opacity-95 group-hover:bg-[#A65A2A]">Ampliar ↗</span>
    </div>
    <div className={'min-w-0 '+(compact?'px-2.5 py-2':'p-3')}>
      <p className="text-xs font-medium text-gray-100 line-clamp-2 break-words" title={file.name}>{file.name}</p>
      {!compact&&<p className="text-[10px] text-gray-500 mt-1">{thumbnail?'Prévia carregada · ':''}Visualizar e baixar</p>}
    </div>
  </button>
}
