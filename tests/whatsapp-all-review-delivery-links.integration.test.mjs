import assert from 'node:assert/strict'
import {readFileSync} from 'node:fs'
import test from 'node:test'
import {PGlite} from '@electric-sql/pglite'

const migration=readFileSync(new URL('../supabase/migrations/20261012100000_whatsapp_all_review_delivery_drive_links.sql', import.meta.url),'utf8')
const projectId='11111111-1111-4111-8111-111111111111'
const otherProjectId='11111111-1111-4111-8111-111111111112'
const customerId='22222222-2222-4222-8222-222222222222'
const taskId='33333333-3333-4333-8333-333333333333'
const stageId='44444444-4444-4444-8444-444444444444'
const compactPath='/n/abcdefghijklmnopqrstuv'
const schema=[
 "create role anon;",
 "create role authenticated;",
 "create schema app_private;",
 "create table public.profiles(id uuid primary key, role text, status text);",
 "create table public.projects(id uuid primary key, title text, project_type text, customer_id uuid);",
 "create table public.project_customer_access(project_id uuid, customer_id uuid);",
 "create table public.notifications(id uuid primary key, user_id uuid, type text, metadata jsonb);",
 "create table public.tasks(id uuid primary key, title text, stage_id uuid, project_id uuid, client_visible boolean);",
 "create table public.project_stages(id uuid primary key, name text, project_id uuid, client_visible boolean);",
 "create table public.client_files(id uuid primary key, project_id uuid, task_id uuid, stage_id uuid, client_visible boolean, storage_provider text, drive_file_id text, name text, external_url text, version_group_id uuid, version_number integer, created_at timestamptz default now(), supersedes_file_id uuid);",
 "create table public.file_reviews(file_id uuid, action text);",
 "create table public.wa_message_templates(template_key text primary key, body text);",
 "create table public.whatsapp_message_outbox(id uuid primary key, source text, status text, event_type text, notification_id uuid, recipient_user_id uuid, recipient_name text, target_link text, message_body text);"
].join('\n')

let db, seq=0
const uuid=i=>'aaaaaaaa-aaaa-4aaa-8aaa-'+String(i).padStart(12,'0')
const drive=i=>'drive-file-'+String(i).padStart(8,'0')
async function addFile(i,name,{visible=true,project=projectId,versionGroup=null,version=1,driveId=null}={}){
 await db.query('insert into public.client_files (id,project_id,task_id,stage_id,client_visible,storage_provider,drive_file_id,name,version_group_id,version_number) values ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10)',[
  uuid(i),project,project===projectId?taskId:null,project===projectId?stageId:null,
  visible,'google_drive',driveId??drive(i),name,versionGroup,version
 ])
}
async function emit(type,status){
 const index=++seq
 const noticeId='99999999-9999-4999-8999-'+String(index).padStart(12,'0')
 const msgId='88888888-8888-4888-8888-'+String(index).padStart(12,'0')
 const metadata={project_id:projectId,status}
 if(type==='project_task')metadata.task_id=taskId
 if(type==='project_stage')metadata.stage_id=stageId
 await db.query('insert into public.notifications values ($1,$2,$3,$4)',[noticeId,customerId,type,JSON.stringify(metadata)])
 await db.query('insert into public.whatsapp_message_outbox (id,source,status,event_type,notification_id,recipient_user_id,recipient_name,target_link,message_body) values ($1,$2,$3,$4,$5,$6,$7,$8,$9)',[
  msgId,'live','ready_manual',type,noticeId,customerId,'Cliente Teste',compactPath,''
 ])
 const result=await db.query('select message_body from public.whatsapp_message_outbox where id=$1',[msgId])
 return result.rows[0].message_body
}
test.beforeEach(async()=>{
 db=new PGlite()
 await db.exec(schema)
 await db.query('insert into public.profiles values ($1,$2,$3)',[customerId,'customer','active'])
 await db.query('insert into public.projects values ($1,$2,$3,$4),($5,$6,$7,$8)',[
  projectId,'Projeto Aurora','service',customerId,otherProjectId,'Outro projeto','service',customerId
 ])
 await db.query('insert into public.project_customer_access values ($1,$2)',[projectId,customerId])
 await db.query('insert into public.tasks values ($1,$2,$3,$4,$5)',[taskId,'Campanha',stageId,projectId,true])
 await db.query('insert into public.project_stages values ($1,$2,$3,$4)',[stageId,'Divulgação',projectId,true])
 await db.exec(migration)
 await db.exec('create trigger wa_test after insert on public.whatsapp_message_outbox for each row execute function app_private.wa_add_file_link_to_outbox()')
 for(let i=1;i<=11;i++) await addFile(i,'Card '+String(i).padStart(2,'0'))
 for(let i=12;i<=16;i++) await addFile(i,'Pauta '+String(i-11).padStart(2,'0'))
 await addFile(17,'Material interno',{visible:false})
 await addFile(18,'Arquivo outro projeto',{project:otherProjectId})
})
test.afterEach(async()=>{await db?.close()})
function assertAll(body){
 for(let i=1;i<=16;i++) assert.ok(body.includes('https://drive.google.com/file/d/'+drive(i)+'/view'),'Missing link '+i)
 assert.ok(!body.includes(drive(17)),'Private file exposed')
 assert.ok(!body.includes(drive(18)),'Other project exposed')
 assert.doesNotMatch(body,/\+\d+ outro\(s\) arquivo\(s\)/)
 assert.ok(body.lastIndexOf('drive-file-')<body.lastIndexOf('https://playsistem-oficial.'))
}
test('review includes 16 links: no 6+2 cap or remainder',async()=>{
 const body=await emit('project_task','review')
 assert.match(body,/Revisão disponível/)
 assertAll(body)
})
test('stage completion includes all main and support files',async()=>{
 assertAll(await emit('project_stage','completed'))
})
test('final project delivery includes every authorized project file',async()=>{
 const body=await emit('project_status','completed')
 assert.match(body,/Entrega final disponível/)
 assertAll(body)
})
test('ordinary progress preserves short preview only',async()=>{
 const body=await emit('project_task','in_progress')
 assert.match(body,/\+8 outro\(s\) arquivo\(s\)/)
 assert.ok(body.includes(drive(1)))
 assert.ok(!body.includes(drive(16)))
})
test('invalid Drive identifier is not emitted as a link',async()=>{
 await addFile(19,'Arquivo sem link',{driveId:'bad'})
 const body=await emit('project_task','review')
 assertAll(body)
 assert.match(body,/1 arquivo\(s\) sem link válido no Drive/)
 assert.ok(!body.includes('drive.google.com/file/d/bad/view'))
})
test('only latest version per material is included',async()=>{
 const group=uuid(25)
 await addFile(20,'Versão anterior',{versionGroup:group,version:1})
 await addFile(21,'Versão atual',{versionGroup:group,version:2})
 const body=await emit('project_task','review')
 assert.ok(body.includes(drive(21)))
 assert.ok(!body.includes(drive(20)))
})
