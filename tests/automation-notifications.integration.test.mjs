import test from 'node:test'
import assert from 'node:assert/strict'
import {readFileSync} from 'node:fs'
import {PGlite} from '@electric-sql/pglite'
const sql=readFileSync(new URL('../supabase/automation-notifications/001_schema.sql',import.meta.url),'utf8')
const admin=readFileSync(new URL('../supabase/automation-notifications/003_admin.sql',import.meta.url),'utf8')
const claim=readFileSync(new URL('../supabase/automation-notifications/002_claim.sql',import.meta.url),'utf8')
const uid='11111111-1111-4111-8111-111111111111'
const instance='22222222-2222-4222-8222-222222222222'
const fixture=`
create role anon; create role authenticated; create role service_role bypassrls;
create schema auth;
create function auth.uid() returns uuid language sql stable as $$select nullif(current_setting('test.user_id',true),'')::uuid$$;
create function public.current_user_is_admin() returns boolean language sql stable as $$select coalesce(current_setting('test.admin',true),'')='true'$$;
grant usage on schema auth to authenticated;

create table auth.users(id uuid primary key,email text);
create table public.profiles(id uuid primary key,role text,status text,phone text,email text);
create table public.notifications(id uuid primary key default gen_random_uuid(),user_id uuid,type text,title text,message text,link text,metadata jsonb);
create table public.whatsapp_message_outbox(id uuid primary key default gen_random_uuid(),notification_id uuid unique,recipient_user_id uuid,recipient_name text,destination_phone text,event_type text,title text,message_body text,target_link text,status text,source text,created_at timestamptz default now());
create table public.whatsapp_bridge_attempts(id uuid primary key default gen_random_uuid(),outbox_id uuid,instance_id uuid,destination_phone text,test_mode boolean,status text default 'claimed',provider_message_id text,error_reason text,ack_status text default 'unconfirmed',claimed_at timestamptz default now());
create table public.app_settings(id boolean,wa_bridge_auto_enabled boolean,wa_bridge_daily_limit integer,wa_bridge_auto_started_at timestamptz,wa_bridge_delivery_mode text,wa_bridge_test_only boolean,wa_bridge_test_phone text,wa_bridge_sender_phone text,wa_bridge_single_customer_id uuid);
create table public.whatsapp_bridge_state(id boolean,instance_id uuid,status text,requested_mode text,heartbeat_at timestamptz,connected_phone text);
create table public.user_preferences(user_id uuid,wa_opt_in_phone text);
create table public.projects(id uuid,project_type text,customer_id uuid);
create table public.project_customer_access(project_id uuid,customer_id uuid);
create table public.customer_onboarding_events(user_id uuid);
create function public.wa_bridge_customer_eligible(uuid) returns boolean language sql as $$select true$$;
insert into public.user_preferences values('${uid}','5562993241277');
insert into auth.users values('${uid}','eufedesigner@gmail.com');
insert into public.profiles values('${uid}','customer','active','+55 62 99324-1277','eufedesigner@gmail.com');
insert into public.app_settings values(true,true,30,now()-interval '1 hour','self_test',true,'5562993241277','5564981294186',null);
insert into public.whatsapp_bridge_state values(true,'${instance}','connected','connect',now(),'5564981294186');
`
async function make(){const db=new PGlite();await db.exec(fixture);
 for(const file of ['20261015145501_automation_notifications_v1.sql','20261015145753_automation_notifications_service_permissions.sql','20261015145909_automation_notifications_admin.sql']) await db.exec(readFileSync(new URL('../supabase/migrations/'+file,import.meta.url),'utf8'))
 return db}
