import test from 'node:test'
import assert from 'node:assert/strict'
import {make,buyer,work,purchase,instance,purchaseWelcomeMigration as migration} from './helpers/academy-whatsapp-db.mjs'

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
