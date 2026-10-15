import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'

const read=path=>readFileSync(new URL('../'+path,import.meta.url),'utf8')

test('Admin dashboard prioritizes one shortcut per primary sidebar group',()=>{
 const config=read('src/lib/adminDashboardLayout.ts')
 const sidebar=read('src/layouts/AdminLayout.tsx')
 const dashboard=read('src/pages/admin/AdminDashboard.tsx')
 const groups=[
  ['clients','/admin/clientes'], // Comercial
  ['projects','/admin/projetos'], // Operação
  ['payments','/admin/pagamentos'], // Financeiro
  ['services','/admin/servicos'], // Catálogo
  ['academy','/admin/academia'], // Academia
  ['messages','/admin/conversas'], // Comunicação
  ['site','/admin/site'], // Gestão
 ]
 assert.match(config,/shortcuts:\['clients','projects','payments','services','academy','messages','site'\]/)
 for(const [id,route] of groups){
  assert.match(config,new RegExp("id:'"+id+"', label:'.*?', description:'.*?', href:'"+route+"'"))
  assert.ok(sidebar.includes("href:'"+route+"'"),'Missing sidebar route: '+route)
 }
 assert.match(dashboard,/briefcase:/)
 assert.doesNotMatch(config,/shortcuts:\[[^\]]*'course-access'[^\]]*'library-access'[^\]]*\],\s*widgets:/)
})

test('Legacy initial shortcut selections migrate without changing custom choices',()=>{
 const config=read('src/lib/adminDashboardLayout.ts')
 assert.match(config,/const LEGACY_DEFAULT_SHORTCUTS = \['clients','course-access','library-access','library','site','projects'\]/)
 assert.match(config,/const LEGACY_DEFAULT_WITHOUT_PROJECTS = \['clients','course-access','library-access','library','site'\]/)
 assert.match(config,/shortcuts:upgradeLegacyShortcuts\(normalizeIds\(/)
 assert.match(config,/shortcuts\.every\(\(id,i\)=>id===values\[i\]\)/)
 assert.match(config,/return isLegacy\(LEGACY_DEFAULT_SHORTCUTS\)\|\|isLegacy\(LEGACY_DEFAULT_WITHOUT_PROJECTS\)/)
})
