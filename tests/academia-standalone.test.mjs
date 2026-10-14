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


test('Standalone Academy shows only functional catalog categories',()=>{
 const catalog=read('src/pages/customer/AcademyCatalogPage.tsx')
 assert.match(catalog,/const standalone=import\.meta\.env\.MODE==='academy'/)
 assert.match(catalog,/\{!standalone&&<nav aria-label="Filtrar formato"/)
 assert.match(catalog,/Seus e-books e audiobooks estão na aba Biblioteca/)
 assert.match(catalog,/standalone\?'Explore cursos e videoaulas disponíveis/)
})

test('Academy resumes owned audiobooks with the unchanged native player progress key',()=>{
 const app=read('src/academy/standalone.tsx')
 const reader=read('src/pages/customer/AcademyLibraryItemPage.tsx')
 assert.match(app,/resumable = useMemo/)
 assert.match(app,/sagamente\.library\.position\./)
 assert.match(app,/item\.format === 'audiobook'/)
 assert.match(app,/Retomar audiobook/)
 assert.match(reader,/sagamente\.library\.position\./)
 assert.match(reader,/onTimeUpdate=\{saveAudioPosition\}/)
})

test('Certificate links have a valid in-app route, and password help goes to the real main site',()=>{
 const app=read('src/academy/standalone.tsx')
 assert.match(app,/Route path="\/certificados\/:code" element=\{<CertificateVerify\/>\}/)
 assert.match(app,/CertificateVerifyPage/)
 assert.match(app,/https:\/\/playsistem-oficial\.playmomentsstudios\.workers\.dev\/esqueci-senha/)
 assert.match(app,/rel="noopener noreferrer"/)
 assert.match(app,/\/pwa\/icon-192\.png/)
})


test('Premium Academy visual system covers login, home, library, courses and account without mock data',()=>{
 const app=read('src/academy/standalone.tsx')
 const css=read('src/academy/academy.css')
 for(const name of ['academy-login','academy-featured','academy-library-grid','academy-media-card','academy-course-card','academy-profile-card','academy-tabbar']){
  assert.match(app,new RegExp(name))
  assert.match(css,new RegExp('\\.'+name))
 }
 assert.match(css,/--ac-orange:/)
 assert.match(css,/@media\(max-width:420px\)/)
 assert.match(css,/@media\(prefers-reduced-motion:reduce\)/)
 assert.match(app,/const paths: Record<IconName,string>/)
 assert.match(app,/function ContentArtwork/)
 assert.doesNotMatch(app,/<img[^>]*src="https:\/\/images\./)
})

test('Standalone premium redesign preserves the existing media readers and scoped styling',()=>{
 const app=read('src/academy/standalone.tsx')
 const css=read('src/academy/academy.css')
 const worker=read('worker/academy-standalone.js')
 assert.match(app,/import\('\.\.\/pages\/customer\/AcademyLibraryItemPage'\)/)
 assert.match(app,/import\('\.\.\/pages\/customer\/AcademyCoursePage'\)/)
 assert.match(app,/academyLibraryApi\.mine\(\)/)
 assert.match(app,/academyApi\.myCourses\(\)/)
 assert.match(app,/sagamente\.library\.position\./)
 assert.match(app,/className="academy-reader"/)
 assert.match(css,/\.academy-reader :is\(iframe,video\)/)
 assert.match(worker,/academy-library-media\?ticket=/)
 assert.doesNotMatch(css,/@import '.*http/)
})
