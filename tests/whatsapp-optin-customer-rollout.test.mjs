import assert from 'node:assert/strict'
import {readFileSync} from 'node:fs'
import test from 'node:test'

const sql=readFileSync(new URL('../supabase/migrations/20261010235000_wa_optin_real_recipient_rollout.sql',import.meta.url),'utf8')
const component=readFileSync(new URL('../src/components/admin/WhatsappQrBridgePanel.tsx',import.meta.url),'utf8')
const prefs=readFileSync(new URL('../src/pages/customer/CustomerSettings.tsx',import.meta.url),'utf8')

test('opt-in records subscriber number and never carries consent to a new number',()=>{
  assert.match(sql,/wa_opt_in_phone text/)
  assert.match(sql,/wa_opt_in_at timestamptz/)
  assert.match(sql,/create trigger user_preferences_wa_consent_guard/)
  assert.match(sql,/new.wa_opt_in_phone:=old.wa_opt_in_phone/)
  assert.match(sql,/new.wa_opt_in_phone:=v_phone/)
  assert.match(sql,/pref.wa_opt_in_phone=/)
  assert.match(prefs,/Posso retirar o aceite a qualquer momento/)
})

test('admins cannot accidentally enable real delivery to unconsenting customers',()=>{
  assert.match(sql,/wa_bridge_delivery_mode in \('self_test','single_client','consented_clients'\)/)
  assert.match(sql,/wa_bridge_customer_eligible\(p_customer_id\)/)
  assert.match(sql,/wa_bridge_auto_enabled=false,wa_bridge_auto_started_at=null/)
  assert.match(sql,/if cfg.wa_bridge_delivery_mode='single_client'/)
  assert.match(sql,/not public.wa_bridge_customer_eligible\(cfg.wa_bridge_single_customer_id\)/)
  assert.match(sql,/wa_bridge_single_customer_id/)
  assert.match(component,/Ativar para este cliente/)
  assert.match(component,/Pausar envios/)
})
test('single-client mode is mandatory before all-consented rollout',()=>{
  assert.match(sql,/if p_mode='consented_clients' and not exists/)
  assert.match(sql,/a.status='sent' and a.test_mode=false/)
  assert.match(component,/disabled={!trialAccepted}/)
  assert.match(component,/selecione um cliente|Escolha primeiro um cliente/)
})
test('worker claim rechecks current consent, phone, and project membership at send time',()=>{
  assert.match(sql,/o.created_at>=cfg.wa_bridge_auto_started_at/)
  assert.match(sql,/public.wa_bridge_customer_eligible\(o.recipient_user_id\)/)
  assert.match(sql,/o.destination_phone=\(select pref.wa_opt_in_phone/)
  assert.match(sql,/select 1 from public.project_customer_access/)
  assert.match(sql,/o.recipient_user_id=cfg.wa_bridge_single_customer_id/)
  assert.match(sql,/p.project_type<>'internal'/)
  assert.match(sql,/v_used>=cfg.wa_bridge_daily_limit/)
  assert.match(sql,/for update of o skip locked/)
})
test('the official sender number stays separate and legacy pilot remains available',()=>{
  assert.match(sql,/cfg.wa_bridge_delivery_mode='self_test' then cfg.wa_bridge_test_phone else v_row.destination_phone/)
  assert.match(sql,/test_mode/)
  assert.match(component,/Somente o meu WhatsApp \(teste\)/)
  assert.match(component,/biblioteca|NÃO OFICIAL/)
})
