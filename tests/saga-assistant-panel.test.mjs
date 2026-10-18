import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'

const read = path => readFileSync(new URL('../' + path, import.meta.url), 'utf8')

test('Saga admin history queries the server with pagination and filters', () => {
  const view = read('src/pages/admin/AdminSagaAssistant.tsx')
  assert.match(view, /const PAGE_SIZE = 25/)
  assert.match(view, /count: 'exact'/)
  assert.match(view, /\.range\(page \* PAGE_SIZE, \(page \+ 1\) \* PAGE_SIZE - 1\)/)
  assert.match(view, /\.order\('created_at', \{ ascending: false \}\)/)
  assert.match(view, /\.order\('id', \{ ascending: false \}\)/)
  assert.match(view, /query\.eq\('event_type', 'daily_digest'\)/)
  assert.match(view, /query\.eq\('status', status\)/)
  assert.match(view, /query\.gte\('created_at', startOfDay\(from\)\)/)
  assert.match(view, /query\.lt\('created_at', startOfNextDay\(to\)\)/)
  assert.match(view, /processed_at/)
  assert.match(view, /event\.message/)
})

test('Saga is visible only through admin-only route and menu', () => {
  const routes = read('src/AppV2.tsx')
  const menu = read('src/layouts/AdminLayout.tsx')
  assert.match(routes, /path="saga" element=\{<AdminPermissionGate adminOnly><Navigate to="\/admin\/whatsapp" replace \/>/)
  assert.match(menu, /label:'Saga · Central Operacional', href:'\/admin\/whatsapp'.*adminOnly:true/)
  assert.match(read('src/lib/adminDashboardLayout.ts'), /id:'saga'.*href:'\/admin\/whatsapp'/)
  assert.match(read('src/lib/adminDashboardLayout.ts'), /shortcuts:\['clients','projects','payments','services','academy','messages','site','saga'\]/)
})

test('Saga UI cannot activate the server processor or WhatsApp', () => {
  const view = read('src/pages/admin/AdminSagaAssistant.tsx')
  assert.doesNotMatch(view, /sagamente_assistant_tick\(/)
  assert.doesNotMatch(view, /cron\.schedule\(/)
  assert.match(view, /\.update\(\{ internal_notifications: internal, digest_times: hours\.sort\(\), updated_at:/)
  assert.doesNotMatch(view, /\.update\(\{\s*enabled:/)
  assert.doesNotMatch(view, /\.update\(\{\s*whatsapp_notifications:/)
})

test('Saga SQL grants only preferences, not activation columns, to authenticated', () => {
  const migration = read('supabase/migrations/20261016173621_saga_restrict_settings_update_columns.sql')
  assert.match(migration, /revoke update on table public\.sagamente_assistant_settings from authenticated/i)
  assert.match(migration, /grant update \(internal_notifications, digest_times, updated_at\)/i)
  assert.doesNotMatch(migration, /grant update \([^)]*enabled/i)
  assert.doesNotMatch(migration, /grant update \([^)]*whatsapp_notifications/i)
})


test('Saga database requires an active admin on all sensitive RLS operations', () => {
  const sql = read('supabase/migrations/20261016220127_saga_active_admin_rls.sql')
  for (const policy of [
    'sagamente_assistant_settings_admin_select',
    'sagamente_assistant_settings_admin_update',
    'sagamente_assistant_events_admin_select',
  ]) {
    const block = sql.match(new RegExp('alter policy "' + policy + '"[\\s\\S]*?;', 'i'))
    assert.ok(block, 'missing RLS policy ' + policy)
    assert.match(block[0], /p\.role\s*=\s*'admin'\s+and\s+p\.status\s*=\s*'active'/i)
    assert.match(block[0], /p\.id\s*=\s*\(select auth\.uid\(\)\)/i)
  }
  const update = sql.match(/alter policy "sagamente_assistant_settings_admin_update"[\s\S]*?;/i)
  assert.match(update[0], /with check\s*\(/i)
  assert.equal((update[0].match(/p\.status\s*=\s*'active'/gi) || []).length, 2)
  assert.doesNotMatch(sql, /\b(?:grant|create\s+trigger|cron\.schedule|set\s+enabled|whatsapp_notifications\s*=)\b/i)
})
