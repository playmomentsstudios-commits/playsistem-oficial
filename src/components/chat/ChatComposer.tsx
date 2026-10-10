import { useEffect, useRef, useState } from 'react'
import { Button } from '../ui/Button'
import { formatFileSize, previewKind, validateAttachment } from '../../lib/attachments'
import { useAudioRecorder } from './useAudioRecorder'
import { portalApi } from '../../api/portal'
import { supabase } from '../../lib/supabase'

interface Props {
  disabled: boolean
  onBusy: (busy: boolean) => void
  onSend: (text: string, file: File | null, id: string) => Promise<void>
  compact?: boolean
  customerId?: string
  staff?: boolean
}
export function ChatComposer({ disabled, onBusy, onSend, compact = false,customerId,staff = false }: Props) {
  const [text, setText] = useState('')
  const [file, setFile] = useState<File | null>(null)
  const [queue,setQueue]=useState<File[]>([])
  const [selectedPreview,setSelectedPreview]=useState(0)
  const [queuePreviews,setQueuePreviews]=useState<string[]>([])
  const [previewFailed,setPreviewFailed]=useState(false)
  const [preview, setPreview] = useState('')
  const [sending, setSending] = useState(false)
  const [error, setError] = useState('')
  const [toolsOpen,setToolsOpen]=useState(false)
  const [projectFiles,setProjectFiles]=useState<any[]>([])
  const [pickerOpen,setPickerOpen]=useState(false)
  const [pickerBusy,setPickerBusy]=useState(false)
  const [pickerSearch,setPickerSearch]=useState('')
  const textarea=useRef<HTMLTextAreaElement>(null)
  const input = useRef<HTMLInputElement>(null)
  const photos = useRef<HTMLInputElement>(null)
  const camera = useRef<HTMLInputElement>(null)
  const pendingId = useRef<string | null>(null)
  const sendingRef = useRef(false)
  const mounted = useRef(true)
  function choose(next: File | null) {
    if (next) {
      const invalid = validateAttachment(next)
      if (invalid) { setError(invalid); return }
    }
    setQueue(next?[next]:[])
    setSelectedPreview(0)
    setPreviewFailed(false)
    setFile(next)
    setError('')
    pendingId.current = null
  }
  function chooseImages(files:FileList|null){
    const selected=Array.from(files||[])
    if(selected.length<2){choose(selected[0]||null);return}
    if(selected.some(item=>previewKind(item.type)!=='image')){setError('Para selecionar vários arquivos de uma vez, escolha somente imagens.');return}
    const invalid=selected.map(validateAttachment).find(Boolean)
    if(invalid){setError(invalid);return}
    setQueue(selected);setFile(selected[0]);setSelectedPreview(0);setPreviewFailed(false);setError('');pendingId.current=null
  }
  useEffect(()=>{
    const urls=queue.map(item=>URL.createObjectURL(item));setQueuePreviews(urls)
    return()=>urls.forEach(url=>URL.revokeObjectURL(url))
  },[queue])
  const isImage=!!file&&previewKind(file.type)==='image'
  const audio = useAudioRecorder(choose)
  const busy = sending || audio.recording || audio.requesting
  useEffect(() => { onBusy(busy); return () => onBusy(false) }, [busy, onBusy])
  useEffect(() => { mounted.current = true; return () => { mounted.current = false } }, [])
  useEffect(() => {
    if (!file) { setPreview(''); return }
    const url = URL.createObjectURL(file)
    setPreview(url)
    return () => URL.revokeObjectURL(url)
  }, [file])

  async function openProjectPicker(){
    if(!customerId)return
    setPickerBusy(true);setError('');setPickerOpen(true);setToolsOpen(false)
    try{
      const [files,projects,linked]=await Promise.all([
        portalApi.files(),
        supabase.from('projects').select('id,customer_id,project_type').eq('customer_id',customerId),
        supabase.from('project_customer_access').select('project_id').eq('customer_id',customerId),
      ])
      if(projects.error)throw projects.error
      if(linked.error)throw linked.error
      const permitted=new Set([...(projects.data||[]).map(item=>item.id),...(linked.data||[]).map(item=>item.project_id)])
      setProjectFiles(files.filter((item:any)=>permitted.has(item.project_id)&&item.project?.project_type!=='internal'&&item.storage_provider==='google_drive'))

    }catch{setError('Não foi possível consultar os arquivos do projeto.')}
    finally{setPickerBusy(false)}
  }
  async function selectProjectFile(item:any){
    setPickerBusy(true);setError('')
    try{
      const url=await portalApi.driveFileBlobUrl(item.id)
      try{
        const response=await fetch(url)
        const blob=await response.blob()
        const selectedFile=new File([blob],item.name,{type:item.mime_type||'application/octet-stream'})
        const invalid=validateAttachment(selectedFile)
        if(invalid)throw new Error(invalid)
        choose(selectedFile);setPickerOpen(false);setToolsOpen(false)
      }finally{URL.revokeObjectURL(url)}
    }catch(cause){setError(cause instanceof Error?cause.message:'Não foi possível selecionar o arquivo.')}
    finally{setPickerBusy(false)}
  }
  function resizeTextarea(){
    const element=textarea.current
    if(!element)return
    element.style.height='auto'
    element.style.height=Math.min(element.scrollHeight,112)+'px'
  }
  function keyDown(event:React.KeyboardEvent<HTMLTextAreaElement>){
    if(!compact||event.key!=='Enter'||event.shiftKey||event.nativeEvent.isComposing)return
    event.preventDefault()
    event.currentTarget.form?.requestSubmit()
  }
  async function submit(event: React.FormEvent) {
    event.preventDefault()
    if (disabled || busy || sendingRef.current || (!text.trim() && !file)) return
    sendingRef.current = true
    setSending(true)
    setError('')
    pendingId.current ??= crypto.randomUUID()
    try {
      // Keep the existing one-file message API. Successful files leave the queue;
      // a failed send retains its message ID and the remaining selection for retry.
      const remaining=queue.length?[...queue]:[file]
      while(remaining.length){
        const next=remaining[0]
        await onSend(text.trim(),next,pendingId.current!)
        remaining.shift();pendingId.current=null
        if(mounted.current){setQueue(remaining.filter((item):item is File=>!!item));setFile(remaining[0]||null);setSelectedPreview(0)}
        if(remaining.length)pendingId.current=crypto.randomUUID()
      }
      if (mounted.current) { setText(''); setFile(null); setQueue([]); pendingId.current = null; if(textarea.current)textarea.current.style.height='auto' }
    } catch (cause) {
      if (mounted.current) setError(`Envio não confirmado. Seu texto e arquivo foram mantidos. ${cause instanceof Error ? cause.message : 'Tente novamente.'}`)
    } finally {
      sendingRef.current = false
      if (mounted.current) setSending(false)
    }
  }
  return <form onSubmit={submit} className={compact?'p-2.5 space-y-2 max-h-[min(55dvh,440px)] overflow-y-auto overscroll-contain':'p-3 border-t border-white/10 space-y-3'}>
    <input ref={input} type="file" className="hidden" aria-label="Selecionar arquivo original" disabled={disabled || busy} onChange={event => { choose(event.target.files?.[0] || null); event.target.value = '' }} />
    <input ref={photos} multiple type="file" accept="image/*,video/*" className="hidden" aria-label="Selecionar foto ou vídeo" disabled={disabled || busy} onChange={event => { chooseImages(event.target.files); event.target.value = '' }} />
    <input ref={camera} type="file" accept="image/*" capture="environment" className="hidden" aria-label="Abrir câmera" disabled={disabled || busy} onChange={event => { choose(event.target.files?.[0] || null); event.target.value = '' }} />
    <div className={(isImage?'hidden ':compact&&!toolsOpen?'hidden ':'flex ')+'flex-wrap gap-1.5'+(compact?' px-1 pt-1':'')}>
      <button type="button" className="w-10 h-10 rounded-full bg-white/[0.06] hover:bg-white/[0.1] flex items-center justify-center text-gray-300" disabled={disabled || busy} onClick={() => input.current?.click()} title="Anexar arquivo" aria-label="Anexar arquivo">
        <svg width="19" height="19" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M21.4 11.6 12 21a6 6 0 0 1-8.5-8.5l10-10a4 4 0 0 1 5.7 5.7l-10 10a2 2 0 1 1-2.8-2.8l9.2-9.2"/></svg>
      </button>
      <button type="button" className="w-10 h-10 rounded-full bg-white/[0.06] hover:bg-white/[0.1] flex items-center justify-center text-gray-300" disabled={disabled || busy} onClick={() => photos.current?.click()} title="Fotos e vídeos" aria-label="Fotos e vídeos">
        <svg width="19" height="19" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="5" width="18" height="14" rx="2"/><circle cx="9" cy="10" r="1.5"/><path d="m5 17 4.5-4.5L13 16l2.5-2.5L19 17"/></svg>
      </button>
      <button type="button" className="w-10 h-10 rounded-full bg-white/[0.06] hover:bg-white/[0.1] flex items-center justify-center text-gray-300" disabled={disabled || busy} onClick={() => camera.current?.click()} title="Abrir câmera" aria-label="Abrir câmera">
        <svg width="19" height="19" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M4 7h3l1.5-2h7L17 7h3v12H4z"/><circle cx="12" cy="13" r="3.5"/></svg>
      </button>
      {staff&&customerId&&<button type="button" className="w-10 h-10 rounded-full bg-white/[0.06] hover:bg-white/[0.1] text-gray-200 flex items-center justify-center" title="Arquivos do projeto" aria-label="Arquivos do projeto" disabled={disabled||busy} onClick={()=>void openProjectPicker()}><svg width="19" height="19" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M3 7V5a2 2 0 0 1 2-2h5l2 3h7a2 2 0 0 1 2 2v2"/><rect x="3" y="10" width="18" height="11" rx="2"/></svg></button>}
      
    </div>
    {pickerOpen&&<div role="dialog" aria-label="Escolher arquivo do projeto" className="rounded-xl border border-white/10 bg-[#1c1c20] p-3 space-y-2 max-h-[min(36dvh,310px)] overflow-y-auto overscroll-contain">
      <div className="flex items-center justify-between"><strong className="text-sm">Arquivos do projeto</strong><button type="button" onClick={()=>setPickerOpen(false)} aria-label="Fechar arquivos">✕</button></div>
      <input value={pickerSearch} onChange={event=>setPickerSearch(event.target.value)} placeholder="Buscar arquivo…" aria-label="Buscar arquivo do projeto" className="w-full min-h-10 rounded-lg bg-black/30 px-3 text-sm"/>
      <div className="max-h-[min(20dvh,160px)] overflow-y-auto space-y-1">{pickerBusy?<p className="text-xs">Preparando arquivo…</p>:projectFiles.filter(item=>item.name?.toLowerCase().includes(pickerSearch.toLowerCase())).map(item=><button key={item.id} type="button" onClick={()=>void selectProjectFile(item)} className="w-full text-left rounded-lg p-2 hover:bg-white/10 text-xs truncate">📎 {item.name}</button>)}</div>
      {!pickerBusy&&!projectFiles.length&&<p className="text-xs text-gray-400">Nenhum arquivo do projeto encontrado. Verifique se o cliente está vinculado ao projeto.</p>}
    </div>}
    {audio.recording && <div className="flex flex-wrap items-center gap-2 rounded-xl bg-red-950/40 p-3">
      <p role="status" className="text-sm">Gravando {Math.floor(audio.seconds / 60)}:{String(audio.seconds % 60).padStart(2, '0')} / 5:00</p>
      <Button type="button" className="min-h-11" onClick={() => audio.stop()}>Parar e ouvir</Button>
      <Button type="button" variant="ghost" className="min-h-11" onClick={() => audio.stop(true)}>Cancelar gravação</Button>
    </div>}
    {file && (isImage?<div className="space-y-3">
      <div className="w-full h-[min(58dvh,540px)] flex items-center justify-center">
        {previewFailed?<p role="alert" className="text-sm text-gray-400">Não foi possível exibir a prévia. Você pode enviar o original ou cancelar.</p>:<img alt="Prévia da imagem selecionada" src={queuePreviews[selectedPreview]||preview} className="h-full w-full object-contain" onError={()=>setPreviewFailed(true)}/>}
      </div>
      {queue.length>1&&<div className="flex justify-start gap-2 overflow-x-auto py-1" aria-label="Imagens selecionadas">{queue.map((item,index)=><button key={index} type="button" aria-label={'Selecionar imagem '+(index+1)} aria-pressed={index===selectedPreview} disabled={sending} onClick={()=>{setSelectedPreview(index);setPreviewFailed(false)}} className={'shrink-0 w-14 h-14 rounded-lg overflow-hidden '+(index===selectedPreview?'ring-2 ring-orange-400':'opacity-60')}><img alt="" src={queuePreviews[index]} className="w-full h-full object-cover"/></button>)}</div>}
    </div>:<div className="p-3 rounded-xl bg-white/5 space-y-2">
      <p className="text-sm break-words" style={{ overflowWrap: 'anywhere' }}>{file.name} · {formatFileSize(file.size)}</p>
      {preview && previewKind(file.type) === 'audio' && <audio aria-label="Prévia do áudio" controls src={preview} className="w-full max-w-full" />}
      <button type="button" className="min-h-11 text-sm underline" disabled={sending} onClick={() => choose(null)}>Remover arquivo</button>
    </div>)}
    {(error || audio.error) && <p role="alert" className="text-sm text-red-300">{error || audio.error}</p>}
    {sending && <p role="status" className="text-sm">{file ? 'Enviando arquivo e mensagem…' : 'Enviando mensagem…'}</p>}
    <div className="flex items-end gap-2">
      {compact&&!isImage&&<button type="button" onClick={()=>setToolsOpen(value=>!value)} className="w-11 h-11 shrink-0 rounded-full bg-white/[0.06] hover:bg-white/[0.1] text-xl text-gray-300" aria-label="Mais opções" title="Mais opções">＋</button>}
      <textarea ref={textarea} aria-label={isImage?'Legenda opcional':'Mensagem'} placeholder={isImage?'Adicione uma legenda…':file ? 'Adicione uma mensagem…' : 'Mensagem'} value={text} maxLength={5000} rows={compact?1:2} disabled={disabled || busy} onKeyDown={keyDown} onChange={event => { setText(event.target.value); pendingId.current = null; resizeTextarea() }} className={"flex-1 min-w-0 rounded-[22px] text-sm bg-white/[.065] border border-white/[.07] resize-none outline-none focus:border-white/15 "+(compact?"min-h-11 max-h-28 px-4 py-[11px] leading-5":"p-3")} />
      {isImage&&<button type="button" disabled={sending} onClick={()=>choose(null)} className="min-h-11 px-2 text-xs text-gray-400">Cancelar</button>}
      {!audio.recording&&<button type="button" className="w-11 h-11 shrink-0 rounded-full bg-[#A65A2A]/20 border border-[#A65A2A]/40 text-[#F28C38] flex items-center justify-center disabled:opacity-35" disabled={disabled || busy || !!file} onClick={audio.start} title="Gravar áudio" aria-label="Gravar áudio"><svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round"><rect x="9" y="3" width="6" height="11" rx="3"/><path d="M5 11a7 7 0 0 0 14 0M12 18v3M9 21h6"/></svg></button>}
      <button type="submit" aria-label="Enviar mensagem" title="Enviar mensagem" className="w-11 h-11 shrink-0 rounded-full bg-[#A65A2A] text-white flex items-center justify-center disabled:opacity-35 transition-opacity" disabled={disabled || busy || (!text.trim() && !file)}>
        {sending?<span className="w-4 h-4 rounded-full border-2 border-white border-t-transparent animate-spin"/>:<svg width="19" height="19" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="m22 2-7 20-4-9-9-4Z"/><path d="M22 2 11 13"/></svg>}
      </button>
    </div>
    {!compact&&!isImage&&<p className="text-xs text-gray-400">Um arquivo por envio, até 50 MB. Enviado sem reduzir ou converter o original.</p>}
  </form>
}
