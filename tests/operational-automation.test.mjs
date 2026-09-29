import test from 'node:test'
import assert from 'node:assert/strict'
import {readFile} from 'node:fs/promises'
const sql=await readFile(new URL('../supabase/migrations/20260929173000_operational_automation_engine.sql',import.meta.url),'utf8')
test('daily automation covers overdue CRM, rental alerts and expired holds',()=>{
 assert.match(sql,/next_action_at<=now\(\)/)
 assert.match(sql,/release_expired_rental_holds\(\)/)
 assert.match(sql,/sync_rental_operational_notifications\(\)/)
 assert.match(sql,/type='crm_follow_up'/)
})
test('daily automation is idempotent per recipient/customer/day and records run',()=>{
 assert.match(sql,/n\.created_at::date=current_date/)
 assert.match(sql,/unique\(job_key,run_key\)/)
 assert.match(sql,/on conflict\(job_key,run_key\) do update/)
})
