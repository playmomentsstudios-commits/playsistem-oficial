import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const migration = await readFile(
  new URL('../supabase/migrations/20261011040000_restrict_order_stock_release_rpc.sql', import.meta.url),
  'utf8',
);

test('order stock release is no longer executable through client roles', () => {
  assert.match(migration, /revoke execute on function public\.release_order_stock\(uuid\) from public, anon, authenticated/i);
  assert.doesNotMatch(migration, /grant execute .* to anon|grant execute .* to authenticated/i);
});
