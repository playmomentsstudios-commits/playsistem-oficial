import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
const load=path=>readFileSync(new URL('../'+path,import.meta.url),'utf8')
const entries=JSON.parse(load('src/data/seoCommercialLandings.json'))
const worker=load('worker/seo.js')
const app=load('src/AppV2.tsx')
const page=load('src/pages/public/SeoCommercialLandingPage.tsx')
const related=load('src/components/public/CommercialSeoEntryCards.tsx')
const category=load('src/pages/public/CategoryPage.tsx')
const services=load('src/pages/public/ServicesPage.tsx')
const panel=load('src/pages/admin/AdminSeo.tsx')
const seoRouter=load('src/components/RouteSeo.tsx')
const wrangler=JSON.parse(load('wrangler.jsonc'))
const migration=load('supabase/migrations/20261009015000_commercial_seo_landings.sql')
const serviceSlugs=[
 'identidade-visual-basica','identidade-visual-completa','logo-profissional',
 'landing-page','site-institucional-simples','site-institucional-completo','site-com-blog',
 'edicao-reel-simples','edicao-reel-avancado','video-institucional-curto','video-corporativo-completo'
]
const expected=[
 '/solucoes/identidade-visual','/solucoes/criacao-de-sites','/solucoes/edicao-de-videos'
]

test('three landing routes have distinct truthful conversion copy and only catalog-backed offers',()=>{
 assert.deepEqual(Object.keys(entries).sort(),expected.slice().sort())
 const titles=new Set()
 for(const path of expected){
  const row=entries[path]
  assert.equal(row.path,path)
  assert.ok(row.heading.length>=35)
  assert.ok(row.intro.length>=80)
  assert.ok(row.title.length>10)
  assert.ok(row.description.length>50)
  assert.ok(row.benefits.length>=3)
  assert.ok(row.faq.length>=3)
  assert.ok(row.offers.length>=3)
  assert.equal(titles.has(row.title),false)
  titles.add(row.title)
  for(const offer of row.offers)assert.ok(serviceSlugs.includes(offer.slug),'Not present in verified catalog: '+offer.slug)
  assert.ok(app.includes('path="'+path+'"'))
  assert.ok(wrangler.assets.run_worker_first.includes(path))
  assert.ok(seoRouter.includes("'"+path+"'"))
  assert.ok(migration.includes(path))
 }
})
test('HTML worker exposes real landing page content before JS and only indexable published routes',()=>{
 assert.match(worker,/import commercialLandings from/)
 assert.match(worker,/PUBLIC_SEO_ROUTES/)
 assert.match(worker,/renderLandingContent\(landing\)/)
 assert.match(worker,/e\.prepend\(renderLandingContent\(landing\)/)
 assert.match(worker,/itemListElement/)
 assert.match(worker,/type':'Service'/)
 assert.match(worker,/if\(landing\)/)
 assert.match(worker,/published=eq\.true&noindex=eq\.false/)
 assert.match(worker,/toSafeText/)
 assert.match(worker,/rel="canonical"/)
})
test('all three commercial pages convert through real service details or custom contact',()=>{
 assert.match(page,/from '\.\.\/\.\.\/data\/seoCommercialLandings\.json'/)
 assert.match(page,/to=\{'\/servicos\/'.offer\.slug\}/)
 assert.match(page,/to="\/contato"/)
 assert.match(page,/trackConversion\('service_interest'/)
 assert.match(page,/Dúvidas frequentes/)
 assert.match(page,/Conhecer opções e contratar/)
 assert.match(related,/trackConversion\('service_interest'/)
 assert.match(category,/CommercialSeoEntryCards area=\{cat\.area\}/)
 assert.match(services,/<CommercialSeoEntryCards\/>/)
})
test('SEO center now searches, sorts and edits keyword intent and priority',()=>{
 assert.match(panel,/keywordFilter/)
 assert.match(panel,/focusOnlyHigh/)
 assert.match(panel,/priorityOrder/)
 assert.match(panel,/updateKeyword/)
 assert.match(panel,/\.from\('seo_keywords'\)\.update/)
 assert.match(panel,/Pronto para contratar/)
 assert.match(panel,/não volume ou ranking medido/)
})
test('new metadata and keyword mappings do not overwrite admin-edited SEO page records',()=>{
 assert.match(migration,/on conflict \(path\) do nothing/i)
 assert.match(migration,/where page_path='/i)
 assert.match(migration,/updated_at=now\(\)/i)
 assert.doesNotMatch(migration,/truncate|delete from|drop table/i)
})
