import { useEffect, useRef, useState } from 'react'
import { conversationsApi, type SupportMessage } from '../../api/conversations'
import { formatFileSize, previewKind } from '../../lib/attachments'

export function AttachmentView({ message }: { message: SupportMessage }) {
  const [url, setUrl] = useState('')
  const [error, setError] = useState('')
  const [retry, setRetry] = useState(0)
  const [downloading, setDownloading] = useState(false)
  const [playing,setPlaying] = useState(false)
  const [duration,setDuration] = useState(0)
  const [current,setCurrent] = useState(0)
  const audioRef=useRef<HTMLAudioElement>(null)
  const probingDuration=useRef(false)
  const path = message.attachment_path
  const kind = previewKind(message.attachment_type || '')
  useEffect(() => {
    if (!path || kind === 'file') return
    let active = true
    setUrl('')
    setError('')
    setDuration(0);setCurrent(0);probingDuration.current=false
    conversationsApi.attachmentUrl(path).then(async value => {
      if (kind !== 'audio') { if(active)setUrl(value); return }
      const response=await fetch(value)
      if(!response.ok)throw new Error('Falha ao carregar áudio')
      const blob=await response.blob()
      if(active)setUrl(URL.createObjectURL(blob))
    })
      .catch(() => { if (active) setError('Não foi possível abrir a prévia.') })
    return () => { active = false }
  }, [path, kind, retry])

  useEffect(()=>()=>{if(kind==='audio'&&url.startsWith('blob:'))URL.revokeObjectURL(url)},[kind,url])
  const clock=(value:number)=>Number.isFinite(value)&&value>=0?`${Math.floor(value/60)}:${String(Math.floor(value%60)).padStart(2,'0')}`:'0:00'
  function syncDuration(el:HTMLAudioElement){
    const length=el.duration
    if(Number.isFinite(length)&&length>0){setDuration(length);return}
    if(el.seekable.length){
      const end=el.seekable.end(el.seekable.length-1)
      if(Number.isFinite(end)&&end>0){setDuration(end);return}
    }
    // WebM recordings may report Infinity until the decoder seeks near the end.
    if(!probingDuration.current&&el.readyState>=1){
      probingDuration.current=true
      try{el.currentTime=1e10}catch{probingDuration.current=false}
    }
  }
  function handleSeeked(el:HTMLAudioElement){
    if(probingDuration.current){
      const measured=el.currentTime
      if(Number.isFinite(measured)&&measured>0)setDuration(measured)
      probingDuration.current=false
      el.currentTime=0
    }
  }
  async function download() {
    if (!path || downloading) return
    setDownloading(true)
    setError('')
    try {
      // Request a fresh download URL on each click, preserving the original filename.
      const href = await conversationsApi.attachmentUrl(path, message.attachment_name)
      const link = document.createElement('a')
      link.href = href
      link.download = message.attachment_name || 'arquivo'
      link.rel = 'noopener noreferrer'
      document.body.append(link)
      link.click()
      link.remove()
    } catch { setError('Não foi possível baixar o arquivo. Tente novamente.') }
    finally { setDownloading(false) }
  }
  if (!path) return null
  if (kind === 'audio') return <div className="min-w-[210px] max-w-[280px] py-1" aria-label="Mensagem de voz">
    <div className="flex items-center gap-2.5">
      <button type="button" disabled={!url||!!error} aria-label={playing?'Pausar áudio':'Reproduzir áudio'} onClick={()=>{const el=audioRef.current;if(!el)return;if(el.paused){void el.play().catch(()=>setError('Não foi possível reproduzir este áudio.'))}else el.pause()}} className="w-10 h-10 shrink-0 rounded-full bg-white/20 flex items-center justify-center disabled:opacity-40">{playing?'❚❚':'▶'}</button>
      <div className="min-w-0 flex-1">
        <input aria-label="Posição do áudio" type="range" min="0" max={duration||1} step="0.1" value={Math.min(current,duration||1)} disabled={!url} onChange={event=>{if(audioRef.current)audioRef.current.currentTime=Number(event.target.value)}} className="w-full accent-orange-200"/>
        <span className="text-[10px] opacity-80">{clock(current)} / {clock(duration)}</span>
      </div>
    </div>
    {url&&<audio ref={audioRef} src={url} preload="metadata" onLoadedMetadata={event=>syncDuration(event.currentTarget)} onDurationChange={event=>syncDuration(event.currentTarget)} onSeeked={event=>handleSeeked(event.currentTarget)} onTimeUpdate={event=>{if(!probingDuration.current)setCurrent(event.currentTarget.currentTime)}} onPlay={()=>setPlaying(true)} onPause={()=>setPlaying(false)} onEnded={()=>setPlaying(false)} onError={()=>setError('Formato de áudio indisponível neste navegador.')} />}
    {!url&&!error&&<span className="text-xs opacity-70">Carregando áudio…</span>}
    {error&&<button type="button" onClick={()=>{setError('');setRetry(value=>value+1)}} className="block mt-1 text-xs underline">Tentar novamente</button>}
  </div>
  return <div className="space-y-2 mb-2 min-w-0">
    <p className="font-semibold break-words" style={{ overflowWrap: 'anywhere' }}>{message.attachment_name}</p>
    <p className="text-xs opacity-75">{formatFileSize(message.attachment_size || 0)} · Arquivo original</p>
    {url && kind === 'image' && <img src={url} alt={message.attachment_name || 'Imagem enviada'} loading="lazy" className="max-h-48 md:max-h-56 max-w-full rounded-xl object-contain bg-black/20" onError={() => setError('Prévia indisponível ou expirada. Baixe o original ou tente novamente.')} />}
    {url && kind === 'video' && <video aria-label={`Vídeo: ${message.attachment_name}`} controls playsInline preload="metadata" src={url} className="max-h-48 md:max-h-56 max-w-full rounded-xl bg-black/20" onError={() => setError('Vídeo indisponível neste navegador ou link expirado. Baixe o original ou tente novamente.')} />}
    {error && <p role="alert" className="text-xs">{error} {kind !== 'file' && <button type="button" className="underline min-h-11" onClick={() => setRetry(value => value + 1)}>Reabrir prévia</button>}</p>}
    <button type="button" onClick={download} disabled={downloading} className="min-h-9 px-2.5 rounded-lg bg-white/[.08] text-xs font-semibold disabled:opacity-50">{downloading ? 'Preparando download…' : 'Baixar original'}</button>
  </div>
}
