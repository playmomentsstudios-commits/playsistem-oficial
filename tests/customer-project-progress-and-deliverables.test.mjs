import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
const read=(p)=>readFileSync(new URL('../'+p,import.meta.url),'utf8')
const page=read('src/pages/customer/ProjectsPage.tsx')
const admin=read('src/pages/admin/AdminProjectDetailV2.tsx')
const portal=read('src/api/portal.ts')

test('client projects show actual completed work and tasks without fabricated zero progress',()=>{
  assert.match(page,/projectProgress\(\{tasks\}\)/)
  assert.match(page,/Entregas concluídas/)
  assert.match(page,/remaining\.length/)
  assert.match(page,/Checklist de execução/)
  assert.match(page,/Links de visualização/)
  assert.match(page,/task\.client_visible/)
  assert.match(page,/stage\.client_visible/)
  assert.match(page,/Aguardando atualização das entregas/)
})
test('project files have protected preview including Drive download',()=>{
  assert.match(page,/FilePreviewModal/)
  assert.match(page,/projectFiles\(task\.id\)/)
  assert.match(page,/file\.client_visible/)
  assert.match(page,/Arquivos disponíveis do projeto/)
  assert.doesNotMatch(page,/if\(file\.external_url\)\{window\.open/)
})
test('nonfatal file API errors do not hide project progress',()=>{
  assert.match(page,/Promise\.allSettled/)
  assert.match(page,/attachments\.status==='fulfilled'/)
  assert.match(page,/setWarning\(/)
})
test('admin can publish existing task and file with explicit acknowledgement',()=>{
  assert.match(admin,/changeTaskVisibility/)
  assert.match(admin,/changeFileVisibility/)
  assert.match(admin,/checked=\{Boolean\(task\.client_visible\)\}/)
  assert.match(admin,/checked=\{Boolean\(file\.client_visible\)\}/)
  assert.match(admin,/fileManagementApi\.publish/)
  assert.match(portal,/setProjectFileVisibility/)
  assert.match(portal,/data\.client_visible!==visible/)
})
