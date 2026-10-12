import assert from 'node:assert/strict'
import {readFileSync} from 'node:fs'
import test from 'node:test'
import {PGlite} from '@electric-sql/pglite'
import ts from 'typescript'
const helper=readFileSync(new URL('../supabase/functions/_shared/whatsappDriveAccess.ts',import.meta.url),'utf8')
const compiled=ts.transpileModule(helper,{compilerOptions:{module:ts.ModuleKind.ESNext,target:ts.ScriptTarget.ES2022}}).outputText
const {inspectWhatsAppDriveAccess}=await import('data:text/javascript;base64,'+Buffer.from(compiled).toString('base64'))
const projectId='11111111-1111-4111-8111-111111111111'
const customerId='22222222-2222-4222-8222-222222222222'
const taskId='33333333-3333-4333-8333-333333333333'
const stageId='44444444-4444-4444-8444-444444444444'
const compactPath='/n/abcdefghijklmnopqrstuv'
const folderIds={received:'received-folder-123',preview:'preview-folder-123',approved:'approved-folder-123',delivery:'delivery-folder-123'}
const fileIds={received:'received-file-123456',preview:'preview-file-123456',approved:'approved-file-123456',delivery:'delivery-file-123456'}

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
create table public.project_custom_folders(id uuid, project_id uuid, drive_folder_id text, parent_kind text);
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
 ('${projectId}','${folderIds.approved}','approved'),
 ('${projectId}','${folderIds.delivery}','delivery');
insert into public.client_files
 (id,project_id,task_id,stage_id,client_visible,storage_provider,drive_file_id,drive_folder_id,drive_folder_kind,name)
values
 ('55555555-5555-4555-8555-555555555555','${projectId}','${taskId}','${stageId}',true,'google_drive','${fileIds.received}','${folderIds.received}-nested','received','Arquivo recebido'),
 ('66666666-6666-4666-8666-666666666666','${projectId}','${taskId}','${stageId}',true,'google_drive','${fileIds.preview}','${folderIds.preview}-nested','preview','Arquivo para revisão'),
 ('77777777-7777-4777-8777-777777777777','${projectId}','${taskId}','${stageId}',true,'google_drive','${fileIds.approved}','${folderIds.approved}-nested','approved','Arquivo aprovado'),
 ('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa','${projectId}','${taskId}','${stageId}',true,'google_drive','${fileIds.delivery}','${folderIds.delivery}-nested','delivery','Material final');
