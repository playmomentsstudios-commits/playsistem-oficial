import test from 'node:test'
import assert from 'node:assert/strict'
import {readFileSync} from 'node:fs'
import {PGlite} from '@electric-sql/pglite'
const migration=readFileSync(new URL('../supabase/migrations/20261015152132_rkc_checkin_schedule.sql',import.meta.url),'utf8')
const f='11111111-1111-4111-8111-111111111111',p='22222222-2222-4222-8222-222222222222'
const schema=`create role anon;create role authenticated;create role service_role bypassrls;
create function public.current_user_is_admin() returns boolean language sql as $$select false$$;
create table public.automation_flows(id uuid primary key,event_key text,enabled boolean);
create table public.projects(id uuid primary key,title text);
create table public.tasks(project_id uuid,title text,due_date date,status text,position integer,created_at timestamptz default now());
create table public.automation_events(idempotency_key text unique,title text,body text,source_payload jsonb,notification_id uuid);
create table public.notifications(id uuid primary key,metadata jsonb);
create function public.automation_enqueue_for_flow(text,text,text,text) returns jsonb language plpgsql as $$begin
 insert into public.automation_events(idempotency_key,title,body) values($2,$3,$4);return jsonb_build_object('status','queued');end$$;
create schema cron;create table cron.job(jobname text unique,schedule text,command text);
create function cron.schedule(text,text,text) returns bigint language plpgsql as $$begin
 insert into cron.job values($1,$2,$3);return 1;end$$;
insert into public.automation_flows values('${f}','rkc_felipe',true);
insert into public.projects values('${p}','RKC — Captação, Seleção e Gestão de Editais 2026–2027');
insert into public.tasks(project_id,title,due_date,status,position)values
('${p}','Portfólio','2026-10-16','pending',1),('${p}','Concluída','2026-10-15','completed',2);
`
test('scheduled slots use Brasilia, exclude Sunday/off-hours and never duplicate',async()=>{
 const db=new PGlite();try{
  await db.exec(schema);await db.exec(migration)
  const tick=async(at,dispatch=true)=>(await db.query('select app_private.rkc_checkin_tick($1,$2) as result',[at,dispatch])).rows[0].result.slots
  for(const at of ['2026-10-15T11:00:00Z','2026-10-15T16:00:00Z','2026-10-15T21:00:00Z','2026-10-17T11:00:00Z']){
   const rows=await tick(at,false);assert.equal(rows.length,1);assert.match(rows[0].result.message,/Portfólio/);assert.doesNotMatch(rows[0].result.message,/Concluída/)
  }
  for(const at of ['2026-10-18T11:00:00Z','2026-10-15T12:00:00Z','2026-10-15T16:01:00Z'])assert.equal((await tick(at)).length,0)
  assert.equal((await db.query('select count(*)::int as n from public.automation_events')).rows[0].n,0)
  assert.equal((await tick('2026-10-15T16:00:00Z'))[0].result.status,'queued')
  assert.equal((await tick('2026-10-15T16:00:00Z'))[0].duplicate,true)
  assert.equal((await db.query('select count(*)::int as n from public.automation_events')).rows[0].n,1)
  await db.exec('update public.automation_flows set enabled=false')
  assert.equal((await tick('2026-10-15T21:00:00Z')).length,0)
  for(const role of ['anon','authenticated']){await db.exec('set role '+role);await assert.rejects(()=>tick('2026-10-15T21:00:00Z'),/permission denied/);await db.exec('reset role')}
 }finally{await db.close()}
})
