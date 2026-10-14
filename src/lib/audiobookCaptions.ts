export type AudiobookCaptionCue = {
 start: number
 end: number
 text: string
}

const timestamp = /^((?:\d{1,2}:)?\d{2}:\d{2})[.,](\d{3})$/
const maxDurationSeconds = 4 * 60 * 60
const maxCues = 1200

function parseTimestamp(value: string): number {
 const match = timestamp.exec(value.trim())
 if (!match) throw new Error('O tempo informado não é válido: ' + value)
 const parts = match[1].split(':').map(Number)
 const seconds = parts.reduce((total, part) => total * 60 + part, 0) + Number(match[2]) / 1000
 if (!Number.isFinite(seconds) || seconds > maxDurationSeconds) throw new Error('Tempo fora do limite de quatro horas.')
 return seconds
}

export function parseAudiobookCaptions(raw: string): AudiobookCaptionCue[] {
 if (raw.length > 500_000) throw new Error('O arquivo de legendas excede 500 KB.')
 const clean = raw.replace(/^\uFEFF/, '').replace(/\r\n?/g, '\n').trim()
 const blocks = clean.split(/\n[ \t]*\n/)
 const cues: AudiobookCaptionCue[] = []
 for (const block of blocks) {
  const lines = block.split('\n').map(line => line.trim()).filter(Boolean)
  if (!lines.length || lines[0].startsWith('WEBVTT') || /^(NOTE|STYLE|REGION)(?:\s|$)/.test(lines[0])) continue
  const index = lines.findIndex(line => line.includes('-->'))
  if (index < 0) continue
  const sides = lines[index].split('-->')
  if (sides.length !== 2) throw new Error('Há um intervalo de legenda inválido.')
  const start = parseTimestamp(sides[0])
  const end = parseTimestamp(sides[1].trim().split(/\s+/)[0])
  const text = lines.slice(index + 1).join(' ').replace(/<[^>]*>/g, '').replace(/\s+/g, ' ').trim()
  if (end <= start || end - start > 120) throw new Error('Uma legenda tem início ou duração inválidos.')
  if (!text || text.length > 600) throw new Error('Uma legenda está vazia ou ultrapassa 600 caracteres.')
  cues.push({ start, end, text })
  if (cues.length > maxCues) throw new Error('O arquivo excede o limite de 1.200 trechos.')
 }
 if (!cues.length) throw new Error('Nenhuma legenda encontrada. Envie um arquivo .vtt ou .srt com tempos.')
 cues.sort((a, b) => a.start - b.start)
 for (let index = 1; index < cues.length; index++) {
  if (cues[index].start < cues[index - 1].end) throw new Error('Existem legendas sobrepostas. Ajuste os intervalos.')
 }
 return cues
}

function stamp(seconds: number): string {
 const ms = Math.round(seconds * 1000)
 const hours = Math.floor(ms / 3_600_000)
 const minutes = Math.floor(ms / 60_000) % 60
 const secs = Math.floor(ms / 1000) % 60
 const rest = ms % 1000
 return [hours, minutes, secs].map(value => String(value).padStart(2, '0')).join(':') + '.' + String(rest).padStart(3, '0')
}

export function serializeAudiobookCaptions(cues: AudiobookCaptionCue[]): string {
 return 'WEBVTT\n\n' + cues.map(cue => stamp(cue.start) + ' --> ' + stamp(cue.end) + '\n' + cue.text).join('\n\n')
}

export function activeCaptionIndex(cues: AudiobookCaptionCue[], time: number): number {
 if (!Number.isFinite(time) || time < 0) return -1
 return cues.findIndex(cue => time >= cue.start && time < cue.end)
}

export function formatCaptionTime(seconds: number): string {
 const total = Math.floor(Math.max(0, seconds))
 return String(Math.floor(total / 60)).padStart(2, '0') + ':' + String(total % 60).padStart(2, '0')
}
