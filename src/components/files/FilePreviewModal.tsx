import { useEffect, useMemo, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { portalApi } from '../../api/portal'
import {
  MAX_INLINE_PREVIEW_BYTES,
  filePreviewLabel,
  filePreviewType,
  previewSizeLabel,
  safeOriginalUrl,
  type ViewableFile,
} from '../../lib/filePreview'

type Props = {
  file: ViewableFile | null
  onClose: () => void
}

/**
 * A single authenticated, on-demand viewer for private Google Drive and Supabase files.
 * Never embeds private Drive URLs or exposes Drive tokens in an iframe.
 */
export function FilePreviewModal({ file, onClose }: Props) {
  const [previewUrl, setPreviewUrl] = useState<string | null>(null)
  const [pending, setPending] = useState(false)
  const [error, setError] = useState('')
  const [zoom, setZoom] = useState(1)
  const [rotation, setRotation] = useState(0)
  const closeButtonRef = useRef<HTMLButtonElement>(null)

  const type = useMemo(() => file ? filePreviewType(file) : 'unsupported', [file])
  const tooLarge = Boolean(file && Number(file.file_size) > MAX_INLINE_PREVIEW_BYTES)
  const originalUrl = safeOriginalUrl(file?.external_url)
  const hasPrivateFile = Boolean(file && (
    (file.storage_provider === 'google_drive' && file.drive_file_id) || file.storage_path
  ))
  const canPreview = Boolean(file && hasPrivateFile && type !== 'unsupported' && !tooLarge)

  useEffect(() => {
    if (!file) return
    const previousOverflow = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    closeButtonRef.current?.focus()
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        event.preventDefault()
        onClose()
      }
    }
    document.addEventListener('keydown', onKeyDown)
    return () => {
      document.body.style.overflow = previousOverflow
      document.removeEventListener('keydown', onKeyDown)
    }
  }, [file, onClose])

  useEffect(() => {
    let disposed = false
    let objectUrl: string | null = null
    setPreviewUrl(null)
    setError('')
    setZoom(1)
    setRotation(0)
    if (!file || !canPreview) { setPending(false); return }

    const load = async () => {
      setPending(true)
      try {
        if (file.storage_provider === 'google_drive' && file.drive_file_id) {
          // Edge Function validates files.view / project membership / client_visible.
          objectUrl = await portalApi.driveFileBlobUrl(file.id)
        } else if (file.storage_path) {
          // Signed storage access is generated only for the signed-in user.
          const signedUrl = await portalApi.fileUrl(file.storage_path)
          const response = await fetch(signedUrl, { cache: 'no-store' })
          if (!response.ok) throw new Error('Não foi possível carregar a prévia do arquivo.')
          const blob = await response.blob()
          if (blob.size > MAX_INLINE_PREVIEW_BYTES) throw new Error('Arquivo grande demais para uma prévia segura.')
          objectUrl = URL.createObjectURL(blob)
        }
        if (disposed && objectUrl) URL.revokeObjectURL(objectUrl)
        else if (!disposed) setPreviewUrl(objectUrl)
      } catch (cause) {
        if (!disposed) setError(cause instanceof Error ? cause.message : 'Falha ao carregar a prévia.')
      } finally {
        if (!disposed) setPending(false)
      }
    }
    void load()
    return () => {
      disposed = true
      if (objectUrl) URL.revokeObjectURL(objectUrl)
    }
  }, [file?.id, file?.drive_file_id, file?.storage_path, canPreview])

  if (!file) return null

  const download = () => {
    if (!previewUrl) return
    const a = document.createElement('a')
    a.href = previewUrl
    a.download = file.name || 'arquivo'
    document.body.appendChild(a)
    a.click()
    a.remove()
  }

  const fallback = tooLarge
    ? 'Este arquivo é grande demais para carregar diretamente no visualizador. Abra o original no Google Drive para evitar lentidão.'
    : type === 'unsupported'
      ? 'Este formato não possui prévia nativa. Para AI, PSD ou CDR, utilize o arquivo original ou anexe também uma versão em PNG ou PDF.'
      : !hasPrivateFile
        ? 'Este arquivo é um link externo. Abra a origem em uma nova guia.'
        : error || 'Não foi possível gerar a prévia deste arquivo.'

  return createPortal(
    <div className="fixed inset-0 z-[150] bg-[#030403]/95 backdrop-blur-md p-0 sm:p-4 flex items-center justify-center" onMouseDown={e=>{ if(e.target === e.currentTarget) onClose() }}>
      <section role="dialog" aria-modal="true" aria-label={'Visualizar '+file.name} className="w-full h-full sm:h-[min(92vh,850px)] max-w-[1300px] overflow-hidden rounded-none sm:rounded-2xl border border-white/10 bg-[#101112] shadow-2xl flex flex-col">
        <header className="shrink-0 px-3 sm:px-5 py-3 min-h-[70px] flex flex-wrap sm:flex-nowrap items-center justify-between gap-3 border-b border-white/10">
          <div className="flex min-w-0 items-center gap-3">
            <span className="hidden sm:grid h-10 w-10 shrink-0 rounded-xl bg-[#A65A2A]/15 text-[#DFA269] place-items-center" aria-hidden="true">{type === 'image' ? '▧' : type === 'pdf' ? '▤' : type === 'audio' ? '♫' : type === 'video' ? '▶' : '◇'}</span>
            <div className="min-w-0">
              <h2 className="text-sm sm:text-base font-semibold text-white truncate max-w-[68vw] sm:max-w-[55vw]" title={file.name}>{file.name}</h2>
              <p className="text-[11px] text-[#ADB0AC] mt-1">{filePreviewLabel(type)} · {previewSizeLabel(file.file_size)}{file.version_number ? ' · v'+file.version_number : ''}</p>
            </div>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            {previewUrl && <button type="button" onClick={download} className="rounded-lg min-h-10 px-3 bg-[#A65A2A] hover:bg-[#81431E] text-white text-xs font-semibold">↓ Baixar</button>}
            {originalUrl && <a href={originalUrl} target="_blank" rel="noopener noreferrer" className="rounded-lg min-h-10 px-3 inline-flex items-center border border-white/15 text-[#DFA269] hover:bg-white/5 text-xs font-semibold">↗ Abrir original</a>}
            <button type="button" onClick={onClose} ref={closeButtonRef} className="w-10 h-10 rounded-lg bg-white/[0.06] hover:bg-white/10 text-xl text-white" title="Fechar" aria-label="Fechar visualizador">×</button>
          </div>
        </header>

        <div className="flex-1 min-h-0 relative flex flex-col items-center justify-center overflow-hidden" style={{background:'radial-gradient(ellipse at 50% 45%,rgba(46,93,70,.08),transparent 75%),#090B0A'}}>
          {pending ? <div role="status" className="text-center space-y-3 p-8">
            <div className="h-9 w-9 border-2 border-[#A65A2A] border-t-transparent rounded-full animate-spin mx-auto"/>
            <p className="text-sm text-[#DDDDDD]">Preparando prévia protegida...</p>
            <p className="text-xs text-gray-500">Arquivos maiores podem levar alguns instantes.</p>
          </div> : previewUrl && !error && canPreview ? <>
            {type === 'image' && <div className="w-full h-full overflow-auto flex items-center justify-center p-6 sm:p-10">
              <img
                src={previewUrl}
                alt={file.name}
                draggable={false}
                className="max-w-full max-h-full object-contain select-none transition-transform duration-200"
                style={{transform:'rotate('+rotation+'deg) scale('+zoom+')'}}
                onError={()=>setError('O navegador não conseguiu ler esta imagem.')}
              />
            </div>}
            {type === 'pdf' && <iframe title={'Documento PDF: '+file.name} src={previewUrl+'#toolbar=1&navpanes=0'} className="h-full w-full bg-white" onError={()=>setError('O navegador não conseguiu abrir este PDF.')}/>}
            {type === 'audio' && <div className="w-full max-w-xl p-7 sm:p-10 text-center space-y-6">
              <div aria-hidden="true" className="mx-auto grid place-items-center rounded-full w-28 h-28 bg-[#2E5D46]/20 border border-[#2E5D46]/50 text-5xl text-[#DFA269]">♫</div>
              <h3 className="font-semibold text-white text-lg break-words">{file.name}</h3>
              <audio controls autoPlay={false} preload="metadata" className="w-full" src={previewUrl} onError={()=>setError('Este áudio usa um codec não suportado neste navegador.')}>Seu navegador não reproduz áudio.</audio>
            </div>}
            {type === 'video' && <video controls playsInline preload="metadata" className="w-full h-full max-h-full bg-black object-contain" src={previewUrl} onError={()=>setError('Este vídeo usa um formato ou codec não suportado neste navegador.')}>Seu navegador não reproduz vídeo.</video>}
          </> : null}
          {!pending && (!canPreview || error) && <div role={error?'alert':'status'} className="text-center max-w-xl mx-auto p-7 space-y-4">
            <div className="mx-auto rounded-2xl h-16 w-16 bg-white/[0.045] border border-white/10 grid place-items-center text-3xl text-[#DFA269]" aria-hidden="true">◇</div>
            <h3 className="font-semibold text-white">Prévia indisponível</h3>
            <p className="text-sm text-[#B5B5BD] leading-6">{error || fallback}</p>
            {originalUrl && <a href={originalUrl} target="_blank" rel="noopener noreferrer" className="inline-flex min-h-11 items-center justify-center rounded-xl px-5 bg-[#A65A2A] text-white text-sm font-semibold">Abrir arquivo original ↗</a>}
          </div>}
        </div>
        <footer className="shrink-0 min-h-12 py-2 px-3 sm:px-5 border-t border-white/[0.08] flex justify-between items-center gap-3">
          <span className="text-[11px] text-[#81858B]">Prévia privativa · SAGAMENTE</span>
          {type === 'image' && previewUrl && !error && <div className="flex items-center gap-2">
            <button type="button" onClick={()=>setZoom(value=>Math.max(.5,Number((value-.25).toFixed(2))))} className="w-9 h-9 rounded-lg bg-white/[.06] text-white" aria-label="Reduzir zoom">−</button>
            <span className="min-w-[52px] text-center text-xs text-gray-300">{Math.round(zoom*100)}%</span>
            <button type="button" onClick={()=>setZoom(value=>Math.min(3,Number((value+.25).toFixed(2))))} className="w-9 h-9 rounded-lg bg-white/[.06] text-white" aria-label="Ampliar zoom">+</button>
            <button type="button" onClick={()=>setRotation(value=>(value+90)%360)} className="px-3 h-9 rounded-lg bg-white/[.06] text-xs text-white" aria-label="Girar imagem">↻ Girar</button>
          </div>}
        </footer>
      </section>
    </div>, document.body
  )
}
