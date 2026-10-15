import test from 'node:test'
import assert from 'node:assert/strict'
import {readFileSync} from 'node:fs'
import {make as purchaseDb,buyer,work,purchase,instance} from './helpers/academy-whatsapp-db.mjs'

const sql=readFileSync(new URL('../supabase/migrations/20261015173544_academy_manual_access_whatsapp.sql',import.meta.url),'utf8')
const admin='80000000-0000-4000-8000-000000000001'
const audio='40000000-0000-4000-8000-000000000001'
const book='40000000-0000-4000-8000-000000000002'
async function make(){
 const db=await purchaseDb()
 await db.exec(`alter table academy_library_items add column drive_file_id text default 'private-file';
  insert into academy_library_items(id,work_id,format,status) values('${book}','${work}','ebook','published');
  insert into auth.users(id,email,email_confirmed_at) values('${admin}','admin@example.com',now());
  insert into profiles(id,first_name,email,role,status) values('${admin}','Admin','admin@example.com','admin','active');
  select set_config('test.user_id','${admin}',false);`)
 await db.exec(sql)
 return db
}
const set=(db,items=[book,audio],active=true,user=buyer)=>db.query(
 'select academy_admin_set_library_access($1::uuid[],$2::uuid,$3) as result',[items,user,active]
).then(r=>r.rows[0].result)
const count=(db,table)=>db.query('select count(*)::int as n from '+table).then(r=>r.rows[0].n)
const claim=db=>db.query(`select wa_bridge_claim('${instance}') as job`).then(r=>r.rows[0].job)

test('A package is granted atomically with one non-payment WhatsApp; repeating active access is a no-op',async()=>{
 const db=await make()
 try{
  const first=await set(db)
  assert.equal(first.changed_count,2);assert.equal(first.whatsapp_queued,true)
  assert.equal(await count(db,'academy_library_grants'),2)
  assert.equal(await count(db,'notifications'),1)
  assert.equal(await count(db,'whatsapp_message_outbox'),1)
  assert.equal((await set(db)).changed_count,0)
  assert.equal(await count(db,'app_private.academy_manual_access_events'),1)
  const row=(await db.query('select * from whatsapp_message_outbox')).rows[0]
  assert.equal(row.event_type,'academy_access_granted')
  assert.match(row.message_body,/e-book e audiobook/)
  assert.match(row.message_body,/O Direito de Descansar/)
  assert.ok(row.message_body.includes('\n'))
  assert.doesNotMatch(row.message_body,/pagamento|compra confirmada/i)
  await db.exec(sql)
  assert.equal(await count(db,'whatsapp_message_outbox'),1)
  const job=await claim(db)
  assert.equal(job.phone,'5562993241277');assert.equal(job.test_only,false)
 }finally{await db.close()}
})

test('A partial package notifies only the newly granted format and preserves previous purchase provenance',async()=>{
 const db=await make()
 try{
  await db.exec(`insert into academy_library_grants(item_id,user_id,active,source) values('${audio}','${buyer}',true,'purchase')`)
  assert.equal((await set(db)).changed_count,1)
  const row=(await db.query('select message_body from whatsapp_message_outbox')).rows[0]
  assert.match(row.message_body,/Formato: \*e-book\*/)
  assert.doesNotMatch(row.message_body,/e-book e audiobook/)
  assert.equal((await db.query('select source from academy_library_grants where item_id=$1',[audio])).rows[0].source,'purchase')
 }finally{await db.close()}
})

test('Revocation cancels pending messages; reactivation emits one fresh event without reviving the old package',async()=>{
 const db=await make()
 try{
  await set(db)
  const revoke=await set(db,[book,audio],false)
  assert.equal(revoke.changed_count,2);assert.equal(revoke.whatsapp_queued,false)
  assert.equal(await count(db,'notifications'),1)
  assert.ok((await db.query('select archived_at from whatsapp_message_outbox')).rows[0].archived_at)
  assert.equal(await claim(db),null)
  const next=await set(db,[audio])
  assert.equal(next.changed_count,1);assert.equal(next.whatsapp_queued,true)
  assert.equal(await count(db,'app_private.academy_manual_access_events'),2)
  const job=await claim(db)
  assert.match(job.message,/Formato: \*audiobook\*/)
  assert.equal(await claim(db),null)
 }finally{await db.close()}
})

