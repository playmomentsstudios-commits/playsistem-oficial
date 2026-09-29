import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'

const permissions=readFileSync(new URL('../src/lib/staffPermissions.ts',import.meta.url),'utf8')
const layout=readFileSync(new URL('../src/layouts/AdminLayout.tsx',import.meta.url),'utf8')
const migration=readFileSync(new URL('../supabase/migrations/20260929021000_secondary_admin_collaborator_preset.sql',import.meta.url),'utf8')

test('secondary admin stays a staff preset without financial permissions',()=>{
  assert.match(permissions,/secondary_admin:'Admin secundário'/)
  const preset=permissions.match(/secondary_admin:\[([\s\S]*?)\],\n  custom:/)?.[1]||''
  assert.doesNotMatch(preset,/payments\./)
  assert.doesNotMatch(preset,/reports\.view/)
})

test('collaborator management and master settings remain admin-only',()=>{
  assert.match(layout,/label:'Colaboradores'.*adminOnly:true/)
  assert.match(layout,/label:'Configurações'.*adminOnly:true/)
  assert.match(layout,/user\?\.role==='admin'.*\/admin\/configuracoes/)
})

test('database accepts secondary_admin but collaborator persistence remains master-admin only',()=>{
  assert.match(migration,/'secondary_admin'/)
  assert.match(migration,/current_user_is_admin\(\)/)
  assert.match(migration,/set role='staff'/)
})
