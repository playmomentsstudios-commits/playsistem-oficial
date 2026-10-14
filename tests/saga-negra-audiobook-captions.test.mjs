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
 assert.match(component, /Ver transcrição sincronizada/)
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
