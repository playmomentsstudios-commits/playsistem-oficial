import test from 'node:test'
import assert from 'node:assert/strict'
import {readFileSync} from 'node:fs'

const source=path=>readFileSync(new URL('../'+path,import.meta.url),'utf8')

test('SAGA NEGRA library uses a private grant per item and hides Drive IDs from RPC responses',()=>{
 const migration=source('supabase/migrations/20261014120000_saga_negra_private_library_beta.sql')
 assert.match(migration,/academy_library_grants/)
 assert.match(migration,/g\.user_id=auth\.uid\(\)/)
 assert.match(migration,/i\.status IN \('private_beta','published'\)/)
 assert.match(migration,/REVOKE ALL ON FUNCTION public\.academy_my_library\(\) FROM PUBLIC/)
 assert.doesNotMatch(migration,/RETURNS TABLE\([^)]*drive_file_id/)
})

test('Streaming requires auth to issue a media ticket and checks grants after issuance',()=>{
 const fn=source('supabase/functions/academy-library-media/index.ts')
 assert.match(fn,/db\.auth\.getUser\(bearer\)/)
 assert.match(fn,/const item=await authorizedItem\(db,auth\.user\.id,itemId\)/)
 assert.match(fn,/const item=await authorizedItem\(db,ticket\.user_id,ticket\.item_id\)/)
 assert.match(fn,/\.eq\('active',true\)/)
 assert.match(fn,/Content-Range/)
 assert.match(fn,/status:206/)
 assert.match(fn,/ticket:ticket\.token/)
})

test('Only owned e-books/audiobooks are shown in Minha Academia; existing courses remain',()=>{
 const api=source('src/api/academyLibrary.ts')
 const page=source('src/pages/customer/AcademyPage.tsx')
 const reader=source('src/pages/customer/AcademyLibraryItemPage.tsx')
 const router=source('src/AppV2.tsx')
 assert.match(api,/rpc\('academy_my_library'\)/)
 assert.match(page,/<LibraryOwnedSection\/>/)
 assert.match(reader,/owned=rows\.find\(x=>x\.id===id\)/)
 assert.match(reader,/academyLibraryApi\.mediaTicket\(owned\.id\)/)
 assert.match(reader,/<audio/)
 assert.match(reader,/<iframe/)
 assert.match(router,/path="academia\/biblioteca\/:id"/)
})

test('Library media uses same-origin Worker bridge, preserving range and MIME',()=>{
 const worker=source('worker/pwa.js')
 const api=source('src/api/academyLibrary.ts')
 const page=source('src/pages/customer/AcademyLibraryItemPage.tsx')
 assert.match(worker,/academyMediaPath = '\/app\/academia\/midia'/)
 assert.match(worker,/if \(path === academyMediaPath\) return serveAcademyMedia\(request\)/)
 assert.match(worker,/apikey: publicAnonKey/)
 assert.match(worker,/upstreamHeaders\.set\('Range', range\)/)
 assert.match(worker,/\['audio\/mpeg', 'application\/pdf'\]/)
 assert.match(worker,/Cache-Control': 'private, no-store/)
 assert.match(api,/return \{url:'\/app\/academia\/midia\?ticket='/)
 assert.match(api,/typeof data\.ticket==='string'/)
 assert.doesNotMatch(api,/new URL\(data\.url\)/)
 assert.doesNotMatch(api,/upstream\.origin!==origin\.origin/)
 assert.match(page,/fetch\(media\.url,\{method:'HEAD',cache:'no-store'\}\)/)
 assert.match(page,/receivedType!==owned\.mime_type/)
})
