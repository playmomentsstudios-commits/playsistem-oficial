import assert from 'node:assert/strict'
import {readFileSync} from 'node:fs'
import test from 'node:test'

const sql=readFileSync(new URL('../supabase/migrations/20261010220000_file_review_notices_all_project_clients.sql',import.meta.url),'utf8')

test('file review request sends to all eligible linked customers',()=>{
  assert.ok(sql.includes('app_private.project_notice_recipients(f.project_id)'))
  assert.ok(sql.includes("customer_portal_notification_enabled(recipients.user_id,'file')"))
  assert.ok(sql.includes('recipients.user_id'))
  assert.ok(sql.includes("f.project_id is null and f.customer_id is not null"))
})
test('only primary client sees actionable approval wording',()=>{
  assert.ok(sql.includes('when recipients.user_id=f.customer_id'))
  assert.ok(sql.includes('Arquivo aguardando sua aprovação'))
  assert.ok(sql.includes('Uma versão do projeto foi enviada ao responsável para análise.'))
  assert.ok(sql.includes("public.current_user_has_permission('files.manage')"))
})
