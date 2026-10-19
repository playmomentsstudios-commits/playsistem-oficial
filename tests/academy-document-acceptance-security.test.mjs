import test from 'node:test'
import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'

const migration = await readFile(new URL('../supabase/migrations/20261011050200_secure_academy_document_acceptance.sql', import.meta.url), 'utf8')

test('academy document acceptance requires a non-null authenticated user and owner or active admin', () => {
  assert.match(migration, /if auth\.uid\(\) is null then[\s\S]*?using errcode='42501'/i)
  assert.match(migration, /s\.profile_id is distinct from auth\.uid\(\) and not public\.is_active_admin\(\)/i)
  assert.match(migration, /revoke all on function public\.academy_accept_document\(uuid\) from public, anon/i)
  assert.match(migration, /grant execute on function public\.academy_accept_document\(uuid\) to authenticated, service_role/i)
})
