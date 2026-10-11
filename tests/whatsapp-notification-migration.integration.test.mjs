import assert from 'node:assert/strict'
import {readFileSync} from 'node:fs'
import test from 'node:test'
import {PGlite} from '@electric-sql/pglite'

const migration=readFileSync(new URL('../supabase/migrations/20261011160000_whatsapp_project_notification_copy.sql',import.meta.url),'utf8')
const projectId='11111111-1111-4111-8111-111111111111'
const customerId='22222222-2222-4222-8222-222222222222'
const taskId='33333333-3333-4333-8333-333333333333'
const stageId='44444444-4444-4444-8444-444444444444'
const reviewFileId='55555555-5555-4555-8555-555555555555'
const previousFileId='66666666-6666-4666-8666-666666666666'
const revisedFileId='77777777-7777-4777-8777-777777777777'
const compactPath='/n/abcdefghijklmnopqrstuv'

const schema=`
create role anon;
create role authenticated;
create schema app_private;
create table public.profiles(id uuid primary key, role text, status text);
create table public.projects(id uuid primary key, title text, project_type text, customer_id uuid);
create table public.project_customer_access(project_id uuid, customer_id uuid);
create table public.notifications(id uuid primary key, user_id uuid, type text, metadata jsonb);
create table public.tasks(id uuid primary key, title text, stage_id uuid, project_id uuid, client_visible boolean);
create table public.project_stages(id uuid primary key, name text, project_id uuid, client_visible boolean);
create table public.client_files(
 id uuid primary key, project_id uuid, task_id uuid, stage_id uuid, client_visible boolean,
 storage_provider text, drive_file_id text, name text, external_url text,
 version_group_id uuid, version_number integer, created_at timestamptz default now(),
 supersedes_file_id uuid
);
create table public.file_reviews(file_id uuid, action text);
create table public.whatsapp_message_outbox(
 id uuid primary key, source text, status text, event_type text, notification_id uuid,
 recipient_user_id uuid, target_link text, message_body text
);
insert into public.profiles values ('${customerId}','customer','active');
insert into public.projects values ('${projectId}','Projeto Aurora','service','${customerId}');
insert into public.project_customer_access values ('${projectId}','${customerId}');
insert into public.tasks values ('${taskId}','Banner principal','${stageId}','${projectId}',true);
insert into public.project_stages values ('${stageId}','Identidade visual','${projectId}',true);
`

async function makeDatabase(){
 const db=new PGlite()
 await db.exec(schema)
 await db.exec(migration)
 await db.exec(`
   create trigger whatsapp_copy_test after insert on public.whatsapp_message_outbox
   for each row execute function app_private.wa_add_file_link_to_outbox();
 `)
 return db
}
let db
test.before(async()=>{db=await makeDatabase()})
test.after(async()=>{await db?.close()})

let seq=0
async function emit({type,status,eventType=type,metadata={}}){
 const id='88888888-8888-4888-8888-'+String(++seq).padStart(12,'0')
 const notificationId='99999999-9999-4999-8999-'+String(seq).padStart(12,'0')
 await db.query('insert into public.notifications values ($1,$2,$3,$4)',[
  notificationId,customerId,type,JSON.stringify({project_id:projectId,status,...metadata})
 ])
 await db.query(`insert into public.whatsapp_message_outbox
  (id,source,status,event_type,notification_id,recipient_user_id,target_link,message_body)
  values ($1,'live','ready_manual',$2,$3,$4,$5,'')`,[
   id,eventType,notificationId,customerId,compactPath
  ])
 const result=await db.query('select message_body from public.whatsapp_message_outbox where id=$1',[id])
 return result.rows[0].message_body
}

test('project-start event generates the project-started WhatsApp copy in the outbox only',async()=>{
 const body=await emit({type:'project_status',status:'active'})
 assert.match(body,/🚀 \*Projeto iniciado\*/)
 assert.match(body,/Projeto \*Projeto Aurora\*/)
 assert.match(body,/https:\/\/playsistem-oficial\.playmomentsstudios\.workers\.dev\/n\/abcdefghijklmnopqrstuv/)
 assert.doesNotMatch(body,/tarefa|responsável|painel do cliente/i)
})

test('completed stage event includes its visible stage and project names',async()=>{
 const body=await emit({type:'project_stage',status:'completed',metadata:{stage_id:stageId}})
 assert.match(body,/✅ \*Etapa concluída\*/)
 assert.match(body,/Etapa: \*Identidade visual\*/)
 assert.match(body,/Projeto: \*Projeto Aurora\*/)
})

test('review event includes the material and project context',async()=>{
 await db.query(`insert into public.client_files
  (id,project_id,client_visible,storage_provider,drive_file_id,name)
  values ($1,$2,true,'google_drive','drive-file-id-123456','Banner para revisão')`,[reviewFileId,projectId])
 const body=await emit({type:'file_review_requested',status:'review',metadata:{file_id:reviewFileId}})
 assert.match(body,/🔎 \*Revisão disponível\*/)
 assert.match(body,/Material: \*Banner para revisão\*/)
 assert.match(body,/Projeto: \*Projeto Aurora\*/)
})

test('replacement after a requested change is labeled adjustments complete',async()=>{
 await db.query(`insert into public.client_files
  (id,project_id,client_visible,storage_provider,drive_file_id,name)
  values ($1,$2,true,'google_drive','drive-file-old-123456','Banner versão anterior')`,[previousFileId,projectId])
 await db.query('insert into public.file_reviews values ($1,\'changes_requested\')',[previousFileId])
 await db.query(`insert into public.client_files
  (id,project_id,client_visible,storage_provider,drive_file_id,name,supersedes_file_id)
  values ($1,$2,true,'google_drive','drive-file-new-123456','Banner revisado',$3)`,[revisedFileId,projectId,previousFileId])
 const body=await emit({type:'file_available',status:'available',metadata:{file_id:revisedFileId}})
 assert.match(body,/🛠️ \*Ajustes concluídos\*/)
 assert.match(body,/Material: \*Banner revisado\*/)
})

test('completed project event generates final-delivery copy',async()=>{
 const body=await emit({type:'project_status',status:'completed'})
 assert.match(body,/🎉 \*Entrega final disponível\*/)
 assert.match(body,/Projeto \*Projeto Aurora\*/)
})

test('ineligible event status stays unchanged, preserving the existing queue gate',async()=>{
 const body=await emit({type:'project_status',status:'active',eventType:'internal_audit'})
 assert.equal(body,'')
})
