import test from 'node:test'
import assert from 'node:assert/strict'
import {readFileSync} from 'node:fs'
import {PGlite} from '@electric-sql/pglite'

const read=p=>readFileSync(new URL('../'+p,import.meta.url),'utf8')
const migration=read('supabase/migrations/20261015171835_academy_purchase_whatsapp_welcome.sql')
const buyer='10000000-0000-4000-8000-000000000001'
const work='20000000-0000-4000-8000-000000000001'
const purchase='30000000-0000-4000-8000-000000000001'
const instance='50000000-0000-4000-8000-000000000001'
const fixture=`
create role anon;create role authenticated;create role service_role bypassrls;
create schema auth;
create function auth.uid() returns uuid language sql as $$select null::uuid$$;
create function public.is_active_admin() returns boolean language sql as $$select false$$;
create table auth.users(id uuid primary key,email text,email_confirmed_at timestamptz);
create table public.profiles(id uuid primary key,first_name text,last_name text,email text,phone text,role text,status text);
create table public.user_preferences(user_id uuid primary key,wa_automatic_opt_in boolean,wa_opt_in_at timestamptz,wa_opt_in_phone text);
create table public.site_landing_pages(id uuid primary key,status text,published_at timestamptz,cta_href text,updated_at timestamptz);
create table public.academy_library_works(id uuid primary key,release_code text,title text,landing_page_id uuid);
create table public.academy_library_items(id uuid primary key,work_id uuid,format text,status text);
create table public.academy_library_grants(id uuid default gen_random_uuid() primary key,item_id uuid,user_id uuid,source text,active boolean,unique(item_id,user_id));
create table public.notifications(id uuid primary key default gen_random_uuid(),user_id uuid,type text,title text,message text,link text,metadata jsonb);
create table public.whatsapp_message_outbox(id uuid primary key default gen_random_uuid(),notification_id uuid unique,recipient_user_id uuid,recipient_name text,destination_phone text,event_type text,title text,message_body text,target_link text,status text,source text,created_at timestamptz default now());
create table public.whatsapp_bridge_attempts(id uuid primary key default gen_random_uuid(),outbox_id uuid,instance_id uuid,destination_phone text,test_mode boolean,status text default 'claimed',claimed_at timestamptz default now());
create table public.app_settings(id boolean,wa_bridge_auto_enabled boolean,wa_bridge_daily_limit integer,wa_bridge_auto_started_at timestamptz,wa_bridge_delivery_mode text,wa_bridge_test_only boolean,wa_bridge_test_phone text,wa_bridge_sender_phone text,wa_bridge_single_customer_id uuid);
create table public.whatsapp_bridge_state(id boolean,instance_id uuid,status text,requested_mode text,heartbeat_at timestamptz,connected_phone text);
create table public.projects(id uuid,project_type text,customer_id uuid);
create table public.project_customer_access(project_id uuid,customer_id uuid);
create table public.customer_onboarding_events(user_id uuid);
create table public.automation_flows(id uuid,enabled boolean,source text,recipient_user_id uuid);
create table public.automation_events(outbox_id uuid,notification_id uuid,status text,flow_id uuid);
insert into auth.users values('${buyer}','buyer@example.com',null);
insert into profiles values('${buyer}','Felipe','Costa','buyer@example.com','62993241277','customer','active');
insert into user_preferences values('${buyer}',true,now(),'5562993241277');
insert into academy_library_works values('${work}','01','O Direito de Descansar',null);
insert into academy_library_items values('40000000-0000-4000-8000-000000000001','${work}','audiobook','published');
insert into app_settings values(true,true,250,now()-interval '1 hour','consented_clients',false,'5562993241277','5564981294186',null);
insert into whatsapp_bridge_state values(true,'${instance}','connected','connect',now(),'5564981294186');
`
async function make(){
 const db=new PGlite()
 await db.exec(fixture)
 const consent=read('supabase/migrations/20261010235743_wa_optin_real_recipient_rollout.sql')
 const start=consent.indexOf('create or replace function public.wa_bridge_customer_eligible')
 const end=consent.indexOf('grant execute on function public.wa_bridge_customer_eligible',start)
 await db.exec(consent.slice(start,consent.indexOf(';',end)+1))
 for(const name of ['20261015160000_academy_direct_pix_purchases.sql','20261015163012_academy_purchase_complete_formats.sql'])
  await db.exec(read('supabase/migrations/'+name))
 await db.exec(migration)
 await db.exec(`insert into academy_work_purchases(id,work_id,user_id,buyer_email,requested_format,amount_cents,provider_order_nsu,status)
 values('${purchase}','${work}','${buyer}','buyer@example.com','audiobook',349,'${purchase}','pending')`)
 return db
}
const count=(db,table)=>db.query('select count(*)::int as n from '+table).then(r=>r.rows[0].n)
const retry=db=>db.query(`select app_private.academy_queue_purchase_welcome('${purchase}') as id`).then(r=>r.rows[0].id)
async function fulfill(db){
 await db.exec(`update academy_work_purchases set status='paid_waiting_email',paid_at=now(),provider_transaction_nsu='verified-transaction' where id='${purchase}';
 update auth.users set email_confirmed_at=now() where id='${buyer}'`)
}
const claim=db=>db.query(`select wa_bridge_claim('${instance}') as job`).then(r=>r.rows[0].job)

