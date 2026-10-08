import test from 'node:test'
import assert from 'node:assert/strict'
import {readFileSync} from 'node:fs'
const read=(f)=>readFileSync(new URL('../'+f,import.meta.url),'utf8')
test('Brand SVGs remain independent from backgrounds',()=>{
 for(const f of ['public/sagamente-logo-dark.svg','public/sagamente-logo-light.svg','public/favicon.svg']){
  assert.match(read(f),/<svg/);assert.match(read(f),/<path/)
 }
})
test('Visible rebrand preserves business routes and auth',()=>{
 assert.match(read('index.html'),/Sagamente/)
 assert.match(read('src/layouts/AdminLayout.tsx'),/hasStaffPermission/)
 assert.match(read('src/pages/public/HomePage.tsx'),/academy_public_course/)
 assert.match(read('src/components/navigation/PublicHeader.tsx'),/BrandImage variant="dark"/)
 assert.match(read('src/layouts/CustomerLayoutV2.tsx'),/BrandImage variant=\{showLabels\?'dark':'symbol'\}/)
})
