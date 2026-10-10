import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'

const read=p=>readFileSync(new URL('../'+p,import.meta.url),'utf8')
const edge=read('supabase/functions/google-drive-file-thumbnail/index.ts')
const api=read('src/api/portal.ts')
const card=read('src/components/files/ClientProjectFileCard.tsx')
const project=read('src/pages/customer/ProjectsPage.tsx')
const library=read('src/pages/customer/FilesPage.tsx')

test('thumbnail proxy authenticates user and preserves project file visibility',()=>{
  assert.match(edge,/requireUser\(req\)/)
  assert.match(edge,/file\.client_visible/)
  assert.match(edge,/project_customer_access/)
  assert.match(edge,/file\.customer_id === ctx\.userId/)
  assert.match(edge,/project\.project_type !== "internal"/)
  assert.match(edge,/hasPermission\(ctx, "files\.view"\)/)
  assert.match(edge,/hasPermission\(ctx, "files\.manage"\)/)
  assert.match(edge,/if \(!staffAllowed && !customerAllowed\)/)
  assert.doesNotMatch(edge,/\.update\(\{\s*client_visible:/)
})

test('thumbnail proxy requests short-lived Google thumbnail, not full originals',()=>{
  assert.match(edge,/fields=id,mimeType,thumbnailLink/)
  assert.match(edge,/trustedThumbnailHost/)
  assert.match(edge,/url\.protocol !== "https:"/)
  assert.match(edge,/getDriveAccessToken\(\)/)
  assert.match(edge,/Authorization: "Bearer " \+ token/)
  assert.match(edge,/private, no-store/)
  assert.match(edge,/maxSize = 3 \* 1024 \* 1024/)
  assert.doesNotMatch(edge,/alt=media/)
  assert.doesNotMatch(edge,/Access-Control-Allow-Origin.*https:\/\/drive\.google\.com/)
})

test('customer thumbnail cards load lazily and clean up their blob URLs',()=>{
  assert.match(card,/IntersectionObserver/)
  assert.match(card,/rootMargin:'180px 0px'/)
  assert.match(card,/portalApi\.driveFileThumbnailBlobUrl\(file\.id\)/)
  assert.match(card,/URL\.revokeObjectURL/)
  assert.match(card,/object-cover/)
  assert.match(card,/onOpen\(file\)/)
  assert.match(card,/Prévia indisponível/)
  assert.match(api,/privateFunctionFile\('google-drive-file-thumbnail'/)
  assert.match(api,/data.type.startsWith/)
})

test('project and file library show artwork previews without public file URLs',()=>{
  assert.match(project,/ClientProjectFileCard/)
  assert.match(project,/Entregas concluídas/)
  assert.match(project,/Arquivos disponíveis do projeto/)
  assert.match(project,/FilePreviewModal/)
  assert.match(library,/ClientProjectFileCard/)
  assert.match(library,/FilePreviewModal/)
  assert.doesNotMatch(card,/https:\/\/drive\.google\.com\/file\/d\//)
})
