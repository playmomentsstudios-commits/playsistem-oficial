import assert from 'node:assert/strict'
import {readFileSync} from 'node:fs'
import test from 'node:test'

const read=path=>readFileSync(new URL('../'+path,import.meta.url),'utf8')
const sql=read('supabase/migrations/20261010235500_whatsapp_stage_notification_deeplinks.sql')
const events=read('supabase/migrations/20261010235000_project_stage_detail_and_notifications.sql')
const admin=read('src/pages/admin/AdminWhatsappCenter.tsx')

test('auto WhatsApp includes a full, clickable HTTPS link to dynamic stage',()=>{
  assert.match(sql,/create or replace function public\.wa_bridge_claim\(p_instance uuid\)/)
  assert.match(sql,/v_row\.event_type in \('project_task','project_stage'\)/)
  assert.match(sql,/v_row\.target_link ~ '\^\/app\/projetos\//)
  assert.match(sql,/https:\/\/playsistem-oficial\.playmomentsstudios\.workers\.dev/)
  assert.match(sql,/Abrir etapa:/)
  assert.match(sql,/Acompanhar projeto:/)
  assert.match(sql,/v_body:=v_body\|\|E'/)
  assert.ok(sql.includes("})?$' then"),'the SQL path validation must have its closing quote and THEN')
  assert.doesNotMatch(sql,/end \$\$; then/,'a SQL function must not be truncated')
  assert.match(events,/\'\/app\/projetos\/\'\|\|new\.project_id::text\|\|\'\/etapas\/\'\|\|new\.id::text/)
  assert.match(events,/new\.stage_id::text/)
})

test('QR pilot still enforces test phone, opt-in, rate limit and freshness',()=>{
  assert.match(sql,/cfg\.wa_bridge_test_only then cfg\.wa_bridge_test_phone/)
  assert.match(sql,/cfg\.wa_bridge_daily_limit/)
  assert.match(sql,/o\.created_at>=cfg\.wa_bridge_auto_started_at/)
  assert.match(sql,/cfg\.wa_bridge_test_only or coalesce\(pref\.wa_automatic_opt_in,false\)/)
  assert.match(sql,/bridge\.connected_phone is distinct from cfg\.wa_bridge_sender_phone/)
  assert.match(sql,/v_row\.target_link ~ '\^\/app\/projetos\//)
})

test('manual WhatsApp still includes the same stage target',()=>{
  assert.match(admin,/safeUrl\(item\.target_link\)/)
  assert.match(admin,/Acompanhar:/)
})
