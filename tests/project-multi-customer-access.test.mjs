import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'

const read=(file)=>readFileSync(new URL('../'+file,import.meta.url),'utf8')
const migration=read('supabase/migrations/20261008233000_multiple_clients_per_project_view_access.sql')
const api=read('src/api/portal.ts')
const project=read('src/pages/admin/AdminProjectDetailV2.tsx')
const customer=read('src/pages/admin/AdminCustomerDetailV2.tsx')
const files=read('src/pages/customer/FilesPage.tsx')
const download=read('supabase/functions/google-drive-file-download/index.ts')

test('additional viewers are linked many-to-many and protected by RLS',()=>{
  assert.match(migration,/create table if not exists public\.project_customer_access/i)
  assert.match(migration,/primary key\(project_id,customer_id\)/i)
  assert.match(migration,/enable row level security/i)
  assert.match(migration,/current_user_is_active_customer/i)
  assert.match(migration,/project_type<>'internal'|project_type <> 'internal'/i)
  assert.match(migration,/public\.client_files/)
  assert.match(migration,/public\.project_stages/)
  assert.match(migration,/public\.tasks/)
  assert.match(migration,/public\.task_checklist_items/)
  assert.match(migration,/public\.task_links/)
})
test('project details can add and remove multiple viewers without changing primary customer',()=>{
  assert.match(project,/projectViewers\.map/)
  assert.match(project,/addProjectViewer\(id,viewerDraft/)
  assert.match(project,/removeProjectViewer\(id,customerId/)
  assert.match(project,/\+ Adicionar cliente/)
  assert.match(api,/project_customer_access/)
  assert.match(api,/assignProjectCustomer/)
})
test('client profile can attach to projects that already have principal customers',()=>{
  assert.match(customer,/if\(selected\.customer_id\)/)
  assert.match(customer,/addProjectViewer/)
  assert.match(customer,/customerProjectViewers/)
  assert.doesNotMatch(customer,/!item\.customer_id&&item\.project_type!=='internal'/)
})
test('extra viewers cannot upload files or approve deliveries',()=>{
  assert.match(files,/selectedIsPrimary/)
  assert.match(files,/file\.customer_id===user\?\.id&&file\.review_required/)
  assert.match(files,/if\(file\.customer_id!==user\?\.id\)/)
  assert.match(download,/file\.client_visible/)
  assert.match(download,/project_customer_access/)
  assert.match(download,/file\.project_id/)
  assert.match(download,/project\?\.project_type !== "internal"/)
})
