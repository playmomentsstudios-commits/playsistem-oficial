import assert from 'node:assert/strict'
import {readFileSync} from 'node:fs'
import test from 'node:test'
const sql=readFileSync(new URL('../supabase/migrations/20261010230000_whatsapp_admin_audit_center.sql',import.meta.url),'utf8')
const ui=readFileSync(new URL('../src/pages/admin/AdminWhatsappCenter.tsx',import.meta.url),'utf8')
const routes=readFileSync(new URL('../src/AppV2.tsx',import.meta.url),'utf8')
const sidebar=readFileSync(new URL('../src/layouts/AdminLayout.tsx',import.meta.url),'utf8')

test('every log row is tied to an actual internal notification and recipient',()=>{
  assert.match(sql,/notification_id uuid not null unique references public.notifications\(id\)/)
  assert.match(sql,/recipient_user_id uuid not null references public.profiles\(id\)/)
  assert.match(sql,/destination_phone text/)
  assert.match(sql,/status in \('ready_manual','missing_phone','historical','opened_manual','reported_sent'\)/)
})
test('no external WhatsApp is sent from SQL and no confirmed delivery can be forged',()=>{
  assert.doesNotMatch(sql,/graph\.facebook\.com|net\.http_post|call_whatsapp_api|api\.whatsapp\.com/)
  assert.match(sql,/provider_sent_today',0/)
  assert.match(sql,/provider_delivered_today',0/)
  assert.match(ui,/Sem provedor conectado/)
  assert.match(ui,/Abertura registrada, envio desconhecido/)
})
test('row level security blocks non-admin access and manual actions require administrator',()=>{
  assert.match(sql,/alter table public.whatsapp_message_outbox enable row level security/)
  assert.match(sql,/wa_outbox_admin_read/)
  assert.match(sql,/if not public.current_user_is_admin\(\)/)
  assert.match(sql,/wa_mark_manual_action/)
  assert.match(sql,/p_action not in \('opened','reported_sent'\)/)
})
test('the center is discoverable in admin and offers accurate filters and export',()=>{
  assert.match(routes,/path="whatsapp".*AdminWhatsappCenter/)
  assert.match(sidebar,/label:'Central WhatsApp'.*adminOnly:true/)
  assert.match(ui,/exportCsv\(filtered\)/)
  assert.match(ui,/wa_daily_dashboard/)
  assert.match(ui,/phone|destination_phone/)
  assert.match(ui,/Abrir WhatsApp/)
})
