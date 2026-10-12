import test from 'node:test'
import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'

const session=await readFile(new URL('../supabase/functions/google-drive-upload-session/index.ts',import.meta.url),'utf8')
const finalize=await readFile(new URL('../supabase/functions/google-drive-finalize/index.ts',import.meta.url),'utf8')
const download=await readFile(new URL('../supabase/functions/google-drive-file-download/index.ts',import.meta.url),'utf8')
const shared=await readFile(new URL('../supabase/functions/_shared/googleDrive.ts',import.meta.url),'utf8')
const projectFolder=await readFile(new URL('../supabase/functions/google-drive-project-folder/index.ts',import.meta.url),'utf8')
const uploadStatus=await readFile(new URL('../supabase/functions/google-drive-upload-status/index.ts',import.meta.url),'utf8')

test('customer Drive uploads are restricted to received/client-visible intake folders',()=>{
 assert.match(session,/!staffAllowed && folderKind !== "received"/)
 assert.match(session,/!customFolder\.client_visible/)
 assert.match(session,/customFolder\.parent_kind !== "received"/)
})

test('additional project customers are authorized by an exact external project link',()=>{
 assert.match(shared,/ctx\.role !== "customer" \|\| project\.project_type === "internal"/)
 assert.match(shared,/project_customer_access/)
 assert.match(shared,/\.eq\("project_id", project\.id\)/)
 assert.match(shared,/\.eq\("customer_id", ctx\.userId\)/)
 assert.match(projectFolder,/customerCanAccessProject\(ctx, project\)/)
 assert.match(session,/customerCanAccessProject\(ctx, project\)/)
 assert.match(finalize,/customerCanAccessProject\(ctx, project\)/)
 assert.match(uploadStatus,/customerCanAccessProject\(ctx, project\)/)
})

test('Drive finalization is cryptographically scoped by session metadata',()=>{
 assert.match(finalize,/playMomentsUploadId !== uploadId/)
 assert.match(finalize,/playMomentsEntityId !== projectId/)
 assert.match(finalize,/Upload session does not belong to this user and project/)
 assert.match(finalize,/Customers can only upload to received files/)
 assert.match(finalize,/customFolder\.client_visible/)
})

test('Drive download enforces staff, primary client or explicit additional viewer membership',()=>{
 assert.match(download,/hasPermission\(ctx, "files\.view"\)/)
 assert.match(download,/isPrimaryCustomer = ctx\.role === "customer"/)
 assert.match(download,/linkedProject\?\.customer_id === ctx\.userId/)
 assert.match(download,/project_customer_access/)
 assert.match(download,/file\.client_visible && file\.project_id/)
 assert.match(download,/if \(!staffAllowed && !isPrimaryCustomer && !isAdditionalViewer\) throw new Error\("Forbidden"\)/)
})
