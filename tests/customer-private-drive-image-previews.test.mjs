import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
const read=(path)=>readFileSync(new URL('../'+path,import.meta.url),'utf8')
const thumb=read('supabase/functions/google-drive-file-thumbnail/index.ts')
const download=read('supabase/functions/google-drive-file-download/index.ts')
const card=read('src/components/files/ClientProjectFileCard.tsx')
const viewer=read('src/components/files/FilePreviewModal.tsx')
const api=read('src/api/portal.ts')

test('JPG, JPEG and PNG use the secure authenticated preview, even with generic MIME',()=>{
 assert.match(thumb,/extension === "jpg" \|\| extension === "jpeg"/)
 assert.match(thumb,/extension === "png"/)
 assert.match(thumb,/const token = await getDriveAccessToken\(\)/)
 assert.match(thumb,/\?fields=id,mimeType,thumbnailLink/)
 assert.match(thumb,/\?alt=media/)
 assert.match(thumb,/MAX_ORIGINAL_PREVIEW_BYTES = 20 \* 1024 \* 1024/)
 assert.match(thumb,/readCappedImage\(original, MAX_ORIGINAL_PREVIEW_BYTES\)/)
 assert.match(thumb,/imageMatches\(bytes, mime\)/)
 assert.match(thumb,/X-Content-Type-Options/)
 assert.match(thumb,/Cache-Control": "private, no-store"/)
 assert.match(api,/driveImageOriginalBlobUrl/)
 assert.match(viewer,/portalApi\.driveImageOriginalBlobUrl\(file\.id\)/)
 assert.match(viewer,/onRetry=\{\(\)=>setRetryNonce/)
 assert.match(card,/filePreviewType\(file\)/)
})

test('an image thumbnail never opens project files to the internet or another customer',()=>{
 assert.match(thumb,/requireUser\(req\)/)
 assert.match(thumb,/file\.client_visible/)
 assert.match(thumb,/project\.customer_id === ctx\.userId/)
 assert.match(thumb,/project\.project_type !== "internal"/)
 assert.match(thumb,/project_customer_access/)
 assert.match(thumb,/!staffAllowed && !customerAllowed/)
 assert.match(thumb,/return errorResponse\("Forbidden", 403\)/)
 assert.match(thumb,/trustedThumbnailHost\(url\.hostname\)/)
 assert.match(thumb,/redirect: "manual"/)
 assert.doesNotMatch(thumb,/permissions\.create|anyone|publicReader/)
})

test('PDF and original downloads share correctly scoped project permissions',()=>{
 assert.match(download,/linkedProject\?\.customer_id === ctx\.userId/)
 assert.match(download,/linkedProject\?\.project_type !== "internal"/)
 assert.match(download,/project_customer_access/)
 assert.match(download,/getDriveAccessToken\(\)/)
 assert.match(download,/GOOGLE_DRIVE_REFRESH_TOKEN/)
 assert.doesNotMatch(download,/throw new Error\(`Could not download Drive file:/)
})

test('revoked OAuth errors are explicit rather than misleading placeholder thumbnails',()=>{
 assert.match(thumb,/Conexão do Google Drive expirada ou revogada/)
 assert.match(viewer,/reconexão ao administrador/)
 assert.match(card,/Drive desconectado/)
 assert.match(download,/reconecte a conta institucional/i)
 assert.match(viewer,/type === 'image'/)
 assert.match(card,/if\(type==='pdf'\)return \{label:'PDF',symbol:'▤',previewable:false\}/)
})