test('WhatsApp opt-out and unavailable content do not prevent access; later opt-in does not replay old events',async()=>{
 const db=await make()
 try{
  await db.exec('update user_preferences set wa_automatic_opt_in=false')
  const result=await set(db,[audio])
  assert.equal(result.changed_count,1);assert.equal(result.notification_status,'no_consent')
  assert.equal(await count(db,'notifications'),1)
  assert.equal(await count(db,'whatsapp_message_outbox'),0)
  await db.exec('update user_preferences set wa_automatic_opt_in=true')
  await set(db,[audio])
  assert.equal(await count(db,'whatsapp_message_outbox'),0)
  await db.exec(`update academy_library_items set status='draft' where id='${book}'`)
  assert.equal((await set(db,[book])).notification_status,'content_unavailable')
  assert.equal(await count(db,'academy_library_grants'),2)
  assert.equal(await count(db,'whatsapp_message_outbox'),0)
 }finally{await db.close()}
})

test('Only active admins may grant; invalid and mixed-work requests never create partial access',async()=>{
 const db=await make()
 try{
  await db.exec(`select set_config('test.user_id','${buyer}',false);set role authenticated`)
  await assert.rejects(()=>set(db),/Somente administradores/)
  await assert.rejects(()=>db.query('select * from app_private.academy_manual_access_events'),/permission denied/)
  await db.exec(`reset role;select set_config('test.user_id','${admin}',false);set role authenticated`)
  await assert.rejects(()=>set(db,[]),/Selecione/)
  await assert.rejects(()=>set(db,[book,book]),/mesma obra/)
  await db.exec('reset role')
  await db.exec(`insert into academy_library_works(id,release_code,title) values('20000000-0000-4000-8000-000000000002','02','Outra');
   update academy_library_items set work_id='20000000-0000-4000-8000-000000000002' where id='${book}'`)
  await assert.rejects(()=>set(db),/mesma obra/)
  assert.equal(await count(db,'academy_library_grants'),0)
  await db.exec(`update profiles set status='inactive' where id='${admin}'`)
  await assert.rejects(()=>set(db,[audio]),/Somente administradores/)
  await db.exec('set role anon')
  await assert.rejects(()=>set(db,[audio]),/permission denied/)
 }finally{await db.close()}
})

test('Manual messages must match their audit event, current grants, consent and destination',async()=>{
 const db=await make()
 try{
  await set(db,[audio])
  await db.exec("update user_preferences set wa_automatic_opt_in=false")
  assert.equal(await claim(db),null)
  await db.exec("update user_preferences set wa_automatic_opt_in=true;update whatsapp_message_outbox set destination_phone='5562999999999'")
  assert.equal(await claim(db),null)
  await db.exec("update whatsapp_message_outbox set destination_phone='5562993241277';update academy_library_grants set active=false")
  assert.equal(await claim(db),null)
  await db.exec(`insert into notifications(user_id,type,metadata) values('${buyer}','academy_access_granted','{}');
   insert into whatsapp_message_outbox(notification_id,recipient_user_id,destination_phone,event_type,message_body,status,source)
   select id,'${buyer}','5562993241277','academy_access_granted','Forged','ready_manual','live' from notifications where metadata='{}'::jsonb`)
  assert.equal(await claim(db),null)
 }finally{await db.close()}
})

test('The manual-access claim still dispatches the verified-purchase welcome through its separate audit ledger',async()=>{
 const db=await make()
 try{
  await db.exec(`update academy_work_purchases set status='paid_waiting_email',paid_at=now(),provider_transaction_nsu='verified-transaction' where id='${purchase}';
   update auth.users set email_confirmed_at=now() where id='${buyer}'`)
  assert.equal(await count(db,'app_private.academy_manual_access_events'),0)
  assert.equal(await count(db,'app_private.academy_purchase_messages'),1)
  const job=await claim(db)
  assert.equal(job.phone,'5562993241277')
  assert.match(job.message,/Pagamento confirmado/)
 }finally{await db.close()}
})
