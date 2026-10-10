import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import test from 'node:test'

const sql=readFileSync(new URL('../supabase/migrations/20261010190000_zero_cost_priority_alerts.sql',import.meta.url),'utf8')
const admin=readFileSync(new URL('../src/pages/admin/AdminSettings.tsx',import.meta.url),'utf8')
const history=readFileSync(new URL('../src/components/admin/PriorityAlertHistory.tsx',import.meta.url),'utf8')

test('priority alerts only fire for confirmed production Asaas and project milestones',()=>{
  assert.match(sql,/new\.status='paid'/)
  assert.match(sql,/new\.provider in \('asaas','asaas_checkout'\)/)
  assert.match(sql,/new\.environment='production'/)
  assert.match(sql,/new\.status='completed'/)
  assert.match(sql,/new\.status is distinct from old\.status|old\.status is distinct from new\.status/)
})

test('the zero-cost mode cannot enable automatic WhatsApp billing',()=>{
  assert.match(sql,/priority_whatsapp_mode text not null default 'manual'/)
  assert.match(sql,/priority_whatsapp_mode = 'manual'/)
  assert.match(sql,/priority_daily_limit between 0 and 10/)
  assert.match(history,/https:\/\/wa\.me\//)
  assert.doesNotMatch(history,/api\.whatsapp\.com\/messages|graph\.facebook\.com|sendMessage\(/)
  assert.match(admin,/WhatsApp em modo manual/)
})

test('server-side idempotency and daily cap protect the admin inbox',()=>{
  assert.match(sql,/event_key text primary key/)
  assert.match(sql,/for update/)
  assert.match(sql,/v_today_count>=cfg\.priority_daily_limit/)
  assert.match(sql,/on conflict \(event_key\) do nothing/)
  assert.match(sql,/time zone 'America\/Sao_Paulo'/)
  assert.match(sql,/priority_alert_log_admin_read/)
})
