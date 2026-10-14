import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
const read=path=>readFileSync(new URL('../'+path,import.meta.url),'utf8')

test('Academia Sagamente has independent installable PWA identity and entry point',()=>{
 const html=read('academy-app/index.html')
 const config=read('vite.academia.config.ts')
 const worker=read('worker/academy-standalone.js')
 const wrangler=JSON.parse(read('wrangler.academia.jsonc'))
 assert.match(html,/academia-manifest\.webmanifest/)
 assert.match(html,/\/main\.tsx/)
 assert.match(config,/dist-academia/)
 assert.equal(wrangler.name,'academia-sagamente')
 assert.equal(wrangler.assets.not_found_handling,'single-page-application')
 assert.match(worker,/id:'\/academia-sagamente'/)
 assert.match(worker,/name:'Academia Sagamente'/)
 assert.match(worker,/start_url:'\/',scope:'\/'/)
 assert.match(read('package.json'),/"build:academia"/)
})

test('Dedicated app uses the shared account, real courses and safe private library readers',()=>{
 const src=read('src/academy/standalone.tsx')
 assert.match(src,/useAuth/)
 assert.match(src,/academyLibraryApi\.mine\(\)/)
 assert.match(src,/academyApi\.myCourses\(\)/)
 assert.match(src,/import\('\.\.\/pages\/customer\/AcademyLibraryItemPage'\)/)
 assert.match(src,/import\('\.\.\/pages\/customer\/AcademyCoursePage'\)/)
 assert.match(src,/to="\/app\/academia\/biblioteca"/)
 assert.match(src,/path="\/app\/academia\/biblioteca\/:id"/)
 assert.match(src,/path="\/app\/academia\/:id"/)
 assert.match(src,/const \{ isAuthenticated, isLoading \} = useAuth\(\)/)
 assert.match(src,/isAuthenticated\) return <Navigate to="\/login"/)
})

test('New worker never stores private media and validates tickets for GET/HEAD',()=>{
 const worker=read('worker/academy-standalone.js')
 assert.match(worker,/uuid\.test\(token\)/)
 assert.match(worker,/academy-library-media\?ticket=/)
 assert.match(worker,/request\.headers\.get\('Range'\)/)
 assert.match(worker,/Cache-Control':'private, no-store/)
 assert.match(worker,/request\.method==='HEAD'\?/)
 assert.match(worker,/Never cache authenticated HTML, media, PDF, video, tickets/)
 assert.match(worker,/env\.ASSETS\.fetch\(request\)/)
 assert.doesNotMatch(worker,/GOOGLE_DRIVE_REFRESH_TOKEN|service_role/)
})

test('Main platform remains unchanged, with separate manifest and deployment configs',()=>{
 const manifest=JSON.parse(read('public/manifest.webmanifest'))
 const main=JSON.parse(read('wrangler.jsonc'))
 assert.equal(main.name,'playsistem-oficial')
 assert.equal(manifest.short_name,'Sagamente')
 const nav=read('src/components/academy/AcademyNavigation.tsx')
 assert.match(nav,/import\.meta\.env\.MODE==='academy'/)
})

test('Academy standalone CSS scans React views outside the Vite application root',()=>{
 const app=read('src/academy/main.tsx')
 const styles=read('src/academy/academy.css')
 assert.match(app,/import '\.\/academy\.css'/)
 assert.match(styles,/@import '\.\.\/index\.css'/)
 assert.match(styles,/@source '\.\.\/'/)
 assert.match(read('.github/workflows/academia-pwa.yml'),/node scripts\/check-academia-css\.mjs/)
})

test('Customer and administrator Academies both expose the install screen link',()=>{
 const component=read('src/components/academy/AcademyAppInstallCard.tsx')
 const customer=read('src/pages/customer/AcademyPage.tsx')
 const admin=read('src/pages/admin/AdminAcademy.tsx')
 assert.match(component,/https:\/\/academia-sagamente\.playmomentsstudios\.workers\.dev\//)
 assert.match(component,/Adicionar à Tela de Início/)
 assert.match(component,/Instalar aplicativo/)
 assert.match(customer,/<AcademyAppInstallCard\/>/)
 assert.match(admin,/<AcademyAppInstallCard admin\/>/)
})
