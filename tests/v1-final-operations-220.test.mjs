import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'

const migration=readFileSync(new URL('../supabase/migrations/20260929030000_v1_final_operational_polish.sql',import.meta.url),'utf8')
const project=readFileSync(new URL('../src/pages/admin/AdminProjectDetailV2.tsx',import.meta.url),'utf8')
const files=readFileSync(new URL('../src/pages/admin/AdminFilesV2.tsx',import.meta.url),'utf8')
const academy=readFileSync(new URL('../src/pages/admin/AdminAcademy.tsx',import.meta.url),'utf8')
const announcements=readFileSync(new URL('../src/pages/admin/AdminAnnouncements.tsx',import.meta.url),'utf8')
const landing=readFileSync(new URL('../src/pages/public/LandingPage.tsx',import.meta.url),'utf8')

test('master project deletion is protected and preserves Drive by design',()=>{
 assert.match(migration,/admin_delete_project/)
 assert.match(migration,/current_user_is_admin/)
 assert.match(project,/Digitar|Digite EXCLUIR|EXCLUIR/)
 assert.match(project,/Google Drive serão preservados/)
})

test('catalog conversion archives product instead of destroying history',()=>{
 assert.match(migration,/admin_convert_product_to_service/)
 assert.match(migration,/status='archived',active=false/)
})

test('announcements support targeted recipients',()=>{
 assert.match(migration,/selected_customers/)
 assert.match(migration,/academy_students/)
 assert.match(migration,/service_customers/)
 assert.match(announcements,/Quem deve receber/)
})

test('Drive organizer and academy thumbnails are present',()=>{
 assert.match(files,/Organizar em projeto/)
 assert.match(academy,/Capa aplicada/)
})

test('landing template is conversion focused',()=>{
 assert.match(landing,/page\.cta_href/)
 assert.match(landing,/section\.type==='proof'/)
 assert.match(landing,/section\.type==='faq'/)
 assert.doesNotMatch(landing,/PublicLayout/)
})
