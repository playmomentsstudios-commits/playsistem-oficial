import assert from 'node:assert/strict'
import {readFileSync} from 'node:fs'
import test from 'node:test'
const read=p=>readFileSync(new URL('../'+p,import.meta.url),'utf8')
const historic=read('supabase/migrations/20261015110000_academy_work_interest_leads.sql')
const offers=read('src/components/academy/AcademyWorkSales.tsx')
const buy=read('src/pages/public/AcademyWorkInterestPage.tsx')
const admin=read('src/pages/admin/AdminAcademySales.tsx')
const routes=read('src/AppV2.tsx')
const hub=read('src/pages/admin/AdminAcademyHub.tsx')
const pages=[
 read('src/pages/public/SagaNegraBookLanding.tsx'),
 read('src/pages/public/SagaNegraSeriesLanding.tsx'),
 read('src/pages/public/AcademyLibraryLanding.tsx')
]
const catalog=read('src/pages/public/PublicAcademyPage.tsx')
const css=read('src/academy/academy.css')

test('Every SAGA NEGRA landing uses the same commercial route and format selector',()=>{
 for(const page of pages){
  assert.ok(page.includes('AcademyWorkHeader'))
  assert.ok(page.includes('AcademyWorkOffers'))
  assert.ok(!page.includes('Consultar disponibilidade'))
 }
 for(const fragment of ["format:'ebook'","format:'audiobook'","format:'combo'","Quero o e-book","Quero o audiobook","Quero o combo","← Todas as obras"]){
  assert.ok(offers.includes(fragment),fragment)
 }
 assert.ok(catalog.includes('Conhecer obra →'))
})
test('The interest URL is now a real priced Pix checkout',()=>{
 assert.ok(routes.includes('path="/academia/interesse/:release"'))
 assert.ok(routes.includes('path="/academia/compra/:id"'))
 assert.ok(buy.includes('academy_public_work_prices'))
 assert.ok(buy.includes('academy-infinitepay-checkout'))
 assert.ok(buy.includes('Efetuar pagamento via Pix'))
 assert.ok(buy.includes('RegisterPage embedded'))
 assert.ok(buy.includes('guest_user_id:result.userId'))
 assert.ok(!buy.includes('academy_submit_work_interest'))
 assert.ok(hub.includes('Vendas Pix e preços'))
 assert.ok(admin.includes('academy_work_purchases'))
})
test('Historical leads remain private and must not create media access',()=>{
 for(const fragment of ['academy_work_interests','enable row level security','academy_submit_work_interest']){
  assert.ok(historic.includes(fragment),fragment)
 }
 assert.ok(!historic.includes('insert into public.academy_library_grants'))
})
test('Landing metadata and audiobook resume remain intact',()=>{
 assert.ok(historic.includes("cta_label='Quero adquirir'"))
 assert.ok(historic.includes("w.landing_page_id=p.id"))
 assert.ok(css.includes('.academy-resume{display:flex;align-items:center;gap:10px;padding:8px 10px'))
 assert.ok(read('src/contexts/AcademyAudioContext.tsx').includes('AcademyAudioDock'))
})
