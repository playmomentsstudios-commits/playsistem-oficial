import { useEffect, useRef, useState } from 'react'
import { Button } from '../ui/Button'
import { formatFileSize, previewKind, validateAttachment } from '../../lib/attachments'
import { useAudioRecorder } from './useAudioRecorder'

interface Props {
  disabled: boolean
  onBusy: (busy: boolean) => void
  onSend: (text: string, file: File | null, id: string) => Promise<void>
}
export function ChatComposer({ disabled, onBusy, onSend }: Props) {
  const [text, setText] = useState('')
  const [file, setFile] = useState<File | null>(null)
  const [preview, setPreview] = useState('')
  const [sending, setSending] = useState(false)
  const [error, setError] = useState('')
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
    setFile(next)
    setError('')
    pendingId.current = null
  }
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

  async function submit(event: React.FormEvent) {
    event.preventDefault()
    if (disabled || busy || sendingRef.current || (!text.trim() && !file)) return
    sendingRef.current = true
    setSending(true)
    setError('')
    pendingId.current ??= crypto.randomUUID()
    try {
      await onSend(text.trim(), file, pendingId.current)
      if (mounted.current) { setText(''); setFile(null); pendingId.current = null }
    } catch (cause) {
      if (mounted.current) setError(`Envio não confirmado. Seu texto e arquivo foram mantidos. ${cause instanceof Error ? cause.message : 'Tente novamente.'}`)
    } finally {
      sendingRef.current = false
      if (mounted.current) setSending(false)
    }
  }
  return <form onSubmit={submit} className="p-3 border-t border-white/10 space-y-3">
    <input ref={input} type="file" className="hidden" aria-label="Selecionar arquivo original" disabled={disabled || busy} onChange={event => { choose(event.target.files?.[0] || null); event.target.value = '' }} />
    <input ref={photos} type="file" accept="image/*,video/*" className="hidden" aria-label="Selecionar foto ou vídeo" disabled={disabled || busy} onChange={event => { choose(event.target.files?.[0] || null); event.target.value = '' }} />
    <input ref={camera} type="file" accept="image/*" capture="environment" className="hidden" aria-label="Abrir câmera" disabled={disabled || busy} onChange={event => { choose(event.target.files?.[0] || null); event.target.value = '' }} />
    <div className="flex flex-wrap gap-1.5">
      <button type="button" className="w-10 h-10 rounded-full bg-white/[0.06] hover:bg-white/[0.1] flex items-center justify-center text-gray-300" disabled={disabled || busy} onClick={() => input.current?.click()} title="Anexar arquivo" aria-label="Anexar arquivo">
        <svg width="19" height="19" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M21.4 11.6 12 21a6 6 0 0 1-8.5-8.5l10-10a4 4 0 0 1 5.7 5.7l-10 10a2 2 0 1 1-2.8-2.8l9.2-9.2"/></svg>
      </button>
      <button type="button" className="w-10 h-10 rounded-full bg-white/[0.06] hover:bg-white/[0.1] flex items-center justify-center text-gray-300" disabled={disabled || busy} onClick={() => photos.current?.click()} title="Fotos e vídeos" aria-label="Fotos e vídeos">
        <svg width="19" height="19" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="5" width="18" height="14" rx="2"/><circle cx="9" cy="10" r="1.5"/><path d="m5 17 4.5-4.5L13 16l2.5-2.5L19 17"/></svg>
      </button>
      <button type="button" className="w-10 h-10 rounded-full bg-white/[0.06] hover:bg-white/[0.1] flex items-center justify-center text-gray-300" disabled={disabled || busy} onClick={() => camera.current?.click()} title="Abrir câmera" aria-label="Abrir câmera">
        <svg width="19" height="19" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M4 7h3l1.5-2h7L17 7h3v12H4z"/><circle cx="12" cy="13" r="3.5"/></svg>
      </button>
      {!audio.recording && <button type="button" className="w-10 h-10 rounded-full bg-white/[0.06] hover:bg-white/[0.1] flex items-center justify-center text-gray-300" disabled={disabled || busy || !!file} onClick={audio.start} title="Gravar áudio" aria-label="Gravar áudio">
        <svg width="19" height="19" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><rect x="9" y="3" width="6" height="11" rx="3"/><path d="M5 11a7 7 0 0 0 14 0M12 18v3M9 21h6"/></svg>
      </button>}
    </div>
    {audio.recording && <div className="flex flex-wrap items-center gap-2 rounded-xl bg-red-950/40 p-3">
      <p role="status" className="text-sm">Gravando {Math.floor(audio.seconds / 60)}:{String(audio.seconds % 60).padStart(2, '0')} / 5:00</p>
      <Button type="button" className="min-h-11" onClick={() => audio.stop()}>Parar e ouvir</Button>
      <Button type="button" variant="ghost" className="min-h-11" onClick={() => audio.stop(true)}>Cancelar gravação</Button>
    </div>}
    {file && <div className="p-3 rounded-xl bg-white/5 space-y-2">
      <p className="text-sm break-words" style={{ overflowWrap: 'anywhere' }}>{file.name} · {formatFileSize(file.size)}</p>
      {preview && previewKind(file.type) === 'audio' && <audio aria-label="Prévia do áudio" controls src={preview} className="w-full max-w-full" />}
      {preview && previewKind(file.type) === 'image' && <img alt="Prévia do arquivo selecionado" src={preview} className="max-h-32 max-w-full rounded-lg" />}
      <button type="button" className="min-h-11 text-sm underline" disabled={sending} onClick={() => choose(null)}>Remover arquivo</button>
    </div>}
    {(error || audio.error) && <p role="alert" className="text-sm text-red-300">{error || audio.error}</p>}
    {sending && <p role="status" className="text-sm">{file ? 'Enviando arquivo e mensagem…' : 'Enviando mensagem…'}</p>}
    <div className="flex items-end gap-2">
      <textarea aria-label="Mensagem" placeholder={file ? 'Adicione uma mensagem (opcional)…' : 'Digite sua mensagem…'} value={text} maxLength={5000} rows={2} disabled={disabled || busy} onChange={event => { setText(event.target.value); pendingId.current = null }} className="flex-1 min-w-0 p-3 rounded-xl text-sm bg-white/5 resize-none" />
      <Button type="submit" className="min-h-11" loading={sending} disabled={disabled || busy || (!text.trim() && !file)}>Enviar</Button>
    </div>
    <p className="text-xs text-gray-400">Um arquivo por envio, até 50 MB. Enviado sem reduzir ou converter o original.</p>
  </form>
}
