import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'

const read = name => readFileSync(new URL('../'+name, import.meta.url), 'utf8')
const modal = read('src/components/files/FilePreviewModal.tsx')
const utils = read('src/lib/filePreview.ts')
const pages = [
  read('src/pages/admin/AdminProjectDetailV2.tsx'),
  read('src/pages/admin/AdminFilesV2.tsx'),
  read('src/pages/customer/FilesPage.tsx'),
]

test('Single viewer is mounted in all three file areas',()=>{
  for(const page of pages){
    assert.match(page,/FilePreviewModal/)
    assert.match(page,/setPreviewFile/)
  }
})
test('Private Drive preview uses authenticated server download, not public drive iframe',()=>{
  assert.match(modal,/portalApi\.driveFileBlobUrl\(file\.id\)/)
  assert.match(modal,/portalApi\.fileUrl\(file\.storage_path\)/)
  assert.match(modal,/URL\.revokeObjectURL/)
  assert.match(modal,/createPortal/)
  assert.doesNotMatch(modal,/drive\/file\/d\/|docs\.google\.com\/gview/)
})
test('Images PDF audio and video have native preview with safe unsupported fallbacks',()=>{
  assert.match(modal,/<img/)
  assert.match(modal,/<iframe/)
  assert.match(modal,/<audio controls/)
  assert.match(modal,/<video controls/)
  assert.match(modal,/tooLarge/)
  assert.match(utils,/ai','psd','psb','cdr'/)
  assert.match(utils,/MAX_INLINE_PREVIEW_BYTES = 100/)
  assert.match(utils,/parsed\.protocol === 'https:'/)
})
test('Existing permissions remain implemented in the private Drive Edge Function',()=>{
  const edge=read('supabase/functions/google-drive-file-download/index.ts')
  assert.match(edge,/isPrimaryCustomer = ctx\.role === "customer"/)
  assert.match(edge,/linkedProject\?\.customer_id === ctx\.userId/)
  assert.match(edge,/project_customer_access/)
  assert.match(edge,/file\.client_visible && file\.project_id/)
  assert.match(edge,/if \(!staffAllowed && !isPrimaryCustomer && !isAdditionalViewer\) throw new Error\("Forbidden"\)/)
})
