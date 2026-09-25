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
    <div className="flex flex-wrap gap-2">
      <Button type="button" variant="secondary" className="min-h-11" disabled={disabled || busy} onClick={() => input.current?.click()}>Anexar arquivo</Button>
      <Button type="button" variant="secondary" className="min-h-11" disabled={disabled || busy} onClick={() => photos.current?.click()}>Fotos e vídeos</Button>
      {!audio.recording && <Button type="button" variant="secondary" className="min-h-11" disabled={disabled || busy || !!file} onClick={audio.start}>{audio.requesting ? 'Aguardando microfone…' : 'Gravar áudio'}</Button>}
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
