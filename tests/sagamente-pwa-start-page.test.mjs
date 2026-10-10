import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
const read = path => readFileSync(new URL('../' + path, import.meta.url), 'utf8')

test('installed PWA opens workspace while the browser homepage stays public', () => {
  const manifest = JSON.parse(read('public/manifest.webmanifest'))
  const worker = read('worker/pwa.js')
  const router = read('src/AppV2.tsx')
  const entry = read('src/components/AppLaunchRoute.tsx')
  assert.equal(manifest.id, '/')
  assert.equal(manifest.start_url, '/abrir-app')
  assert.match(worker, /start_url: '\/abrir-app'/)
  assert.match(router, /path="\/" element={<LegacyStandaloneLanding><HomePage/)
  assert.match(router, /path="\/abrir-app" element={<AppLaunchRoute/)
  assert.match(entry, /isStandaloneApp\(\)/)
  assert.match(entry, /legacyStandaloneLaunchPending = false/)
  assert.match(entry, /login\?next=%2Fabrir-app/)
  assert.match(entry, /'\/admin' : '\/app\/dashboard'/)
})

test('customer and admin have storefront links and the new entry is private', () => {
  const admin = read('src/layouts/AdminLayout.tsx')
  const client = read('src/layouts/CustomerLayoutV2.tsx')
  const seo = read('worker/seo.js')
  const analytics = read('src/components/PublicViewTracker.tsx')
  const wrangler = JSON.parse(read('wrangler.jsonc'))
  for (const layout of [admin, client]) {
    assert.match(layout, /Ver site/)
    assert.match(layout, /isStandaloneApp\(\) \? '\/login' : '\/'/)
  }
  assert.match(seo, /app\|abrir-app/)
  assert.match(analytics, /app\|abrir-app/)
  assert.ok(wrangler.assets.run_worker_first.includes('/abrir-app'))
})
