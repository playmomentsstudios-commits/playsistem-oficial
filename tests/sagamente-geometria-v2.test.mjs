import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
const read = p => readFileSync(new URL('../'+p,import.meta.url),'utf8')
test('SAGAMENTE V2 logo signatures omit subtitle and retain geometric colors',()=>{
 for(const path of ['public/sagamente-logo-dark.svg','public/sagamente-logo-light.svg','public/sagamente-logo-compact.svg','public/sagamente-logo-staff.svg','public/sagamente-logo-vertical-dark.svg','public/sagamente-logo-vertical-light.svg']){
  const doc=read(path)
  assert.match(doc,/SAGAMENTE/)
  assert.doesNotMatch(doc,/DESIGN\s*·\s*TECNOLOGIA/)
  assert.match(doc,/#B24B18/)
 }
 const symbol=read('public/sagamente-mark.svg')
 assert.match(symbol,/viewBox="0 0 100 124"/)
 assert.equal((symbol.match(/\sM /g)||[]).length,6)
})
test('Brand center has reversible preset and PWA generator uses V2 palette',()=>{
 const panel=read('src/components/admin/BrandIdentitySettings.tsx')
 assert.match(panel,/Preparar versões V2/)
 assert.match(panel,/brand_social_image_url: prev\.brand_social_image_url|\.\.\.current/)
 assert.match(panel,/Publicar identidade/)
 const defaults=read('src/components/BrandImage.tsx')
 assert.match(defaults,/sagamente-logo-compact\.svg/)
 assert.match(defaults,/sagamente-logo-staff\.svg/)
 const script=read('scripts/generate-pwa-icons.mjs')
 for(const c of ['#1D1D20','#FFFFFF','#B24B18'])assert.ok(script.includes(c))
})
