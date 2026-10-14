import { useEffect, useRef, useState, type ReactNode, type RefObject } from 'react'
import { supabase } from '../../lib/supabase'
import {
 activeCaptionIndex, formatCaptionTime, parseAudiobookCaptions,
 serializeAudiobookCaptions, type AudiobookCaptionCue
} from '../../lib/audiobookCaptions'

type Props = {
 itemId: string
 audioRef: RefObject<HTMLAudioElement | null>
 children: ReactNode
}

function validStoredCues(value: unknown): AudiobookCaptionCue[] {
 if (!Array.isArray(value)) return []
 const cues = value.filter((cue): cue is AudiobookCaptionCue =>
  cue !== null && typeof cue === 'object' &&
  typeof cue.start === 'number' && Number.isFinite(cue.start) && cue.start >= 0 &&
  typeof cue.end === 'number' && Number.isFinite(cue.end) && cue.end > cue.start &&
  typeof cue.text === 'string' && cue.text.trim().length > 0
 )
 return cues.length === value.length ? cues.sort((a, b) => a.start - b.start) : []
}

export function AcademyAudiobookCaptions({ itemId, audioRef, children }: Props) {
 const [cues, setCues] = useState<AudiobookCaptionCue[]>([])
 const [time, setTime] = useState(0)
 const [expanded, setExpanded] = useState(true)
 const [isAdmin, setIsAdmin] = useState(false)
 const [editing, setEditing] = useState(false)
 const [draft, setDraft] = useState('')
 const [working, setWorking] = useState(false)
 const [status, setStatus] = useState('')
 const [loadError, setLoadError] = useState('')
 const listRef = useRef<HTMLDivElement>(null)

 useEffect(() => {
  let mounted = true
  setCues([])
  setExpanded(true)
  setEditing(false)
  setStatus('')
  setLoadError('')
  setIsAdmin(false)

  async function loadTranscript() {
   const { data, error } = await supabase.from('academy_library_transcripts')
    .select('cues').eq('item_id', itemId).maybeSingle()
   if (!mounted) return
   if (error) {
    setLoadError('Não foi possível consultar a transcrição.')
    return
   }
   const next = validStoredCues(data?.cues)
   if (!next.length) setLoadError('Ainda não há legendas disponíveis para este audiobook.')
   setCues(next)
   if (next.length) setDraft(serializeAudiobookCaptions(next))
  }

  async function checkAdmin() {
   const { data: auth } = await supabase.auth.getUser()
   if (!mounted || !auth.user) return
   const { data: profile } = await supabase.from('profiles')
    .select('role,status').eq('id', auth.user.id).maybeSingle()
   if (mounted) setIsAdmin(profile?.role === 'admin' && profile?.status === 'active')
  }

  void loadTranscript()
  void checkAdmin()
  return () => { mounted = false }
 }, [itemId])

 // Listen to native audio events. Do not replace its source, playback handlers,
 // speed control, persistence or HTMLMediaElement implementation.
 useEffect(() => {
  const audio = audioRef.current
  if (!audio) return
  const update = () => setTime(audio.currentTime || 0)
  audio.addEventListener('timeupdate', update)
  audio.addEventListener('seeked', update)
  audio.addEventListener('loadedmetadata', update)
  update()
  return () => {
   audio.removeEventListener('timeupdate', update)
   audio.removeEventListener('seeked', update)
   audio.removeEventListener('loadedmetadata', update)
  }
 }, [audioRef, itemId])

 const active = activeCaptionIndex(cues, time)
 const current = active >= 0 ? cues[active] : null

 useEffect(() => {
  if (!expanded || active < 0 || !listRef.current) return
  const container = listRef.current
  const element = container.querySelector<HTMLElement>('[data-active-caption="true"]')
  if (!element) return
  const top = element.offsetTop - container.offsetTop
  const target = top - (container.clientHeight - element.offsetHeight) / 2
  container.scrollTo({ top: Math.max(0, target), behavior: 'smooth' })
 }, [active, expanded])

 function seekTo(seconds: number) {
  const audio = audioRef.current
  if (!audio || !Number.isFinite(audio.duration)) return
  audio.currentTime = Math.min(seconds, Math.max(0, audio.duration - 0.1))
  setTime(audio.currentTime)
 }

 async function loadFile(file: File | undefined) {
  if (!file) return
  if (file.size > 500_000) { setStatus('Arquivo grande demais (máximo: 500 KB).'); return }
  try {
   const text = await file.text()
   const parsed = parseAudiobookCaptions(text)
   setDraft(serializeAudiobookCaptions(parsed))
   setStatus(String(parsed.length) + ' trechos carregados. Revise e publique.')
  } catch (error) {
   setStatus(error instanceof Error ? error.message : 'Arquivo de legendas inválido.')
  }
 }

 async function publish() {
  if (!isAdmin || working) return
  let parsed: AudiobookCaptionCue[]
  try { parsed = parseAudiobookCaptions(draft) }
  catch (error) { setStatus(error instanceof Error ? error.message : 'Legenda inválida.'); return }
  setWorking(true)
  setStatus('')
  try {
   const { error } = await supabase.from('academy_library_transcripts')
    .upsert({ item_id: itemId, language: 'pt-BR', cues: parsed, updated_at: new Date().toISOString() }, { onConflict: 'item_id' })
   if (error) throw error
   setCues(parsed)
   setEditing(false)
   setStatus(String(parsed.length) + ' trechos publicados para este audiobook.')
  } catch {
   setStatus('Não foi possível publicar. Confira sua permissão de administrador.')
  } finally {
   setWorking(false)
  }
 }

 return <div className="min-w-0 w-full space-y-5">
  <div className="flex min-h-36 w-full min-w-0 flex-col justify-center rounded-xl bg-gradient-to-br from-[#56321C] via-[#29221F] to-[#141416] px-4 py-5 text-left sm:min-h-40 sm:px-6 md:px-8" aria-label="Legenda da narração">
   {cues.length && expanded ? <>
    <span className="block w-full text-left text-[10px] font-bold uppercase tracking-[.17em] text-[#E4A36C]">
     Acompanhe a narração
    </span>
    <p className="mt-3 w-full min-w-0 max-w-none break-words text-left text-base font-medium leading-relaxed text-[#F6EDE5] sm:text-lg" aria-live="off">
     {current?.text || 'Aperte o play para acompanhar o texto da narração.'}
    </p>
   </> : <>
    <span className="text-5xl text-[#E4A36C]" aria-hidden="true">♫</span>
    <span className="sr-only">Audiobook</span>
   </>}
  </div>

  {children}

  {cues.length > 0 && <div className="min-w-0 w-full rounded-xl border border-white/10 bg-[#111215]">
   <button type="button" aria-expanded={expanded} onClick={() => setExpanded(value => !value)}
    className="flex min-h-12 w-full min-w-0 items-center justify-between gap-3 px-4 py-3 text-left text-sm font-semibold text-[#E7AD79]">
    <span>{expanded ? 'Ocultar transcrição' : 'Mostrar transcrição'}</span>
    <span aria-hidden="true">{expanded ? '−' : '+'}</span>
   </button>
   {expanded && <div ref={listRef} className="relative max-h-80 min-w-0 space-y-2 overflow-y-auto border-t border-white/10 p-2 sm:p-3"
    role="group" aria-label="Trechos da narração">
    {cues.map((cue, index) => <button
     key={index} type="button" aria-current={index === active ? 'true' : undefined}
     data-active-caption={index === active ? 'true' : undefined}
     onClick={() => seekTo(cue.start)}
     className={'grid w-full min-w-0 grid-cols-1 gap-1 rounded-lg px-3 py-3 text-left transition-colors sm:grid-cols-[3.5rem_minmax(0,1fr)] sm:gap-3 ' +
      (index === active ? 'bg-[#B77745]/20 text-white ring-1 ring-[#B77745]/40' : 'text-gray-400 hover:bg-white/5 hover:text-white')}
    >
     <span className="text-[11px] font-medium tabular-nums text-[#E7AD79] sm:pt-0.5">{formatCaptionTime(cue.start)}</span>
     <span className="block w-full min-w-0 break-words text-left text-sm leading-relaxed">{cue.text}</span>
    </button>)}
   </div>}
   {expanded && <p className="border-t border-white/10 px-4 py-3 text-xs text-gray-500">
    Toque em qualquer trecho para ouvir daquele ponto.
   </p>}
  </div>}

  {loadError && <div role="alert" className="rounded-lg border border-amber-600/30 bg-amber-950/20 p-3 text-xs text-[#E7AD79]">
   {loadError} Atualize a página para tentar novamente.
  </div>}

  {isAdmin && <div className="rounded-xl border border-[#E7AD79]/20 bg-[#17181B] p-4">
   <button type="button" onClick={() => { setEditing(value => !value); setStatus('') }}
    aria-expanded={editing} className="flex min-h-10 w-full items-center justify-between gap-3 text-left text-sm text-[#E7AD79]">
    <span>Gerenciar legendas deste audiobook</span><span aria-hidden="true">{editing ? '−' : '+'}</span>
   </button>
   {editing && <div className="mt-4 space-y-3 border-t border-white/10 pt-4">
    <p className="text-xs leading-relaxed text-gray-400">
     Importe uma transcrição temporizada .vtt ou .srt. A legenda aparece na área superior sem modificar o arquivo MP3.
    </p>
    <label className="block text-xs text-gray-300" htmlFor="saga-caption-file">Importar arquivo de legenda</label>
    <input id="saga-caption-file" type="file" accept=".vtt,.srt,text/vtt,text/plain"
     onChange={event => { void loadFile(event.target.files?.[0]); event.target.value = '' }}
     className="block w-full text-xs text-gray-300 file:mr-3 file:rounded-lg file:border-0 file:bg-[#56321C] file:px-3 file:py-2 file:text-[#F5CDAA]" />
    <label htmlFor="saga-caption-text" className="block text-xs text-gray-300">Editar tempos e falas (VTT)</label>
    <textarea id="saga-caption-text" value={draft} onChange={event => setDraft(event.target.value)}
     placeholder={'WEBVTT\n\n00:00:00.000 --> 00:00:04.000\nPrimeira fala da narração.'}
     rows={9} spellCheck={false} className="w-full rounded-lg border border-white/20 bg-[#0C0D0F] p-3 font-mono text-xs leading-relaxed text-white" />
    <button type="button" onClick={() => void publish()} disabled={working || !draft.trim()}
     className="min-h-11 rounded-lg bg-[#A86838] px-4 py-2 text-sm font-semibold text-white disabled:opacity-40">
     {working ? 'Publicando...' : 'Publicar legendas'}
    </button>
   </div>}
   {status && <p role="status" className="mt-2 text-xs text-[#E7AD79]">{status}</p>}
  </div>}
 </div>
}
