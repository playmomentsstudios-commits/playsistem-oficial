import { useEffect, useRef, useState } from 'react'
import { portalApi } from '../../api/portal'
import { filePreviewType } from '../../lib/filePreview'

type Props = { file: any; fallback?: string; className?: string }

/** Privately fetched only when visible; the full-size design stays in Google Drive. */
export function DriveFileThumbnail({ file, fallback = '🖼️', className = '' }: Props) {
  const wrapper = useRef<HTMLSpanElement>(null)
  const [url, setUrl] = useState<string | null>(null)
  const eligible = file?.storage_provider === 'google_drive'
    && Boolean(file?.drive_file_id)
    && filePreviewType(file) === 'image'

  useEffect(() => {
    if (!eligible) return
    let active = true
    let objectUrl: string | null = null
    let observer: IntersectionObserver | null = null
    const fetchThumbnail = () => {
      void portalApi.driveFileThumbnailBlobUrl(file.id).then(value => {
        if (!active) { URL.revokeObjectURL(value); return }
        objectUrl = value
        setUrl(value)
      }).catch(() => { if (active) setUrl(null) })
    }
    const element = wrapper.current
    if (element && typeof IntersectionObserver !== 'undefined') {
      observer = new IntersectionObserver(entries => {
        if (entries.some(entry => entry.isIntersecting)) {
          observer?.disconnect()
          fetchThumbnail()
        }
      }, { rootMargin: '160px', threshold: 0.01 })
      observer.observe(element)
    } else fetchThumbnail()
    return () => {
      active = false
      observer?.disconnect()
      if (objectUrl) URL.revokeObjectURL(objectUrl)
    }
  }, [file?.id, file?.drive_file_id, eligible])

  return <span ref={wrapper} className={'relative flex items-center justify-center overflow-hidden ' + className}>
    {url
      ? <img src={url} alt={'Miniatura de ' + file.name} loading="lazy"
          className="h-full w-full object-contain" onError={() => setUrl(null)} />
      : <span aria-hidden="true">{fallback}</span>}
  </span>
}
