import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
const read=p=>readFileSync(new URL('../'+p,import.meta.url),'utf8')
const admin=read('src/pages/admin/AdminSiteSettings.tsx')
const general=read('src/pages/admin/AdminSettings.tsx')
const component=read('src/components/BrandImage.tsx')
const migration=read('supabase/migrations/20261008190000_brand_identity_center.sql')
const uploader=read('supabase/functions/google-drive-site-asset-upload/index.ts')
test('A single Identidade da Marca tab holds all seven variants',()=>{
  assert.match(admin,/Identidade da Marca/)
  assert.match(admin,/BrandIdentitySettings/)
  for(const key of ['dark','light','compact','symbol','staff','favicon','social'])assert.ok(component.includes(key+":"))
})
test('Logo and favicon uploads were removed from the operational settings page',()=>{
  assert.doesNotMatch(general,/Trocar favicon|Trocar logo dos colaboradores|uploadStaffLogo|uploadFavicon/)
  assert.doesNotMatch(general,/favicon_url:settings\.favicon_url|staff_logo_url:settings\.staff_logo_url/)
})
test('Stored brand URLs have safe fallbacks and no unnecessary new media bucket',()=>{
  assert.match(migration,/add column if not exists brand_logo_dark_url/)
  assert.match(migration,/add column if not exists brand_favicon_url/)
  assert.match(migration,/add column if not exists brand_social_image_url/)
  assert.match(component,/invalidat(e|ion)BrandSettings|invalidateBrandSettings/)
  assert.match(uploader,/BRAND/)
})
test('Global brand assets are used by customer, admin, public pages, login, and SEO',()=>{
  for(const p of [
    'src/components/navigation/PublicHeader.tsx','src/layouts/PublicLayout.tsx',
    'src/layouts/AdminLayout.tsx','src/layouts/CustomerLayoutV2.tsx',
    'src/components/auth/LoginExperiencePanel.tsx','src/pages/public/AboutPage.tsx'
  ])assert.match(read(p),/BrandImage/)
  assert.match(read('src/main.tsx'),/brandAsset\(settings,'favicon'\)/)
  assert.match(read('src/lib/seo.ts'),/useBrandAsset/)
})
