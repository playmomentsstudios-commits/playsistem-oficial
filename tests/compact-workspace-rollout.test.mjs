import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
const read=path=>readFileSync(new URL('../'+path,import.meta.url),'utf8')

test('Both authenticated workspaces use the compact responsive shell',()=>{
  const admin=read('src/layouts/AdminLayout.tsx')
  const customer=read('src/layouts/CustomerLayoutV2.tsx')
  assert.match(admin,/pm-workspace-main/)
  assert.match(customer,/pm-workspace-main/)
  assert.match(customer,/CustomerRouteBoundary/)
})
test('Shared compact visual components preserve accessible semantic HTML',()=>{
  const shared=read('src/components/ui/CompactWorkspace.tsx')
  const css=read('src/styles/compact-workspace.css')
  assert.match(shared,/<header/)
  assert.match(shared,/<h1/)
  assert.match(shared,/<details/)
  assert.match(shared,/<summary/)
  assert.match(css,/focus-visible/)
  assert.match(css,/@media\(max-width:640px\)/)
})
test('Customer project detail leads with documents, progress, task status and only published files',()=>{
  const src=read('src/pages/customer/ProjectsPage.tsx')
  assert.match(src,/CompactPageHeader/)
  assert.match(src,/file\.client_visible/)
  assert.match(src,/role="progressbar"/)
  assert.ok(src.indexOf('id="arquivos-projeto"')<src.indexOf('aria-label="Etapas e tarefas"'))
  assert.match(src,/onOpen=\{openFile\}/)
  assert.match(src,/CompactDisclosure/)
  assert.match(src,/client_visible\)/)
})
test('Core customer sections share the same dense visual system without removing actions',()=>{
  const paths=['DashboardPage','FilesPage','OrdersPage','QuotesPage','PaymentsPage','NotificationsPage','ProfilePage','CustomerSettings','CustomerServicesPage','AnnouncementsPage']
  for(const name of paths){assert.match(read('src/pages/customer/'+name+'.tsx'),/CompactPageHeader|CompactDisclosure/,name)}
  const payments=read('src/pages/customer/PaymentsPage.tsx')
  assert.match(payments,/hostedCard/)
  assert.match(payments,/asaasPix/)
  const quotes=read('src/pages/customer/QuotesPage.tsx')
  assert.match(quotes,/decide\(q\.id,'accepted'\)/)
  assert.match(quotes,/decide\(q\.id,'rejected'\)/)
  const files=read('src/pages/customer/FilesPage.tsx')
  assert.match(files,/review\(file,'approved'\)/)
  assert.match(files,/review\(file,'changes_requested'\)/)
})
test('Admin pages retain project creation, status filtering and link navigation',()=>{
  const projects=read('src/pages/admin/AdminProjects.tsx')
  assert.match(projects,/setShowForm/)
  assert.match(projects,/statusFilter/)
  assert.match(projects,/\/admin\/projetos\//)
  const dashboard=read('src/pages/admin/AdminDashboard.tsx')
  assert.match(dashboard,/CompactPageHeader/)
  assert.match(dashboard,/\/admin\/crm/)
})
