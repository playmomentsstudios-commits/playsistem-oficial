import test from 'node:test'
import assert from 'node:assert/strict'
import {readFileSync} from 'node:fs'
const read=path=>readFileSync(new URL('../'+path,import.meta.url),'utf8')

test('Catalog groups Academy ebooks and audiobooks as protected digital products',()=>{
 const menu=read('src/layouts/AdminLayout.tsx')
 const routes=read('src/AppV2.tsx')
 const page=read('src/pages/admin/AdminCatalogDigitalMedia.tsx')
 const products=read('src/pages/admin/AdminProducts.tsx')
 const catalog=read('src/services/catalog.ts')
 assert.match(catalog,/ProductType = 'physical' \| 'digital'/)
 assert.match(menu,/E-books e audiobooks', href:'\/admin\/produtos-digitais', icon:'academy', adminOnly:true/)
 assert.match(routes,/path="produtos-digitais" element=\{<AdminPermissionGate adminOnly><AdminCatalogDigitalMedia/)
 assert.match(page,/academyLibraryAdminApi\.list\(\)/)
 assert.match(page,/formatLabel:Record<LibraryFormat,string>/)
 assert.match(page,/format==='ebook'/)
 assert.match(page,/\/admin\/academia\?section=library&create=ebook/)
 assert.match(page,/\/admin\/academia\?section=library&create=audiobook/)
 assert.match(page,/\/admin\/academia\?section=library&item=/)
 assert.match(products,/to="\/admin\/produtos-digitais"/)
 // Catalog visibility never bypasses the Academy's private Drive access rules.
 assert.doesNotMatch(page,/drive_file_id|academy_library_grants|public_url\(/)
 assert.doesNotMatch(page,/createProduct\(|createCartOrder\(|updateProduct\(/)
})

test('The catalog edits Academy originals instead of duplicating content',()=>{
 const academy=read('src/components/academy/AdminAcademyLibrary.tsx')
 assert.match(academy,/useSearchParams/)
 assert.match(academy,/params\.get\('item'\)/)
 assert.match(academy,/params\.get\('create'\)/)
 assert.match(academy,/if\(item\)open\(item\)/)
 assert.match(academy,/begin\(requestedFormat\)/)
 assert.match(academy,/next\.delete\('item'\)/)
 assert.match(academy,/next\.delete\('create'\)/)
})
