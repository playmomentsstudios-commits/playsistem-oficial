import assert from 'node:assert/strict'
import {readFileSync} from 'node:fs'
import test from 'node:test'

const share=readFileSync(new URL('../src/lib/shareSagamenteApp.ts',import.meta.url),'utf8')
const route=readFileSync(new URL('../src/AppV2.tsx',import.meta.url),'utf8')
const page=readFileSync(new URL('../src/pages/public/DiscoverAppPage.tsx',import.meta.url),'utf8')
const settings=readFileSync(new URL('../src/pages/customer/CustomerSettings.tsx',import.meta.url),'utf8')
const dashboard=readFileSync(new URL('../src/pages/customer/DashboardPage.tsx',import.meta.url),'utf8')
const clientSeo=readFileSync(new URL('../src/components/RouteSeo.tsx',import.meta.url),'utf8')
const workerSeo=readFileSync(new URL('../worker/seo.js',import.meta.url),'utf8')
const wrangler=JSON.parse(readFileSync(new URL('../wrangler.jsonc',import.meta.url),'utf8'))

test('app invite is public, canonical, and contains no session or personal token',()=>{
  assert.match(share,/https:\/\/playsistem-oficial\.playmomentsstudios\.workers\.dev\/conheca-o-app/)
  assert.doesNotMatch(share,/\/app\/dashboard|userId|customer_id|access_token|authorization|auth\.admin/)
  assert.match(share,/encodeURIComponent\(SAGAMENTE_APP_INVITE_TEXT/)
  assert.match(share,/https:\/\/wa\.me\/\?text=/)
})

test('guest can read public introduction before opting into free registration',()=>{
  assert.match(route,/path="\/conheca-o-app" element=\{<DiscoverAppPage/)
  assert.match(page,/PublicLayout/)
  assert.match(page,/Serviços criativos e digitais/)
  assert.match(page,/Produtos e equipamentos/)
  assert.match(page,/Academia e treinamentos/)
  assert.match(page,/E-books e audiobooks/)
  assert.match(page,/Projetos, etapas e arquivos/)
  assert.match(page,/Pedidos, pagamentos e conversas/)
  assert.match(page,/\/cadastro\?next=%2Fapp%2Fdashboard/)
  assert.match(page,/isAuthenticated\?appPath:REGISTER_PATH/)
  assert.match(page,/Ao criar uma conta/)
  assert.doesNotMatch(page,/supabase\.from\('profiles'\)|supabase\.auth\./)
})

test('customer settings supports native share, WhatsApp, copied link and preview',()=>{
  assert.match(settings,/Compartilhar o aplicativo/)
  assert.match(settings,/navigator\.share\(/)
  assert.match(settings,/navigator\.clipboard\.writeText\(SAGAMENTE_APP_INVITE_URL\)/)
  assert.match(settings,/sagamenteWhatsAppInviteUrl\(\)/)
  assert.match(settings,/to="\/conheca-o-app"/)
  assert.match(settings,/readOnly/)
  assert.match(settings,/N[aã]o compartilha dados/)
})

test('empty dashboard offers catalog discovery and optional share',()=>{
  assert.match(dashboard,/data\.orders===0&&data\.projects===0&&data\.quotes===0&&data\.payments===0/)
  assert.match(dashboard,/to="\/servicos"/)
  assert.match(dashboard,/to="\/academia"/)
  assert.match(dashboard,/to="\/app\/configuracoes#compartilhar"/)
})

test('WhatsApp link previews can resolve indexed, public server-side OG metadata',()=>{
  assert.match(clientSeo,/\/conheca-o-app/)
  assert.match(workerSeo,/\/conheca-o-app/)
  assert.match(workerSeo,/const DEFAULT_SEO/)
  assert.match(workerSeo,/og_image_url:/)
  assert.ok(wrangler.assets.run_worker_first.includes('/conheca-o-app'))
  assert.match(workerSeo,/index,follow/)
  assert.match(workerSeo,/if\(!PUBLIC_SEO_ROUTES\.has\(path\)\)return null/)
})
