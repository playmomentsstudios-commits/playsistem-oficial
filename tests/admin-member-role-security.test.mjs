import test from 'node:test'
import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'

const migration = await readFile(new URL('../supabase/migrations/20261011050100_secure_admin_set_member_role.sql', import.meta.url), 'utf8')

test('member-role RPC rejects anonymous callers before changing any profile', () => {
  assert.match(migration, /if auth\.uid\(\) is null then[\s\S]*?raise exception[\s\S]*?using errcode='42501'/i)
  assert.match(migration, /caller_role is distinct from 'admin'/i)
  assert.match(migration, /revoke all on function public\.admin_set_member_role\(uuid,\s*text\) from public, anon/i)
  assert.match(migration, /grant execute on function public\.admin_set_member_role\(uuid,\s*text\) to authenticated, service_role/i)
})
