import test from 'node:test'
import assert from 'node:assert/strict'
import {readFile} from 'node:fs/promises'
const sql=await readFile(new URL('../supabase/migrations/20260929180000_transactional_event_communications.sql',import.meta.url),'utf8')
test('payment, enrollment and project completion emit transactional notifications',()=>{
 assert.match(sql,/payment_confirmed/); assert.match(sql,/academy_enrollment/); assert.match(sql,/project_completed/)
})
test('event notifications are idempotent and project completion closes CRM follow-up',()=>{
 assert.match(sql,/n\.metadata->>'payment_id'=new\.id::text/)
 assert.match(sql,/n\.metadata->>'enrollment_id'=new\.id::text/)
 assert.match(sql,/n\.metadata->>'project_id'=new\.id::text/)
 assert.match(sql,/stage='delivered',next_action=null,next_action_at=null/)
})
