import test from 'node:test'
import assert from 'node:assert/strict'
import {readFileSync} from 'node:fs'
const read=p=>readFileSync(new URL('../'+p,import.meta.url),'utf8')
const api=read('src/api/portal.ts')
const admin=read('src/pages/admin/AdminFilesV2.tsx')
const diag=read('supabase/functions/google-drive-test/index.ts')

test('Drive test displays the specific JSON error even with non-2xx status',()=>{
  assert.match(api,/functions\.invoke\('google-drive-test'\)/)
  assert.match(api,/context\?\.clone\?\.json\?\.\(\)/)
  assert.match(api,/details\.error/)
  assert.match(admin,/setDriveTestNotice\(\{ok:false,message\}\)/)
  assert.match(admin,/role=\{driveTestNotice\.ok\?'status':'alert'\}/)
  assert.match(admin,/setDriveTestNotice\(\{ok:true,message\}\)/)
  assert.match(admin,/firstError instanceof Error\?firstError\.message/)
})

test('test is read-only and checks Google authorization separately from folder access',()=>{
  assert.match(diag,/requireUser\(req\)/)
  assert.match(diag,/requireStaff\(ctx\)/)
  assert.match(diag,/await getDriveAccessToken\(\)/)
  assert.match(diag,/googleapis\.com\/drive\/v3\/about/)
  assert.match(diag,/root_folder_id,clients_folder_id/)
  assert.match(diag,/getReader|checkFolder/)
  assert.match(diag,/folder_inaccessible/)
  assert.match(diag,/oauth_rejected/)
  assert.match(diag,/GOOGLE_DRIVE_REFRESH_TOKEN/)
  assert.match(diag,/missing_configuration/)
  assert.doesNotMatch(diag,/ensureDriveRoot|createDriveFolder/)
  assert.doesNotMatch(diag,/\.update\(|\.insert\(|\.delete\(/)
})

test('diagnostic does not expose token or secrets through response',()=>{
  assert.match(diag,/Autorização Google e pastas da Sagamente verificadas/)
  assert.match(diag,/redirect: "manual"/)
  assert.match(diag,/code: "connected"/)
  assert.doesNotMatch(diag,/return json\(\{[^\n]*token/)
  assert.doesNotMatch(diag,/console\.log/)
})
