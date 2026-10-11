import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const migration = await readFile(
  new URL('../supabase/migrations/20261011033800_restrict_project_backup_table_grants.sql', import.meta.url),
  'utf8',
);

test('backup table keeps RLS enabled and revokes every direct client privilege', () => {
  assert.match(migration, /enable row level security/i);
  assert.match(migration, /to_regclass\('public\.project_restructure_backups'\) is not null/i);
  assert.match(migration, /revoke all privileges on table public\.project_restructure_backups from anon, authenticated/i);
  assert.doesNotMatch(migration, /using\s*\(\s*true\s*\)/i);
  assert.doesNotMatch(migration, /grant .* to anon|grant .* to authenticated/i);
});
