import assert from 'node:assert/strict'
import {readFileSync} from 'node:fs'
import test from 'node:test'
const read=path=>readFileSync(new URL('../'+path,import.meta.url),'utf8')
test('Adding a missing format passes the existing work id, never creates a duplicate collection',()=>{
 const list=read('src/components/academy/AdminAcademyWorks.tsx')
 const editor=read('src/components/academy/AdminAcademyLibrary.tsx')
 assert.match(list,/function editor\(id\?:string,format\?:LibraryFormat,work\?:AdminLibraryWork\)/)
 assert.match(list,/if\(work\)next\.set\('group',work\.release_code\)/)
 assert.match(list,/onClick=\{\(\)=>editor\(undefined,format,w\)\}/)
 assert.match(editor,/const groupCode=params\.get\('group'\)/)
 assert.match(editor,/setGroup\(groupCode\)/)
 assert.match(editor,/release_code:groupCode/)
 assert.match(editor,/next\.delete\('group'\)/)
})
