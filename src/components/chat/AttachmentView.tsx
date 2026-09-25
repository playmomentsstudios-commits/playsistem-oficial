import { useEffect, useState } from 'react'
import { conversationsApi, type SupportMessage } from '../../api/conversations'
import { formatFileSize, previewKind } from '../../lib/attachments'

export function AttachmentView({ message }: { message: SupportMessage }) {
  const [url, setUrl] = useState('')
  const [error, setError] = useState('')
  const [retry, setRetry] = useState(0)
  const [downloading, setDownloading] = useState(false)
  const path = message.attachment_path
  const kind = previewKind(message.attachment_type || '')
  useEffect(() => {
    if (!path || kind === 'file') return
    let active = true
    setUrl('')
    setError('')
    conversationsApi.attachmentUrl(path).then(value => { if (active) setUrl(value) })
      .catch(() => { if (active) setError('Não foi possível abrir a prévia.') })
    return () => { active = false }
  }, [path, kind, retry])

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
  return <div className="space-y-2 mb-2 min-w-0">
    <p className="font-semibold break-words" style={{ overflowWrap: 'anywhere' }}>{message.attachment_name}</p>
    <p className="text-xs opacity-75">{formatFileSize(message.attachment_size || 0)} · Arquivo original</p>
    {url && kind === 'image' && <img src={url} alt={message.attachment_name || 'Imagem enviada'} loading="lazy" className="max-h-64 max-w-full rounded-lg object-contain" onError={() => setError('Prévia indisponível ou expirada. Baixe o original ou tente novamente.')} />}
    {url && kind === 'audio' && <audio aria-label={`Áudio: ${message.attachment_name}`} controls preload="metadata" src={url} className="w-full max-w-full" onError={() => setError('Áudio indisponível neste navegador ou link expirado. Baixe o original ou tente novamente.')} />}
    {url && kind === 'video' && <video aria-label={`Vídeo: ${message.attachment_name}`} controls playsInline preload="metadata" src={url} className="max-h-64 max-w-full rounded-lg" onError={() => setError('Vídeo indisponível neste navegador ou link expirado. Baixe o original ou tente novamente.')} />}
    {error && <p role="alert" className="text-xs">{error} {kind !== 'file' && <button type="button" className="underline min-h-11" onClick={() => setRetry(value => value + 1)}>Reabrir prévia</button>}</p>}
    <button type="button" onClick={download} disabled={downloading} className="min-h-11 underline text-sm disabled:opacity-50">{downloading ? 'Preparando download…' : 'Baixar original'}</button>
  </div>
}