insert into public.project_custom_folders values ('bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb','${projectId}','custom-preview-folder-123','preview');
insert into public.client_files (id,project_id,task_id,stage_id,client_visible,storage_provider,drive_file_id,drive_folder_id,name)
values ('cccccccc-cccc-4ccc-8ccc-cccccccccccc','${projectId}','${taskId}','${stageId}',true,'google_drive','custom-preview-file-123','custom-preview-folder-123','Prévia em pasta personalizada');
`


const extra=`
create role service_role;
create function public.current_user_is_admin() returns boolean language sql as $$ select true $$;
alter table public.whatsapp_message_outbox alter column id set default gen_random_uuid();
create schema auth;
create table auth.users(id uuid primary key,email text);
insert into auth.users values ('${customerId}','client@example.org');
alter table public.tasks add column status text default 'completed';
alter table public.notifications add column title text, add column message text, add column link text, add column created_at timestamptz default now();
alter table public.profiles add column phone text,add column first_name text,add column last_name text;
create table public.app_settings(id boolean,wa_prepare_project_status boolean,wa_prepare_task_status boolean,wa_prepare_stage_status boolean,wa_prepare_file_updates boolean,wa_prepare_file_review boolean,wa_prepare_priority_events boolean,priority_whatsapp_phone text,wa_bridge_delivery_mode text,wa_bridge_single_customer_id uuid);
create table public.wa_message_templates(template_key text, body text);
insert into public.wa_message_templates values ('review_available','🔎 Revisão de {{material_name}} — {{project_name}} {{link}}');
alter table public.whatsapp_message_outbox add column recipient_name text,add column destination_phone text,add column title text,add column created_at timestamptz default now();
alter table public.whatsapp_message_outbox add constraint whatsapp_message_outbox_status_check check(status in ('ready_manual','missing_phone','historical','opened_manual','reported_sent','sending_auto','sent_auto','failed_auto'));
alter table public.whatsapp_message_outbox add unique(notification_id);
`

const migration=readFileSync(new URL('../supabase/migrations/20261012090001_whatsapp_verified_material_messages.sql',import.meta.url),'utf8')
let db,seq=0
async function proof(){
 await db.exec(`insert into public.wa_drive_access_checks
  (file_id,drive_file_id,drive_folder_id,file_name,web_view_link,public_readable)
  select id,drive_file_id,drive_folder_id,name,'https://drive.google.com/file/d/'||drive_file_id||'/view',true
  from public.client_files on conflict(file_id) do update set checked_at=now(),public_readable=true;`)
}
test.beforeEach(async()=>{db=new PGlite();await db.exec(schema+extra);await db.exec(migration);await proof()})
test.afterEach(async()=>{await db?.close()})
async function emit({type='project_task',status='review',metadata={task_id:taskId},user=customerId}={}){
 const notice='99999999-9999-4999-8999-'+String(++seq).padStart(12,'0')
 const id='88888888-8888-4888-8888-'+String(seq).padStart(12,'0')
 await db.query('insert into notifications(id,user_id,type,metadata) values($1,$2,$3,$4)',[notice,user,type,JSON.stringify({project_id:projectId,status,...metadata})])
 await db.query(`insert into whatsapp_message_outbox(id,source,status,event_type,notification_id,recipient_user_id,target_link,message_body)
 values($1,'live','ready_manual',$2,$3,$4,$5,'') on conflict do nothing`,[id,type,notice,user,compactPath])
 return (await db.query('select * from whatsapp_message_outbox where id=$1',[id])).rows[0]
}
test('one material includes only its real preview and editable copy',async()=>{
 await db.exec(`delete from client_files where drive_file_id='custom-preview-file-123';`)
 const row=await emit();assert.equal(row.status,'ready_manual');assert.ok(row.message_body.includes(fileIds.preview));assert.ok(!row.message_body.includes(fileIds.delivery));assert.match(row.message_body,/Revisão de Banner principal/)
})
test('multiple files in one material retain every individual link',async()=>{
 const row=await emit();assert.ok(row.message_body.includes(fileIds.preview));assert.ok(row.message_body.includes('custom-preview-file-123'))
})
test('production review groups visible child material files even without file.stage_id',async()=>{
 await db.exec(`insert into tasks(id,title,stage_id,project_id,client_visible) values('13131313-1313-4313-8313-131313131313','Card de divulgação','${stageId}','${projectId}',true);
 update client_files set task_id='13131313-1313-4313-8313-131313131313' where drive_file_id='custom-preview-file-123';
 update client_files set stage_id=null where drive_folder_kind='preview';`)
 await proof()
 const row=await emit({type:'project_stage',metadata:{stage_id:stageId}});assert.equal(row.status,'ready_manual');assert.ok(row.message_body.includes(fileIds.preview));assert.match(row.message_body,/Banner principal/);assert.match(row.message_body,/Card de divulgação/)
})
test('final production delivery includes all seven final files without truncation',async()=>{
 await db.exec(`delete from client_files where drive_folder_kind is distinct from 'delivery';`)
 for(let i=0;i<6;i++)await db.query(`insert into client_files(id,project_id,task_id,stage_id,client_visible,storage_provider,drive_file_id,drive_folder_id,drive_folder_kind,name) values($1,$2,$3,$4,true,'google_drive',$5,$6,'delivery',$7)`,['aaaaaaaa-aaaa-4aaa-8aaa-'+String(i+1).padStart(12,'0'),projectId,taskId,stageId,'final-delivery-file-'+i,folderIds.delivery,'Final '+i])
 await proof();const row=await emit({type:'project_stage',status:'completed',metadata:{stage_id:stageId}})
 assert.equal(row.status,'ready_manual');assert.equal((row.message_body.match(/https:\/\/drive.google.com\/file\/d\//g)||[]).length,7);assert.doesNotMatch(row.message_body,/etapa concluída|outro.s. arquivo|Os materiais relacionados/i)
})
test('one notification prepares only its authorized recipient',async()=>{
 await emit();const rows=(await db.query('select recipient_user_id from whatsapp_message_outbox')).rows;assert.deepEqual(rows,[{recipient_user_id:customerId}]);
 const denied=await emit({user:'00000000-0000-4000-8000-000000000000'});assert.equal(denied.status,'blocked_files')
})
test('missing, private or expired permission evidence blocks rather than promises files',async()=>{
 await db.exec('delete from wa_drive_access_checks');const row=await emit();assert.equal(row.status,'blocked_files');assert.doesNotMatch(row.message_body,/https:\/\/drive|estão disponíveis|link de acompanhamento/)
})
test('different notification IDs cannot duplicate the same recipient event and files',async()=>{
 await emit();assert.equal(await emit(),undefined);assert.equal((await db.query('select count(*)::int n from whatsapp_message_outbox')).rows[0].n,1)
})
test('historical rows remain historical and are not rendered or queued again',async()=>{
 const row=await emit();await db.query(`insert into whatsapp_message_outbox(id,source,status,event_type,notification_id,recipient_user_id,message_body) values('12121212-1212-4212-8212-121212121212','historical','historical','project_task',null,$1,'old text')`,[customerId]);assert.equal((await db.query("select message_body from whatsapp_message_outbox where source='historical'")).rows[0].message_body,'old text')
})
test('Drive inspection rejects wrong parents, permission denial and made-up URLs',async()=>{
 const file={id:'local',drive_file_id:'drive-file-123456',drive_folder_id:'preview-folder',name:'Card.jpg'}
 const item={id:file.drive_file_id,name:file.name,parents:[file.drive_folder_id],webViewLink:'https://drive.google.com/file/d/'+file.drive_file_id+'/view',permissions:[{type:'user',role:'reader',emailAddress:'CLIENT@example.org'}]}
 const fetcher=(value)=>async()=>new Response(JSON.stringify(value),{status:200})
 const allowed=await inspectWhatsAppDriveAccess(file,'test',fetcher(item));assert.deepEqual(allowed.reader_emails,['client@example.org']);assert.equal(allowed.public_readable,false)
 assert.equal(await inspectWhatsAppDriveAccess(file,'test',fetcher({...item,parents:['private']})),null)
 assert.equal(await inspectWhatsAppDriveAccess(file,'test',fetcher({...item,webViewLink:'https://evil.example/'})),null)
 assert.equal(await inspectWhatsAppDriveAccess(file,'test',async()=>new Response('',{status:403})),null)
})

test('capture honors single-client selection before preparing an outbox row',async()=>{
 await db.exec(`insert into app_settings(id,wa_prepare_task_status,wa_bridge_delivery_mode,wa_bridge_single_customer_id)
 values(true,true,'single_client','${customerId}');
 update profiles set phone='62999999999' where id='${customerId}';`)
 for(const [idx,user] of [[1,customerId],[2,'00000000-0000-4000-8000-000000000000']]){
  const id='32323232-3232-4232-8232-'+String(idx).padStart(12,'0')
  await db.query(`insert into notifications(id,user_id,type,title,message,link,metadata) values($1,$2,'project_task','Review','Review',$3,$4)`,[id,user,'/app/projetos/'+projectId,JSON.stringify({project_id:projectId,task_id:taskId,status:'review'})])
  await db.query('select app_private.wa_capture_notification($1,false)',[id])
 }
 const rows=(await db.query('select recipient_user_id,status from whatsapp_message_outbox')).rows
 assert.deepEqual(rows,[{recipient_user_id:customerId,status:'ready_manual'}])
})
test('expired or non-recipient grants block the entire revision',async()=>{
 await db.exec(`update wa_drive_access_checks set checked_at=now()-interval '16 minutes'`)
 assert.equal((await emit()).status,'blocked_files')
 await db.exec(`update wa_drive_access_checks set checked_at=now(),public_readable=false,reader_emails=array['other@example.org']`)
 assert.equal((await emit()).status,'blocked_files')
})

test('a blocked new notice can be rechecked without replay or status changes',async()=>{
 await db.exec('delete from wa_drive_access_checks');const row=await emit();assert.equal(row.status,'blocked_files')
 await proof();const result=await db.query('select public.wa_retry_blocked_notification($1) status',[row.id]);assert.equal(result.rows[0].status,'ready_manual')
 assert.equal((await db.query('select count(*)::int n from notifications')).rows[0].n,1)
 assert.equal((await db.query('select count(*)::int n from whatsapp_message_outbox')).rows[0].n,1)
})
test('claim-time guard prevents stale or moved files from being sent',async()=>{
 const row=await emit();await db.exec(`update wa_drive_access_checks set checked_at=now()-interval '16 minutes'`)
 await assert.rejects(db.query(`update whatsapp_message_outbox set status='sending_auto' where id=$1`,[row.id]),/Envio bloqueado/)
 assert.equal((await db.query('select status from whatsapp_message_outbox where id=$1',[row.id])).rows[0].status,'ready_manual')
})
test('production cannot be delivered while one material remains incomplete',async()=>{
 await db.exec(`update tasks set status='review'`)
 const row=await emit({type:'project_stage',status:'completed',metadata:{stage_id:stageId}})
 assert.equal(row.status,'blocked_files');assert.doesNotMatch(row.message_body,/Materiais finalizados|https:\/\/drive/)
})
