import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'

const read = path => readFileSync(new URL('../' + path, import.meta.url), 'utf8')
const drive = read('supabase/functions/_shared/googleDrive.ts')
const upload = read('supabase/functions/google-drive-upload-session/index.ts')
const folders = read('src/lib/projectFileOrganization.ts')
const central = read('src/pages/admin/AdminFilesV2.tsx')

test('new customer projects provision four destinations only', () => {
  const definition = drive.split('export const projectFolderKinds =')[1].split('] as const')[0]
  for (const kind of ['received', 'production', 'preview', 'delivery']) {
    assert.match(definition, new RegExp('["\\\']' + kind + '["\\\']'))
  }
  for (const kind of ['raw', 'approved']) {
    assert.doesNotMatch(definition, new RegExp('["\\\']' + kind + '["\\\']'))
  }
})

test('legacy upload destinations map to supported destinations', () => {
  assert.match(drive, /raw: "production"/)
  assert.match(drive, /approved: "delivery"/)
  assert.match(upload, /uploadFolderAliases\[requestedFolderKind\]/)
  assert.match(upload, /Invalid upload destination/)
})

test('administrative forms share four logical destinations', () => {
  const definition = folders.split('export const standardProjectFolders=')[1].split('] as const')[0]
  for (const kind of ['received', 'production', 'preview', 'delivery']) {
    assert.match(definition, new RegExp("kind:'" + kind + "'"))
  }
  assert.doesNotMatch(definition, /kind:'raw'|kind:'approved'/)
  assert.match(central, /Organização avançada/)
})

test('legacy physical folders are not hidden before migration', () => {
  assert.match(folders, /legacyProjectFolders/)
  assert.match(folders, /for\(const folder of legacyProjectFolders\)/)
  assert.match(folders, /if\(!registered\)continue/)
})
