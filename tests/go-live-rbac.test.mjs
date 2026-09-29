import test from 'node:test'
import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'

const permissions=await readFile(new URL('../src/lib/staffPermissions.ts',import.meta.url),'utf8')
const app=await readFile(new URL('../src/AppV2.tsx',import.meta.url),'utf8')
const adminLayout=await readFile(new URL('../src/layouts/AdminLayout.tsx',import.meta.url),'utf8')

test('staff permission model keeps admin bypass and explicit permissions',()=>{
 assert.match(permissions,/role==='admin'/)
 assert.match(permissions,/current\.includes\('\*'\)/)
 assert.match(permissions,/academy\.content\.manage/)
 assert.match(permissions,/academy:\[/)
})

test('sensitive admin governance routes remain admin-only',()=>{
 for(const route of ['equipe','configuracoes','auditoria','landings']){
  assert.match(app,new RegExp(`path="${route}"[^\n]*adminOnly`))
 }
})

test('staff navigation hides admin-only items and filters by permission',()=>{
 assert.match(adminLayout,/if\(item\.adminOnly\)return false/)
 assert.match(adminLayout,/hasStaffPermission\(user\?\.role,staffPermissions,item\.permission\)/)
})

test('customer and admin route families remain separated',()=>{
 assert.match(app,/path="\/app"/)
 assert.match(app,/path="\/admin"/)
 assert.match(app,/CustomerLayoutV2/)
 assert.match(app,/AdminLayout/)
})
