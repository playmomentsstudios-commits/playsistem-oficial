import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
const read=(f)=>readFileSync(new URL('../'+f,import.meta.url),'utf8');
const schema=read('supabase/migrations/20261016231411_saga_owner_auto_whatsapp.sql');
const dedupe=read('supabase/migrations/20261016231756_saga_ops_slot_dedupe.sql');
test('Saga has a distinct consenting owner flow and does not reuse RKC',()=>{
 assert.match(schema,/event_key,recipient_user_id,enabled/i);
 assert.match(schema,/'saga_personal_ops'/);
 assert.match(schema,/lower\(p\.email\)='eufedesigner@gmail\.com'/);
 assert.match(schema,/public\.wa_bridge_customer_eligible\(p\.id\)/);
 assert.match(schema,/on conflict\(event_key\) do nothing/i);
 assert.doesNotMatch(schema,/'rkc_felipe'/);
});
test('only configured 07, 13, 19 slots with retry window and disabled cron',()=>{
 assert.match(schema,/v_hour not in \(7,13,19\)/);
 assert.match(schema,/v_minute>=20/);
 assert.match(schema,/=any\(cfg\.digest_times\)/);
 assert.match(schema,/cfg\.enabled is distinct from true/);
 assert.match(schema,/cfg\.whatsapp_notifications is distinct from true/);
 assert.match(schema,/cron\.schedule\('saga-owner-ops-minute','\* \* \* \* \*'/);
 assert.match(schema,/cron\.alter_job\(job_id=>v_id,active=>false\)/);
 assert.match(schema,/grant execute on function public\.saga_ops_run_tick\(timestamptz\) to service_role/);
});
test('reuse audited transport controls, avoid direct outbox inserts',()=>{
 assert.match(schema,/automation_enqueue_for_flow\('saga_personal_ops'/);
 assert.doesNotMatch(schema,/insert into public\.whatsapp_message_outbox/i);
 assert.doesNotMatch(schema,/create or replace function public\.wa_bridge_claim/i);
 assert.doesNotMatch(schema,/insert into public\.notifications/i);
 assert.match(schema,/b\.heartbeat_at<now\(\)-interval '35 seconds'/);
});
test('existing event key prevents content-conflict redelivery after edits',()=>{
 assert.match(dedupe,/where idempotency_key=v_key/);
 assert.match(dedupe,/return jsonb_build_object\('status','already_recorded','key',v_key\)/);
 assert.match(dedupe,/v_key:='sagaops_'\|\|to_char\(v_local,'YYYYMMDD_HH24'\)/);
});
test('summary uses task records with deadlines, priorities and a truthful label',()=>{
 assert.match(schema,/from public\.tasks/);
 assert.match(schema,/due_date=v_day/);
 assert.match(schema,/due_date<v_day/);
 assert.match(schema,/status='completed'/);
 assert.match(schema,/priority when 'urgent'/);
 assert.match(schema,/Preparei o fechamento/);
 assert.match(schema,/Nenhuma tarefa pendente identificada/);
});
