import test from 'node:test'
import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'

const session=await readFile(new URL('../supabase/functions/google-drive-upload-session/index.ts',import.meta.url),'utf8')
const finalize=await readFile(new URL('../supabase/functions/google-drive-finalize/index.ts',import.meta.url),'utf8')
const download=await readFile(new URL('../supabase/functions/google-drive-file-download/index.ts',import.meta.url),'utf8')

test('customer Drive uploads are restricted to received/client-visible intake folders',()=>{
 assert.match(session,/!staffAllowed && folderKind !== "received"/)
 assert.match(session,/!customFolder\.client_visible/)
 assert.match(session,/customFolder\.parent_kind !== "received"/)
})

test('Drive finalization is cryptographically scoped by session metadata',()=>{
 assert.match(finalize,/playMomentsUploadId !== uploadId/)
 assert.match(finalize,/playMomentsEntityId !== projectId/)
 assert.match(finalize,/Upload session does not belong to this user and project/)
})

test('Drive download enforces staff, primary client or explicit additional viewer membership',()=>{
 assert.match(download,/hasPermission\(ctx, "files\.view"\)/)
 assert.match(download,/isPrimaryCustomer = ctx\.role === "customer"/)
 assert.match(download,/file\.customer_id === ctx\.userId && file\.client_visible/)
 assert.match(download,/project_customer_access/)
 assert.match(download,/file\.client_visible && file\.project_id/)
 assert.match(download,/if \(!staffAllowed && !isPrimaryCustomer && !isAdditionalViewer\) throw new Error\("Forbidden"\)/)
})
