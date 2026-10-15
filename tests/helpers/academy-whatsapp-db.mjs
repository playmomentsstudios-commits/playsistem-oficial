import {readFileSync} from 'node:fs'
import {PGlite} from '@electric-sql/pglite'

const read=p=>readFileSync(new URL('../../'+p,import.meta.url),'utf8')
export const purchaseWelcomeMigration=read('supabase/migrations/20261015171835_academy_purchase_whatsapp_welcome.sql')
export const buyer='10000000-0000-4000-8000-000000000001'
export const work='20000000-0000-4000-8000-000000000001'
export const purchase='30000000-0000-4000-8000-000000000001'
export const instance='50000000-0000-4000-8000-000000000001'
const fixture=`
create role anon;create role authenticated;create role service_role bypassrls;
create schema auth;
create function auth.uid() returns uuid language sql as $$select nullif(current_setting('test.user_id',true),'')::uuid$$;
create function public.is_active_admin() returns boolean language plpgsql as $$begin return exists(select 1 from public.profiles where id=auth.uid() and role='admin' and status='active');end$$;
create table auth.users(id uuid primary key,email text,email_confirmed_at timestamptz);
create table public.profiles(id uuid primary key,first_name text,last_name text,email text,phone text,role text,status text);
create table public.user_preferences(user_id uuid primary key,wa_automatic_opt_in boolean,wa_opt_in_at timestamptz,wa_opt_in_phone text);
create table public.site_landing_pages(id uuid primary key,status text,published_at timestamptz,cta_href text,updated_at timestamptz);
create table public.academy_library_works(id uuid primary key,release_code text,title text,landing_page_id uuid);
create table public.academy_library_items(id uuid primary key,work_id uuid,format text,status text);
create table public.academy_library_grants(id uuid default gen_random_uuid() primary key,item_id uuid,user_id uuid,source text,active boolean,granted_at timestamptz default now(),unique(item_id,user_id));
create table public.notifications(id uuid primary key default gen_random_uuid(),user_id uuid,type text,title text,message text,link text,metadata jsonb);
create table public.whatsapp_message_outbox(id uuid primary key default gen_random_uuid(),notification_id uuid unique,recipient_user_id uuid,recipient_name text,destination_phone text,event_type text,title text,message_body text,target_link text,status text,source text,created_at timestamptz default now(),archived_at timestamptz,archived_by uuid);
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
export async function make(){
 const db=new PGlite()
 await db.exec(fixture)
 const consent=read('supabase/migrations/20261010235743_wa_optin_real_recipient_rollout.sql')
 const start=consent.indexOf('create or replace function public.wa_bridge_customer_eligible')
 const end=consent.indexOf('grant execute on function public.wa_bridge_customer_eligible',start)
 await db.exec(consent.slice(start,consent.indexOf(';',end)+1))
 for(const name of ['20261015160000_academy_direct_pix_purchases.sql','20261015163012_academy_purchase_complete_formats.sql'])
  await db.exec(read('supabase/migrations/'+name))
 await db.exec(purchaseWelcomeMigration)
 await db.exec(`insert into academy_work_purchases(id,work_id,user_id,buyer_email,requested_format,amount_cents,provider_order_nsu,status)
 values('${purchase}','${work}','${buyer}','buyer@example.com','audiobook',349,'${purchase}','pending')`)
 return db
}
