import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
const read = path => readFileSync(new URL('../' + path, import.meta.url), 'utf8')

test('Sagamente admin has a dedicated configurable PWA tab', () => {
  const site = read('src/pages/admin/AdminSiteSettings.tsx')
  const editor = read('src/components/admin/PwaSettings.tsx')
  assert.match(site, /Aplicativo \(PWA\)/)
  assert.match(site, /<PwaSettings\s*\/>/)
  assert.match(editor, /Nome abaixo do ícone/)
  assert.match(editor, /makeIcon\(/)
  assert.match(editor, /ctx\.drawImage\(image, 0, 0, size, size\)/)
  assert.doesNotMatch(editor, /maskable \? Math\.round\(size \* 0\.205\)/)
  assert.match(editor, /uploadSiteAsset\(files\[index\], 'BRAND'\)/)
  assert.match(editor, /icon_maskable_drive_file_id/)
  assert.match(editor, /Publicar aplicativo/)
  assert.match(editor, /Somente o administrador mestre/)
  assert.match(editor, /\.from\('pwa_settings'\)/)
})
test('Cloudflare renders configured icons and iOS names without redeploy', () => {
  const worker = read('worker/pwa.js')
  const wrangler = JSON.parse(read('wrangler.jsonc'))
  assert.equal(wrangler.main, './worker/pwa.js')
  assert.equal(wrangler.assets.binding, 'ASSETS')
  assert.equal(wrangler.assets.not_found_handling, 'single-page-application')
  for (const path of ['/', '/instalar', '/manifest.webmanifest', '/pwa/icon-180.png', '/pwa/icon-192.png', '/pwa/icon-512.png', '/pwa/maskable-512.png']) {
    assert.ok(wrangler.assets.run_worker_first.includes(path), path + ' missing from Worker routes')
  }
  assert.match(worker, /apple-touch-icon/)
  assert.match(worker, /apple-mobile-web-app-title/)
  assert.match(worker, /manifest.webmanifest/)
  assert.match(worker, /google-drive-site-asset/)
  assert.doesNotMatch(worker, /SUPABASE_SERVICE_ROLE_KEY/)
})
test('PWA identity can only be updated by master admin and stores no binaries in the database', () => {
  const migration = read('supabase/migrations/20261008231000_pwa_admin_settings.sql')
  assert.match(migration, /enable row level security/)
  assert.match(migration, /for select to anon, authenticated/)
  assert.match(migration, /for update to authenticated/)
  assert.match(migration, /p.role = 'admin'/)
  assert.match(migration, /grant update \(name,short_name/)
  assert.doesNotMatch(migration, /grant (?:insert|delete) on public.pwa_settings to anon/)
  assert.doesNotMatch(migration, /bytea/)
})
