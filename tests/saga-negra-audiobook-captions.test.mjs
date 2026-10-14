import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'

const source = path => readFileSync(new URL('../' + path, import.meta.url), 'utf8')

test('Caption data is grant-scoped and only active admins may modify it', () => {
 const sql = source('supabase/migrations/20261014170000_saga_negra_audiobook_transcripts.sql')
 assert.match(sql, /academy_library_transcripts_read_granted/)
 assert.match(sql, /g\.user_id = auth\.uid\(\)/)
 assert.match(sql, /g\.active = true/)
 assert.match(sql, /p\.status = 'active'/)
 assert.match(sql, /public\.is_active_admin\(\)/)
 assert.match(sql, /REVOKE ALL ON public\.academy_library_transcripts FROM PUBLIC, anon/)
 assert.match(sql, /ON DELETE CASCADE/)
})

test('Audiobook has additive transcript component, without changing the original audio playback controls', () => {
 const page = source('src/pages/customer/AcademyLibraryItemPage.tsx')
 assert.match(page, /<AcademyAudiobookCaptions itemId=\{item\.id\} audioRef=\{audioRef\}>/)
 assert.match(page, /<audio ref=\{audioRef\} key=\{item\.id\} controls controlsList="nodownload"/)
 assert.match(page, /onTimeUpdate=\{saveAudioPosition\}/)
 assert.match(page, /onLoadedMetadata=\{restoreAudioPosition\}/)
 assert.match(page, /audioRef\.current\.playbackRate=next/)
 assert.match(page, /<iframe title=/)
})

test('Caption UI follows the native audio clock and allows click-to-seek', () => {
 const component = source('src/components/academy/AcademyAudiobookCaptions.tsx')
 assert.match(component, /audio\.addEventListener\('timeupdate', update\)/)
 assert.match(component, /audio\.addEventListener\('seeked', update\)/)
 assert.match(component, /activeCaptionIndex\(cues, time\)/)
 assert.match(component, /audio\.currentTime = Math\.min\(seconds/)
 assert.match(component, /aria-current=/)
 assert.match(component, /Mostrar transcrição/)
 assert.match(component, /overflow-y-auto/)
 assert.match(component, /void loadFile\(event\.target\.files\?\.\[0\]\)/)
})

test('Caption import validates time ranges before publishing and never requires public Drive media', () => {
 const component = source('src/components/academy/AcademyAudiobookCaptions.tsx')
 const parser = source('src/lib/audiobookCaptions.ts')
 assert.match(parser, /parseAudiobookCaptions/)
 assert.match(parser, /end <= start/)
 assert.match(parser, /legendas sobrepostas/)
 assert.match(parser, /maxCues = 1200/)
 assert.match(component, /parseAudiobookCaptions\(draft\)/)
 assert.match(component, /\.upsert\(\{ item_id: itemId, language: 'pt-BR'/)
 assert.doesNotMatch(component, /drive\.google\.com|usercontent\.google\.com/)
})

test('RLS does not hide captions behind admin-only source item access', () => {
 const migration = source('supabase/migrations/20261014154500_fix_saga_negra_captions_visibility.sql')
 assert.match(migration, /CREATE SCHEMA IF NOT EXISTS private_academy/)
 assert.match(migration, /FUNCTION private_academy\.can_read_transcript\(p_item_id uuid\)/)
 assert.match(migration, /SECURITY DEFINER/)
 assert.match(migration, /g\.user_id = auth\.uid\(\)/)
 assert.match(migration, /g\.active = true/)
 assert.match(migration, /p\.status = 'active'/)
 assert.match(migration, /i\.status IN \('private_beta', 'published'\)/)
 assert.match(migration, /i\.format = 'audiobook'/)
 assert.match(migration, /REVOKE ALL ON FUNCTION private_academy\.can_read_transcript\(uuid\) FROM PUBLIC, anon/)
 assert.match(migration, /USING \(\s*public\.is_active_admin\(\) OR private_academy\.can_read_transcript\(item_id\)/)
})

test('Transcript is displayed by default, optional to hide, and errors are visible to customers', () => {
 const component=source('src/components/academy/AcademyAudiobookCaptions.tsx')
 assert.match(component, /const \[expanded, setExpanded\] = useState\(true\)/)
 assert.match(component, /setExpanded\(true\)/)
 assert.match(component, /\{cues\.length && expanded \? <>/)
 assert.match(component, /Ocultar transcrição/)
 assert.match(component, /Mostrar transcrição/)
 assert.match(component, /\{loadError && <div role="alert"/)
})

test('Current spoken phrase adapts to narrow screens without fixed aspect ratio or clipping', () => {
 const component=source('src/components/academy/AcademyAudiobookCaptions.tsx')
 assert.doesNotMatch(component, /aspect-\[3\/1\]|max-h-52|text-balance/)
 assert.match(component, /min-h-36 w-full min-w-0 flex-col/)
 assert.match(component, /max-w-none break-words text-left/)
 assert.match(component, /Acompanhe a narração/)
})

test('Transcript entries keep the time above text on mobile and alongside it on wider screens', () => {
 const component=source('src/components/academy/AcademyAudiobookCaptions.tsx')
 assert.match(component, /grid-cols-1 gap-1/)
 assert.match(component, /sm:grid-cols-\[3\.5rem_minmax\(0,1fr\)\]/)
 assert.match(component, /max-h-80 min-w-0/)
 assert.match(component, /block w-full min-w-0 break-words text-left text-sm/)
 assert.match(component, /data-active-caption=/)
 assert.match(component, /onClick=\{\(\) => seekTo\(cue\.start\)\}/)
})
