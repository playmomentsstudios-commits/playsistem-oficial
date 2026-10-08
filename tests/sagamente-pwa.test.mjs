import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
const read = path => readFileSync(new URL('../' + path, import.meta.url), 'utf8')
const manifest = JSON.parse(read('public/manifest.webmanifest'))

test('PWA manifest contains required app metadata and official PNG sizes', () => {
  assert.equal(manifest.id, '/')
  assert.equal(manifest.start_url, '/')
  assert.equal(manifest.display, 'standalone')
  assert.equal(manifest.short_name, 'Sagamente')
  for (const size of [192, 512]) {
    const icon = manifest.icons.find(icon => icon.sizes === size + 'x' + size && icon.purpose === 'any')
    assert.ok(icon)
    const png = readFileSync(new URL('../public' + icon.src, import.meta.url))
    assert.equal(png.subarray(1, 4).toString('ascii'), 'PNG')
    assert.equal(png.readUInt32BE(16), size)
    assert.equal(png.readUInt32BE(20), size)
  }
  assert.ok(manifest.icons.some(icon => icon.purpose === 'maskable'))
  assert.match(read('index.html'), /rel="manifest"/)
  assert.match(read('index.html'), /apple-touch-icon/)
})

test('service worker caches only public static resources', () => {
  const worker = read('public/sw.js')
  assert.match(worker, /request.mode === 'navigate'/)
  assert.match(worker, /fetch\(request\).catch/)
  assert.match(worker, /url.origin !== self.location.origin/)
  assert.match(worker, /url.pathname.startsWith\('\/assets\/'\)/)
  assert.match(read('public/offline.html'), /noindex,nofollow/)
})

test('installer is connected to the current website', () => {
  assert.match(read('src/main.tsx'), /registerPwa\(\)/)
  assert.match(read('src/lib/pwa.ts'), /import.meta.env.PROD/)
  assert.match(read('src/AppV2.tsx'), /path="\/instalar"/)
  assert.match(read('src/components/navigation/PublicHeader.tsx'), /Instalar app/)
  assert.match(read('src/pages/public/InstallPage.tsx'), /beforeinstallprompt/)
})