const emit=(db,key='rkc:test:001',message='Mensagem')=>db.query('select public.automation_enqueue($1,$2,$3) as result',[key,'Check-in',message]).then(x=>x.rows[0].result)
test('SQL seed, pause, activation, existing claim, receipt evidence and ACL',async()=>{
 const db=await make()
 try {
  assert.equal((await emit(db,'rkc:paused:001')).error_code,'flow_paused')
  await db.exec('update public.automation_flows set enabled=true')
  const queued=await emit(db);assert.equal(queued.status,'queued')
  assert.equal((await emit(db)).duplicate,true)
  await assert.rejects(()=>emit(db,'rkc:test:001','Changed'),/Idempotency conflict/)
  assert.equal((await db.query('select count(*)::int as n from public.whatsapp_message_outbox')).rows[0].n,1)
  const job=(await db.query(`select public.wa_bridge_claim('${instance}') as job`)).rows[0].job
  assert.equal(job.phone,'5562993241277');assert.match(job.message,/Mensagem/)
  await db.exec(`update public.whatsapp_bridge_attempts set status='sent',provider_message_id='provider-123',ack_status='server_ack'`)
  assert.equal((await db.query(`select delivery_status from public.automation_delivery_status where event_id='${queued.event_id}'`)).rows[0].delivery_status,'sent_unconfirmed')
  await db.exec(`update public.whatsapp_bridge_attempts set ack_status='delivered'`)
  assert.equal((await db.query(`select delivery_status from public.automation_delivery_status where event_id='${queued.event_id}'`)).rows[0].delivery_status,'delivered')
  assert.equal((await emit(db,'rkc:limited:001')).error_code,'automation_rate_limit')
  for(const role of ['anon','authenticated']) {
   await db.exec(`set role ${role}`)
   await assert.rejects(()=>emit(db,'rkc:denied:001'),/permission denied/)
   if(role==='anon') await assert.rejects(()=>db.query('select * from public.automation_flows'),/permission denied/)
   else assert.equal((await db.query('select * from public.automation_flows')).rows.length,0)
   await db.exec('reset role')
  }
 } finally {await db.close()}
})
test('preflight fails closed for offline, stale heartbeat, other destination and unrelated single customer mode',async()=>{
 const db=await make()
 try {
  await db.exec('update public.automation_flows set enabled=true')
  for(const [key,change] of [
   ['offline',`update public.whatsapp_bridge_state set status='offline'`],
   ['stale',`update public.whatsapp_bridge_state set status='connected',heartbeat_at=now()-interval '2 minutes'`],
   ['target',`update public.whatsapp_bridge_state set heartbeat_at=now();update public.app_settings set wa_bridge_test_phone='5562999999999'`],
   ['real',`update public.app_settings set wa_bridge_test_phone='5562993241277',wa_bridge_delivery_mode='single_client',wa_bridge_single_customer_id='33333333-3333-4333-8333-333333333333',wa_bridge_test_only=false`]
  ]) {await db.exec(change);assert.equal((await emit(db,`rkc:blocked:${key}`)).error_code,'bridge_preflight_failed')}
  assert.equal((await db.query('select count(*)::int as n from public.whatsapp_message_outbox')).rows[0].n,0)
 } finally {await db.close()}
})

test('installed production claim accepts only linked automation in consented mode',async()=>{
 const db=await make()
 try {
  await db.exec("update public.automation_flows set enabled=true;update public.app_settings set wa_bridge_delivery_mode='consented_clients',wa_bridge_test_only=false;")
  const queued=await emit(db);assert.equal(queued.status,'queued')
  const job=(await db.query(`select public.wa_bridge_claim('${instance}') as job`)).rows[0].job
  assert.equal(job.phone,'5562993241277');assert.equal(job.message,'Mensagem');assert.equal(job.test_only,false)
  await db.exec(`insert into public.notifications(user_id,type,title,message,metadata) values('${uid}','automation_check_in','Forged','Forged','{}')`)
  await db.exec(`insert into public.whatsapp_message_outbox(notification_id,recipient_user_id,destination_phone,event_type,message_body,status,source) select id,'${uid}','5562993241277','automation_check_in','Forged','ready_manual','live' from public.notifications where title='Forged'`)
  await db.exec("delete from public.whatsapp_bridge_attempts")
  assert.equal((await db.query(`select public.wa_bridge_claim('${instance}') as job`)).rows[0].job,null)
  await db.exec("insert into public.automation_credentials(name,token_sha256) values('rkc_felipe',encode(sha256(convert_to(repeat('a',48),'UTF8')),'hex'))")
  assert.equal((await db.query("select public.automation_authenticate(repeat('a',48)) as valid")).rows[0].valid,true)
  assert.equal((await db.query("select public.automation_authenticate(repeat('b',48)) as valid")).rows[0].valid,false)
 } finally {await db.close()}
})

test('service role sends without access to auth.users; admin CRUD stays guarded',async()=>{
 const db=await make()
 try {
  await db.exec("grant usage on schema public to service_role;grant select,insert,update on public.profiles,public.app_settings,public.notifications,public.whatsapp_message_outbox,public.whatsapp_bridge_state,public.whatsapp_bridge_attempts,public.user_preferences,public.projects,public.project_customer_access,public.customer_onboarding_events to service_role; update public.automation_flows set enabled=true;")
  await db.exec('set role service_role')
  await assert.rejects(()=>db.query('select * from auth.users'),/permission denied/)
  assert.equal((await emit(db,'rkc:service:001')).status,'queued')
  await db.exec('reset role;set role authenticated')
  await assert.rejects(()=>db.query("select public.automation_admin_save(null,'Manual','Título','Modelo',false)"),/Somente administradores/)
  await db.exec(`select set_config('test.user_id','${uid}',false);select set_config('test.admin','true',false)`)
  const id=(await db.query("select public.automation_admin_save(null,'Manual','Título','Modelo',false) as id")).rows[0].id
  assert.ok(id)
  assert.equal((await db.query('select count(*)::int as n from public.automation_flows')).rows[0].n,2)
  await db.query("select public.automation_admin_save($1,'Manual editada','Título','Modelo novo',true)",[id])
  await db.exec("reset role;update public.automation_events set created_at=now()-interval '3 minutes'")
  await db.exec('set role authenticated')
  const sent=(await db.query("select public.automation_admin_send($1,'Check-in manual',false,'rkc:admin:001') as result",[id])).rows[0].result
  assert.equal(sent.status,'queued')
 } finally {await db.close()}
})
