import assert from 'node:assert/strict'
import {readFileSync} from 'node:fs'
import {spawnSync} from 'node:child_process'
import test from 'node:test'

const sql=readFileSync(new URL('../supabase/migrations/20261010233000_whatsapp_qr_local_bridge_pilot.sql',import.meta.url),'utf8')
const worker=new URL('../services/whatsapp-bridge/index.mjs',import.meta.url)
const script=readFileSync(worker,'utf8')
const ui=readFileSync(new URL('../src/components/admin/WhatsappQrBridgePanel.tsx',import.meta.url),'utf8')
const dashboard=readFileSync(new URL('../src/pages/admin/AdminWhatsappCenter.tsx',import.meta.url),'utf8')
const customer=readFileSync(new URL('../src/pages/customer/CustomerSettings.tsx',import.meta.url),'utf8')

test('Node bridge has valid standalone JavaScript syntax',()=>{
  const result=spawnSync(process.execPath,['--check',new URL(worker).pathname],{encoding:'utf8'})
  assert.equal(result.status,0,result.stderr)
})
test('automated messages are disabled until admin verifies QR and manually activates',()=>{
  assert.match(sql,/wa_bridge_auto_enabled boolean not null default false/)
  assert.match(sql,/wa_bridge_test_only boolean not null default true/)
  assert.match(sql,/wa_bridge_auto_started_at=now\(\)/)
  assert.match(sql,/bridge\.status<>'connected'/)
  assert.match(sql,/bridge\.connected_phone is distinct from cfg\.wa_bridge_sender_phone/)
  assert.match(ui,/Ativar piloto/)
  assert.match(ui,/QR Code/)
})
test('send claim enforces atomic daily cap and uses only new messages',()=>{
  assert.match(sql,/wa_bridge_daily_limit between 0 and 10/)
  assert.match(sql,/from public\.app_settings where id=true for update/)
  assert.match(sql,/v_used>=cfg\.wa_bridge_daily_limit/)
  assert.match(sql,/o\.created_at>=cfg\.wa_bridge_auto_started_at/)
  assert.match(sql,/o\.source='live'/)
  assert.match(sql,/o\.status='ready_manual'/)
  assert.match(sql,/for update of o skip locked/)
  assert.match(sql,/cfg\.wa_bridge_test_phone else v_row\.destination_phone/)
})
test('customer delivery requires recorded opt-in, while test number is isolated',()=>{
  assert.match(sql,/wa_automatic_opt_in boolean not null default false/)
  assert.match(sql,/cfg\.wa_bridge_test_only or coalesce\(pref\.wa_automatic_opt_in,false\)/)
  assert.match(customer,/wa_automatic_opt_in/)
  assert.match(script,/SAGAMENTE_WHATSAPP_PHONE/)
  assert.match(script,/phone!==expectedPhone/)
})
test('credentials stay on local host and no service role key reaches the website',()=>{
  assert.match(script,/process\.env\.SUPABASE_SERVICE_ROLE_KEY/)
  assert.match(script,/useMultiFileAuthState\(authDir\)/)
  assert.doesNotMatch(ui,/SUPABASE_SERVICE_ROLE_KEY/)
  assert.match(ui,/serviço Node/)
  assert.match(dashboard,/bridge_sent_today/)
  assert.match(sql,/grant execute on function public\.wa_bridge_claim\(uuid\) to service_role/)
})
test('bridge success is not confused with provider delivery receipts',()=>{
  assert.match(sql,/provider_delivered_today',0/)
  assert.match(sql,/provider_message_id/)
  assert.match(dashboard,/Aceitas no dispositivo hoje/)
  assert.match(dashboard,/entrega não comprovada/)
  assert.match(script,/entrega não confirmada/)
})
