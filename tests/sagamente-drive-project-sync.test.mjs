import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'

const read = file => readFileSync(new URL('../' + file, import.meta.url), 'utf8')
const sync = read('supabase/functions/google-drive-project-sync/index.ts')
const portal = read('src/api/portal.ts')
const detail = read('src/pages/admin/AdminProjectDetailV2.tsx')
const central = read('src/pages/admin/AdminFilesV2.tsx')
const thumbnails = read('src/components/files/DriveFileThumbnail.tsx')
const viewer = read('src/components/files/FilePreviewModal.tsx')

test('Drive reconciler inventories every registered project folder without name based deduplication', () => {
  for (const table of ['project_drive_folders', 'project_custom_folders', 'project_stage_drive_folders']) {
    assert.match(sync, new RegExp(table))
  }
  assert.match(sync, /nextPageToken/)
  assert.match(sync, /scannedIds\.has\(entry\.id\)/)
  assert.match(sync, /\.eq\("drive_file_id", entry\.id\)/)
  assert.match(sync, /client_visible: false/)
  assert.doesNotMatch(sync, /method:\s*["']DELETE["']/)
})

test('Project and file library reconcile on entry and refresh periodically', () => {
  assert.match(portal, /syncDriveProjectFiles:/)
  assert.match(detail, /syncDriveFiles\(\)/)
  assert.match(detail, /90000/)
  assert.match(central, /syncDriveProjectFiles\(row\.id\)/)
  assert.match(central, /120000/)
})

test('Private image thumbnails use protected API and modal downloads the original binary', () => {
  assert.match(thumbnails, /driveFileThumbnailBlobUrl\(file\.id\)/)
  assert.match(viewer, /driveFileThumbnailBlobUrl\(file\.id\)/)
  assert.match(viewer, /lowResPreview/)
  assert.match(viewer, /driveFileBlobUrl\(file\.id\)/)
  assert.match(viewer, /Alta resolução/)
})
