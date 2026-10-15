import test from 'node:test'
import assert from 'node:assert/strict'
import {readFileSync} from 'node:fs'
import {PGlite} from '@electric-sql/pglite'

test('Real SQL fulfillment requires verified payment/email, delivers both combo formats and is idempotent',async()=>{
 const db=new PGlite()
 const user='10000000-0000-4000-8000-000000000001'
 const work='20000000-0000-4000-8000-000000000001'
 const purchase='30000000-0000-4000-8000-000000000001'
 const ebook='40000000-0000-4000-8000-000000000001'
 const audio='40000000-0000-4000-8000-000000000002'
 try{
  await db.exec(`
   create role anon; create role authenticated; create role service_role;
   create schema auth;
   create function auth.uid() returns uuid language sql as $$ select null::uuid $$;
   create table auth.users(id uuid primary key,email text,email_confirmed_at timestamptz);
   create function public.is_active_admin() returns boolean language sql as $$ select false $$;
   create table public.site_landing_pages(id uuid primary key,status text,published_at timestamptz,cta_href text,updated_at timestamptz);
   create table public.academy_library_works(id uuid primary key,release_code text,landing_page_id uuid);
   create table public.academy_library_items(id uuid primary key,work_id uuid,format text,status text);
   create table public.academy_library_grants(id uuid default gen_random_uuid() primary key,item_id uuid,user_id uuid,source text,active boolean,unique(item_id,user_id));
  `)
  const migration=readFileSync(new URL('../supabase/migrations/20261015160000_academy_direct_pix_purchases.sql',import.meta.url),'utf8')
  await db.exec(migration)
  await db.exec(migration) // Re-applying preserves the configuration and ACLs.
  const fix=readFileSync(new URL('../supabase/migrations/20261015163012_academy_purchase_complete_formats.sql',import.meta.url),'utf8')
  await db.exec(fix)
  await db.exec(fix)
  await db.query('insert into auth.users(id,email) values($1,$2)',[user,'buyer@example.com'])
  await db.query('insert into academy_library_works(id,release_code) values($1,$2)',[work,'01'])
  await db.query('insert into academy_library_items(id,work_id,format,status) values($1,$2,$3,$4)',[ebook,work,'ebook','published'])
  await db.query(`insert into academy_work_purchases(id,work_id,user_id,buyer_email,requested_format,amount_cents,provider_order_nsu,status)
   values($1,$2,$3,'buyer@example.com','combo',299,$1::uuid::text,'pending')`,[purchase,work,user])
  const fulfill=async()=> (await db.query('select academy_fulfill_verified_purchase($1) as result',[purchase])).rows[0].result
  assert.equal(await fulfill(),'not_paid')
  await db.query("update academy_work_purchases set status='paid_waiting_email' where id=$1",[purchase])
  assert.equal(await fulfill(),'waiting_email')
  // A verified user with a different email must not receive this purchase.
  await db.query("update auth.users set email='other@example.com',email_confirmed_at=now() where id=$1",[user])
  assert.equal(await fulfill(),'waiting_email')
  await db.query("update auth.users set email='buyer@example.com' where id=$1",[user])
  // An unavailable audiobook must roll back the ebook grant, leaving payment retryable.
  assert.equal(await fulfill(),'waiting_content')
  assert.equal((await db.query('select count(*)::int as count from academy_library_grants')).rows[0].count,0)
  await db.query('insert into academy_library_items(id,work_id,format,status) values($1,$2,$3,$4)',[audio,work,'audiobook','published'])
  await db.query("insert into academy_library_grants(item_id,user_id,source,active) values($1,$2,'gift',false)",[ebook,user])
  assert.equal(await fulfill(),'fulfilled')
  assert.equal(await fulfill(),'already_fulfilled')
  const grants=(await db.query('select source,active from academy_library_grants order by item_id')).rows
  assert.deepEqual(grants,[{source:'gift',active:true},{source:'purchase',active:true}])
  const acl=(await db.query(`select
   has_function_privilege('anon','academy_fulfill_verified_purchase(uuid)','execute') as anon_fulfill,
   has_function_privilege('authenticated','academy_fulfill_verified_purchase(uuid)','execute') as customer_fulfill,
   has_function_privilege('service_role','academy_fulfill_verified_purchase(uuid)','execute') as backend_fulfill,
   has_table_privilege('authenticated','academy_work_purchases','update') as customer_update,
   (select checkout_enabled from academy_infinitepay_settings where id) as enabled`)).rows[0]
  assert.deepEqual(acl,{anon_fulfill:false,customer_fulfill:false,backend_fulfill:true,customer_update:false,enabled:false})
  // A second paid order is delivered by the actual email-confirmation trigger.
  await db.query('update auth.users set email_confirmed_at=null where id=$1',[user])
  const second='30000000-0000-4000-8000-000000000002'
  await db.query(`insert into academy_work_purchases(id,work_id,user_id,buyer_email,requested_format,amount_cents,provider_order_nsu,status)
   values($1,$2,$3,'buyer@example.com','ebook',99,$1::uuid::text,'paid_waiting_email')`,[second,work,user])
  await db.query('update auth.users set email_confirmed_at=now() where id=$1',[user])
  assert.equal((await db.query('select status from academy_work_purchases where id=$1',[second])).rows[0].status,'fulfilled')
 }finally{await db.close()}
})
