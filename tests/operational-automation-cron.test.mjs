import test from 'node:test'
import assert from 'node:assert/strict'
import {readFile} from 'node:fs/promises'
const sql=await readFile(new URL('../supabase/migrations/20260929174500_operational_automation_cron.sql',import.meta.url),'utf8')
test('system automation is private and scheduled daily',()=>{
 assert.match(sql,/revoke all on function public\.run_operational_automations_system\(\) from public/)
 assert.match(sql,/grant execute on function public\.run_operational_automations_system\(\) to service_role/)
 assert.match(sql,/play-moments-operational-daily/)
 assert.match(sql,/'15 9 \* \* \*'/)
})
test('system runner remains daily-idempotent',()=>{
 assert.match(sql,/n\.created_at::date=current_date/)
 assert.match(sql,/on conflict\(job_key,run_key\) do update/)
})
