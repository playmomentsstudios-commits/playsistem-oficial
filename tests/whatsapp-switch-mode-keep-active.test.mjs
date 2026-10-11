import assert from 'node:assert/strict'
import {readFileSync} from 'node:fs'
import test from 'node:test'

const sql=readFileSync(new URL('../supabase/migrations/20261011135000_wa_switch_delivery_mode_keep_active.sql',import.meta.url),'utf8')
const ui=readFileSync(new URL('../src/components/admin/WhatsappQrBridgePanel.tsx',import.meta.url),'utf8')

test('atomic mode switch reuses tested server safeguards',()=>{
 assert.match(sql,/current_user_is_admin\(\)/)
 assert.match(sql,/from public.app_settings where id=true for update/)
 assert.match(sql,/p_keep_enabled and not coalesce\(v_was_enabled,false\)/)
 assert.match(sql,/wa_bridge_set_delivery_mode\(p_mode,p_customer_id\)/)
 assert.match(sql,/wa_bridge_admin_control\('enable'\)/)
 assert.match(sql,/grant execute on function public.wa_bridge_save_delivery_mode/)
})
test('active delivery mode can be changed without manual pause',()=>{
 assert.match(ui,/const keepEnabled=enabled/)
 assert.match(ui,/wa_bridge_save_delivery_mode/)
 assert.match(ui,/p_keep_enabled:keepEnabled/)
 assert.match(ui,/Salvar modo e manter envios ativos/)
 assert.doesNotMatch(ui,/disabled=\{busy\|\|enabled\|\|\(choiceMode/)
 assert.match(ui,/window.confirm\(message\)/)
})
