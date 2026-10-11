import assert from 'node:assert/strict'
import {readFileSync} from 'node:fs'
import test from 'node:test'
import {PGlite} from '@electric-sql/pglite'

const firstMigration=readFileSync(new URL('../supabase/migrations/20261011160000_whatsapp_project_notification_copy.sql',import.meta.url),'utf8')
const scopeMigration=readFileSync(new URL('../supabase/migrations/20261011204700_whatsapp_status_folder_scope.sql',import.meta.url),'utf8')
const projectId='11111111-1111-4111-8111-111111111111'
const customerId='22222222-2222-4222-8222-222222222222'
const taskId='33333333-3333-4333-8333-333333333333'
const stageId='44444444-4444-4444-8444-444444444444'
const compactPath='/n/abcdefghijklmnopqrstuv'
const folderIds={received:'received-folder-123',preview:'preview-folder-123',approved:'approved-folder-123'}
const fileIds={received:'received-file-123456',preview:'preview-file-123456',approved:'approved-file-123456'}

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
create table public.project_drive_folders(project_id uuid, drive_folder_id text, folder_kind text);
create table public.client_files(
 id uuid primary key, project_id uuid, task_id uuid, stage_id uuid, client_visible boolean,
 storage_provider text, drive_file_id text, drive_folder_id text, drive_folder_kind text, name text, external_url text,
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
insert into public.project_drive_folders values
 ('${projectId}','${folderIds.received}','received'),
 ('${projectId}','${folderIds.preview}','preview'),
 ('${projectId}','${folderIds.approved}','approved');
insert into public.client_files
 (id,project_id,task_id,stage_id,client_visible,storage_provider,drive_file_id,drive_folder_id,drive_folder_kind,name)
values
 ('55555555-5555-4555-8555-555555555555','${projectId}','${taskId}','${stageId}',true,'google_drive','${fileIds.received}','${folderIds.received}-nested','received','Arquivo recebido'),
 ('66666666-6666-4666-8666-666666666666','${projectId}','${taskId}','${stageId}',true,'google_drive','${fileIds.preview}','${folderIds.preview}-nested','preview','Arquivo para revisão'),
 ('77777777-7777-4777-8777-777777777777','${projectId}','${taskId}','${stageId}',true,'google_drive','${fileIds.approved}','${folderIds.approved}-nested','approved','Arquivo aprovado');
`

async function makeDatabase(){
 const db=new PGlite()
 await db.exec(schema)
 await db.exec(firstMigration)
 await db.exec(scopeMigration)
 await db.exec(`
   create trigger whatsapp_copy_test after insert on public.whatsapp_message_outbox
   for each row execute function app_private.wa_add_file_link_to_outbox();
 `)
 return db
}

let db
test.beforeEach(async()=>{db=await makeDatabase()})
test.afterEach(async()=>{await db?.close()})

let seq=0
async function emit({type,status,metadata={}}){
 const id='88888888-8888-4888-8888-'+String(++seq).padStart(12,'0')
 const notificationId='99999999-9999-4999-8999-'+String(seq).padStart(12,'0')
 await db.query('insert into public.notifications values ($1,$2,$3,$4)',[
  notificationId,customerId,type,JSON.stringify({project_id:projectId,status,...metadata})
 ])
 await db.query(`insert into public.whatsapp_message_outbox
  (id,source,status,event_type,notification_id,recipient_user_id,target_link,message_body)
  values ($1,'live','ready_manual',$2,$3,$4,$5,'')`,[
   id,type,notificationId,customerId,compactPath
  ])
 const result=await db.query('select message_body from public.whatsapp_message_outbox where id=$1',[id])
 return result.rows[0].message_body
}

function includesOnly(body,allowed,excluded){
 assert.ok(body.includes(allowed),`Expected allowed file ${allowed} in ${body}`)
 for(const file of excluded) assert.ok(!body.includes(file),`Unexpected cross-folder file ${file} in ${body}`)
}

test('review task update includes only preview-folder files',async()=>{
 const body=await emit({type:'project_task',status:'review',metadata:{task_id:taskId}})
 includesOnly(body,fileIds.preview,[fileIds.received,fileIds.approved])
})

test('in-progress stage update includes only received-folder files',async()=>{
 const body=await emit({type:'project_stage',status:'in_progress',metadata:{stage_id:stageId}})
 includesOnly(body,fileIds.received,[fileIds.preview,fileIds.approved])
})

test('completed project event includes only approved-folder files',async()=>{
 const body=await emit({type:'project_status',status:'completed'})
 includesOnly(body,fileIds.approved,[fileIds.received,fileIds.preview])
})

test('requested adjustments do not attach files from any operational folder',async()=>{
 const body=await emit({type:'project_task',status:'changes_requested',metadata:{task_id:taskId}})
 for(const file of Object.values(fileIds)) assert.ok(!body.includes(file))
 assert.match(body,/Os materiais relacionados a esta atualização estão no link de acompanhamento/)
})

test('deadline-only project update does not attach project files',async()=>{
 const body=await emit({type:'project_updated',status:'active'})
 for(const file of Object.values(fileIds)) assert.ok(!body.includes(file))
})
