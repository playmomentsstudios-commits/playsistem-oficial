export type PreviewType = 'image' | 'pdf' | 'audio' | 'video' | 'unsupported'

export type ViewableFile = {
  id: string
  name: string
  mime_type?: string | null
  file_type?: string | null
  file_size?: number | null
  storage_provider?: string | null
  drive_file_id?: string | null
  storage_path?: string | null
  external_url?: string | null
  version_number?: number | null
}

export const MAX_INLINE_PREVIEW_BYTES = 100 * 1024 * 1024

export function filePreviewType(file: Pick<ViewableFile, 'name'|'mime_type'|'file_type'>): PreviewType {
  const ext = String(file.name || '').toLowerCase().split('.').pop() || ''
  const mime = String(file.mime_type || file.file_type || '').toLowerCase().split(';')[0].trim()

  // Never treat proprietary design documents as image data even if the Drive MIME is generic.
  if (['ai','psd','psb','cdr','eps','indd','sketch','fig','svg'].includes(ext)) return 'unsupported'
  if (['jpg','jpeg','png','webp','gif','avif','bmp'].includes(ext)) return 'image'
  if (ext === 'pdf') return 'pdf'
  if (['mp3','wav','ogg','oga','m4a','aac','flac','opus'].includes(ext)) return 'audio'
  if (['mp4','webm','mov','m4v'].includes(ext)) return 'video'

  if (mime === 'application/pdf') return 'pdf'
  if (['image/jpeg','image/png','image/webp','image/gif','image/avif','image/bmp'].includes(mime)) return 'image'
  if (mime.startsWith('audio/')) return 'audio'
  if (mime === 'video/mp4' || mime === 'video/webm' || mime === 'video/quicktime') return 'video'
  return 'unsupported'
}

export function filePreviewLabel(type: PreviewType): string {
  return ({
    image: 'Imagem', pdf: 'Documento PDF', audio: 'Áudio',
    video: 'Vídeo', unsupported: 'Arquivo original',
  } as const)[type]
}

export function safeOriginalUrl(url: string | null | undefined): string | null {
  if (!url) return null
  try {
    const parsed = new URL(url)
    return parsed.protocol === 'https:' || parsed.protocol === 'http:' ? parsed.href : null
  } catch {
    return null
  }
}

export function previewSizeLabel(size: number | null | undefined): string {
  if (size == null || !Number.isFinite(size)) return 'Tamanho não informado'
  const units = ['B','KB','MB','GB','TB']
  let value = size
  let index = 0
  while (value >= 1024 && index < units.length - 1) { value /= 1024; index++ }
  return value.toLocaleString('pt-BR', {maximumFractionDigits: index > 2 ? 2 : 1}) + ' ' + units[index]
}
