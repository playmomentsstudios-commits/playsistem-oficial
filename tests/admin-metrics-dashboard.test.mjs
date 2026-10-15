import test from 'node:test'
import assert from 'node:assert/strict'
import {readFileSync} from 'node:fs'
const read=path=>readFileSync(new URL('../'+path,import.meta.url),'utf8')

test('Admin home is operational, without quantitative dashboard sections',()=>{
 const page=read('src/pages/admin/AdminDashboard.tsx')
 const layout=read('src/lib/adminDashboardLayout.ts')
 const prefs=read('src/components/admin/AdminDashboardPreferencesPanel.tsx')
 assert.match(page,/Acessos rápidos/)
 assert.match(page,/Precisa de atenção/)
 assert.match(page,/Em andamento/)
 assert.doesNotMatch(page,/if\(widget==='indicators'\)/)
 assert.doesNotMatch(page,/if\(widget==='extra'\)/)
 assert.match(layout,/widgets:\['quick-actions','pending','projects'\]/)
 assert.doesNotMatch(layout,/id:'indicators', label:'Indicadores principais'/)
 assert.match(prefs,/As contagens ficam no Dashboard separado/)
})

test('Dedicated administrator analytics page is routed separately and restricts access',()=>{
 const routes=read('src/AppV2.tsx')
 const sidebar=read('src/layouts/AdminLayout.tsx')
 const page=read('src/pages/admin/AdminMetricsDashboard.tsx')
 assert.match(routes,/const AdminMetricsDashboard = lazy/)
 assert.ok(routes.includes('<Route path="dashboard" element={<AdminPermissionGate adminOnly><AdminMetricsDashboard /></AdminPermissionGate>} />'))
 assert.match(sidebar,/to="\/admin\/dashboard"/)
 for(const phrase of ['Clientes e operação','Academia e biblioteca','Audiência pública','Consumo de conteúdo','Ouvintes de audiobooks','Downloads de arquivos']){
  assert.ok(page.includes(phrase),'Metric section missing: '+phrase)
 }
 assert.match(page,/public_view_summary/)
 assert.match(page,/p_days:period/)
 assert.match(page,/Não medido/)
 assert.match(page,/As contagens ficam no Dashboard separado|visualizações usam o período escolhido/)
 assert.doesNotMatch(page,/Math\.random\(/)
})
