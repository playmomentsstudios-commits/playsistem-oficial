import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';

const read = name => readFileSync(new URL('../supabase/migrations/'+name,import.meta.url),'utf8');
const schema = read('20261017102000_saga_owner_brief_whatsapp.sql');
const cron = read('20261017102100_saga_owner_brief_inactive_cron.sql');

test('personal Saga flow is separate from RKC and disabled by default',()=>{
 assert.match(schema,/saga_owner_brief_settings[\s\S]*?enabled boolean not null default false/i);
 assert.match(schema,/lower\(p\.email\)='eufedesigner@gmail\.com'/);
 assert.match(schema,/saga_owner_brief_projects/);
 assert.match(schema,/lower\(title\) like 'sagamente%'/);
 assert.match(schema,/project_type='design'/);
 assert.doesNotMatch(schema,/rkc_felipe|automation_enqueue_for_flow/i);
});

test('Saga only uses already authorized WhatsApp; rechecks before bridge claim',()=>{
 for(const word of ['public.wa_bridge_customer_eligible','notify_project_updates',
 'wa_automatic_opt_in','wa_opt_in_at','wa_opt_in_phone',
 'saga_owner_brief_claim_allowed','saga_owner_brief_run_id',
 'wa_bridge_delivery_mode','app.wa_bridge_auto_enabled']){
  assert.ok(schema.includes(word),'Missing preflight: '+word);
 }
 assert.match(schema,/app\.wa_bridge_delivery_mode in \('consented_clients','single_client'\)/);
 assert.match(schema,/controls\.dispatch_enabled is false/);
 assert.match(schema,/r\.status='queued'/);
});

test('database function is backend-only, unique per day and slot',()=>{
 assert.match(schema,/unique\(local_day,slot,recipient_user_id\)/i);
 assert.match(schema,/revoke all on function public\.saga_owner_brief_tick\(boolean\) from public,anon,authenticated/i);
 assert.match(schema,/v_clock = any\(cfg\.digest_times\)/i);
 assert.match(schema,/v_clock in \('07:00','13:00','19:00'\)/i);
 assert.match(schema,/return jsonb_build_object\('status','duplicate'/i);
});

test('maintain old claim function unchanged except guarded new branch',()=>{
 assert.match(schema,/pg_get_functiondef\('public\.wa_bridge_claim\(uuid\)'::regprocedure\)/i);
 assert.match(schema,/if position\(anchor in f\)=0 then/i);
 assert.match(schema,/raise exception 'wa_bridge_claim changed/i);
 assert.match(schema,/o\.event_type=''saga_owner_brief''/i);
 assert.doesNotMatch(schema,/create or replace function public\.wa_bridge_claim\(/i);
});

test('internal notice and WhatsApp outbox are separate and truthful',()=>{
 assert.match(schema,/insert into public\.notifications\(user_id,type,title,message,link,metadata\)/i);
 assert.match(schema,/insert into public\.whatsapp_message_outbox\(notification_id,recipient_user_id/i);
 assert.match(schema,/no_active_admin/);
 assert.match(schema,/Concluídas no cadastro/);
 assert.match(schema,/Minhas prioridades sugeridas/);
});

test('cron exists but must start off',()=>{
 assert.match(cron,/cron\.schedule\('saga-owner-brief-minute','\* \* \* \* \*'/);
 assert.match(cron,/cron\.alter_job\(job_id=>jid,active=>false\)/);
 assert.match(cron,/active=false/);
 assert.doesNotMatch(cron,/cron\.unschedule|wa_bridge_claim/i);
});
