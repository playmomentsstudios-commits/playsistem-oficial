export const MAX_ATTACHMENT_BYTES = 50 * 1024 * 1024
export const MAX_RECORDING_SECONDS = 5 * 60

export function validateAttachment(file: Pick<File, 'name' | 'size'>): string | null {
  if (!file.size) return 'O arquivo está vazio. Escolha outro arquivo.'
  if (file.size > MAX_ATTACHMENT_BYTES) return 'O limite é de 50 MB por arquivo. Escolha um arquivo menor.'
  if (!file.name || file.name.length > 255) return 'Use um nome de arquivo com até 255 caracteres.'
  return null
}

export function attachmentMime(file: Pick<File, 'type'>) {
  return file.type || 'application/octet-stream'
}

export function previewKind(type: string): 'image' | 'audio' | 'video' | 'file' {
  const mime = type.split(';')[0].toLowerCase()
  if (['image/jpeg', 'image/png', 'image/gif', 'image/webp', 'image/avif'].includes(mime)) return 'image'
  if (['audio/webm', 'audio/ogg', 'audio/mp4', 'audio/mpeg', 'audio/wav', 'audio/x-wav', 'audio/aac'].includes(mime)) return 'audio'
  if (['video/mp4', 'video/webm', 'video/quicktime'].includes(mime)) return 'video'
  return 'file'
}

export function formatFileSize(bytes: number) {
  return bytes < 1024 * 1024 ? `${Math.max(1, Math.round(bytes / 1024))} KB` : `${(bytes / 1024 / 1024).toFixed(1)} MB`
}
