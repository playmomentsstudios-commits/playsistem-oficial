import test from 'node:test'
import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'

const migration = await readFile(
  new URL('../supabase/migrations/20261011060000_restrict_academy_refresh_enrollment.sql', import.meta.url),
  'utf8',
)

test('academy enrollment refresh explicitly rejects anonymous access', () => {
  assert.match(
    migration,
    /revoke execute on function public\.academy_refresh_enrollment\(uuid\) from public, anon/i,
  )
  assert.match(migration, /if auth\.uid\(\) is null then[\s\S]*?using errcode='42501'/i)
  assert.match(migration, /if auth\.uid\(\) <> e\.user_id and not public\.is_active_admin\(\)/i)
  assert.ok(migration.indexOf('if auth.uid() is null then') < migration.indexOf('select * into e'))
  assert.match(migration, /if auth\\.uid\\(\\) <> e\\.user_id and not public\\.is_active_admin\\(\\)/i)
  assert.ok(migration.indexOf('if auth.uid() is null then') < migration.indexOf('select * into e'))
  assert.doesNotMatch(migration, /grant execute .* to anon|grant execute .* to public/i)
})

test('academy enrollment refresh keeps the derived progress and completion event flow', () => {
  assert.match(migration, /update public\.course_enrollments/i)
  assert.match(migration, /insert into public\.academy_events/i)
  assert.match(migration, /insert into public\.notifications/i)
})