test('Real fulfillment and email trigger enqueue one purchase welcome; retries and migration replay do not duplicate',async()=>{
 const db=await make()
 try{
  assert.equal(await retry(db),null)
  await db.exec(`update academy_work_purchases set status='paid_waiting_email',paid_at=now(),provider_transaction_nsu='verified-transaction'`)
  assert.equal((await db.query(`select academy_fulfill_verified_purchase('${purchase}') as status`)).rows[0].status,'waiting_email')
  assert.equal(await count(db,'notifications'),0)
  await db.exec(`update auth.users set email_confirmed_at=now()`)
  assert.equal((await db.query('select status from academy_work_purchases')).rows[0].status,'fulfilled')
  assert.equal(await count(db,'academy_library_grants'),1)
  assert.equal(await count(db,'notifications'),1)
  assert.equal(await count(db,'whatsapp_message_outbox'),1)
  const id=await retry(db);assert.equal(await retry(db),id)
  await db.exec(migration)
  assert.equal(await count(db,'whatsapp_message_outbox'),1)
  const row=(await db.query('select * from whatsapp_message_outbox')).rows[0]
  assert.equal(row.event_type,'academy_purchase_ready')
  assert.equal(row.destination_phone,'5562993241277')
  assert.match(row.message_body,/Pagamento confirmado/)
  assert.match(row.message_body,/O Direito de Descansar/)
  assert.match(row.message_body,/academia-sagamente.*app\/academia/)
  await db.exec('delete from notifications')
  await retry(db)
  assert.equal(await count(db,'notifications'),0)
  assert.equal(await count(db,'app_private.academy_purchase_messages'),1)
 }finally{await db.close()}
})

test('No consent produces only an in-app notice and does not retroactively enqueue after a later opt-in',async()=>{
 const db=await make()
 try{
  await db.exec('update user_preferences set wa_automatic_opt_in=false')
  await fulfill(db)
  assert.equal(await count(db,'notifications'),1)
  assert.equal(await count(db,'whatsapp_message_outbox'),0)
  await db.exec('update user_preferences set wa_automatic_opt_in=true')
  await retry(db)
  assert.equal(await count(db,'whatsapp_message_outbox'),0)
 }finally{await db.close()}
})

