import test from 'node:test'
import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'

const migration = await readFile(
  new URL('../supabase/migrations/20261011050000_restrict_customer_loyalty_recalc_rpc.sql', import.meta.url),
  'utf8',
)

test('customer loyalty recalculation is not executable by client roles', () => {
  assert.match(migration, /revoke execute on function public\.recalculate_customer_loyalty\(uuid\) from public, anon, authenticated/i)
  assert.doesNotMatch(migration, /grant execute .* to anon|grant execute .* to authenticated/i)
  assert.doesNotMatch(migration, /drop function|alter function/i)
})
