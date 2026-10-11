import test from 'node:test'
import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'

const migration = await readFile(new URL('../supabase/migrations/20261011050000_secure_file_review_rpc_grants.sql', import.meta.url), 'utf8')

test('file review SECURITY DEFINER RPCs are executable only by authenticated and trusted server roles', () => {
  for (const signature of [
    'public.submit_file_review(uuid, text, text)',
    'public.submit_file_review_v2(uuid, text, text, text, jsonb, jsonb)',
  ]) {
    const escaped = signature.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
    assert.match(migration, new RegExp(`revoke all on function ${escaped} from public, anon\\s*;`, 'i'))
    assert.match(migration, new RegExp(`grant execute on function ${escaped} to authenticated, service_role\\s*;`, 'i'))
  }
})