test('Claim respects revoked consent, destination, offline bridge, pilot mode and limits; service role needs no auth.users access',async()=>{
 const db=await make()
 try{
  await fulfill(db)
  await db.exec('update user_preferences set wa_automatic_opt_in=false')
  assert.equal(await claim(db),null)
  await db.exec("update user_preferences set wa_automatic_opt_in=true;update whatsapp_message_outbox set destination_phone='5562999999999'")
  assert.equal(await claim(db),null)
  await db.exec("update whatsapp_message_outbox set destination_phone='5562993241277';update whatsapp_bridge_state set status='offline'")
  assert.equal(await claim(db),null)
  await db.exec("update whatsapp_bridge_state set status='connected',heartbeat_at=now();update app_settings set wa_bridge_delivery_mode='single_client',wa_bridge_single_customer_id='10000000-0000-4000-8000-000000000002'")
  assert.equal(await claim(db),null)
  await db.exec("update app_settings set wa_bridge_delivery_mode='consented_clients',wa_bridge_single_customer_id=null,wa_bridge_daily_limit=0")
  assert.equal(await claim(db),null)
  await db.exec("update app_settings set wa_bridge_daily_limit=250;grant usage on schema public to service_role;grant select,update on profiles,user_preferences,app_settings,whatsapp_bridge_state,whatsapp_message_outbox,notifications,academy_work_purchases,projects,project_customer_access,customer_onboarding_events,automation_events,automation_flows to service_role;grant select,insert on whatsapp_bridge_attempts to service_role;set role service_role")
  await assert.rejects(()=>db.query('select * from auth.users'),/permission denied/)
  const job=await claim(db)
  assert.equal(job.phone,'5562993241277');assert.equal(job.test_only,false)
  assert.equal(await claim(db),null)
  await db.exec('reset role')
  for(const role of ['anon','authenticated']){
   await db.exec('set role '+role)
   await assert.rejects(()=>retry(db),/permission denied/)
   await assert.rejects(()=>db.query('select * from app_private.academy_purchase_messages'),/permission denied/)
   await assert.rejects(()=>claim(db),/permission denied/)
   await db.exec('reset role')
  }
 }finally{await db.close()}
})

test('Forged purchase notices without the purchase ledger are not claimable; unpaid orders never create a welcome',async()=>{
 const db=await make()
 try{
  await db.exec("update auth.users set email_confirmed_at=now();update academy_work_purchases set status='fulfilled'")
  assert.equal(await count(db,'notifications'),0)
  await db.exec(`insert into notifications(user_id,type,metadata) values('${buyer}','academy_purchase_ready','{"purchase_id":"${purchase}"}');
   insert into whatsapp_message_outbox(notification_id,recipient_user_id,destination_phone,event_type,message_body,status,source)
   select id,'${buyer}','5562993241277','academy_purchase_ready','Forged','ready_manual','live' from notifications`)
  assert.equal(await claim(db),null)
 }finally{await db.close()}
})

test('The expanded production claim continues sending project, signup welcome and linked automation events',async()=>{
 const db=await make()
 try{
  const project='60000000-0000-4000-8000-000000000001'
  const flow='70000000-0000-4000-8000-000000000001'
  await db.exec(`insert into projects values('${project}','client','${buyer}');
   insert into customer_onboarding_events values('${buyer}');
   insert into automation_flows values('${flow}',true,'chatgpt','${buyer}');
   update profiles set email='eufedesigner@gmail.com'`)
  for(const kind of ['project_status','account_welcome','automation_check_in']){
   const notice=(await db.query('insert into notifications(user_id,type,title,metadata) values($1,$2,$2,$3::jsonb) returning id',[buyer,kind,JSON.stringify({project_id:project})])).rows[0].id
   const outbox=(await db.query(`insert into whatsapp_message_outbox(notification_id,recipient_user_id,destination_phone,event_type,message_body,status,source)
    values($1,$2,'5562993241277',$3,$3,'ready_manual','live') returning id`,[notice,buyer,kind])).rows[0].id
   if(kind==='automation_check_in')await db.query("insert into automation_events values($1,$2,'queued',$3)",[outbox,notice,flow])
   const job=await claim(db)
   assert.equal(job.phone,'5562993241277');assert.equal(job.message,kind)
   await db.exec('delete from whatsapp_bridge_attempts')
  }
 }finally{await db.close()}
})
