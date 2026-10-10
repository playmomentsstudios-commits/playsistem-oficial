import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import test from 'node:test'

const read=(path)=>readFileSync(new URL('../'+path,import.meta.url),'utf8')
const routes=read('src/AppV2.tsx')
const page=read('src/pages/customer/ProjectTaskPage.tsx')
const stage=read('src/pages/customer/ProjectStagePage.tsx')
const customer=read('src/pages/customer/ProjectsPage.tsx')
const admin=read('src/pages/admin/AdminProjectDetailV2.tsx')
const sql=read('supabase/migrations/20261010235900_task_specific_customer_notifications.sql')
const whatsapp=read('src/pages/admin/AdminWhatsappCenter.tsx')

test('individual task has its own authenticated customer route and admin preview',()=>{
 assert.match(routes,/const ProjectTaskPage = lazy/)
 assert.match(routes,/path="projetos\/:id\/etapas\/:stageId\/tarefas\/:taskId" element=\{<ProjectTaskPage \/>\}/)
 assert.match(routes,/permission=\{\['projects.view','projects.manage'\]\}><ProjectTaskPage/)
 assert.match(customer,/Ver esta tarefa e seus arquivos/)
 assert.match(stage,/Abrir página exclusiva desta tarefa/)
 assert.match(admin,/Prévia da tarefa para o cliente/)
})

test('task page shows only the selected task, its published attachments and procedures',()=>{
 assert.match(page,/const \{ id,stageId,taskId \}=useParams\(\)/)
 assert.match(page,/s\.id===stageId&&s\.project_id===id&&s\.client_visible/)
 assert.match(page,/t\.id===taskId&&t\.project_id===id&&t\.stage_id===stageId&&t\.client_visible/)
 assert.match(page,/f\.client_visible&&f\.project_id===id&&f\.task_id===taskId/)
 assert.match(page,/!f\.stage_id\|\|f\.stage_id===stageId/)
 assert.match(page,/Arquivos desta tarefa/)
 assert.match(page,/Procedimentos e checklist/)
 assert.match(page,/item\.completed/)
 assert.match(page,/FilePreviewModal/)
 assert.match(page,/ClientProjectFileCard/)
 assert.match(page,/filter\(\(l:any\)=>l\.client_visible\)/)
 assert.match(page,/Tarefa indisponível/)
 assert.doesNotMatch(page,/\.map\(\(task:any\)=>/)
})

test('task status notifications link to exact task, stage notifications remain separate',()=>{
 assert.match(sql,/function public\.notify_task_change\(\)/)
 assert.match(sql,/new\.stage_id::text\|\|'\/tarefas\/\'\|\|new\.id::text/)
 assert.match(sql,/new\.stage_id is not null and exists/)
 assert.match(sql,/stage\.client_visible/)
 assert.match(sql,/new\.client_visible and old\.status is distinct from new\.status/)
 assert.match(sql,/app_private\.project_notice_recipients\(new\.project_id\)/)
 assert.match(sql,/customer_portal_notification_enabled\(recipients\.user_id,'project'\)/)
 assert.match(sql,/n\.metadata->>'task_id'=t\.id::text/)
 assert.match(sql,/n\.metadata->>'stage_id'=t\.stage_id::text/)
 assert.match(sql,/No historical notification is re-sent/)
})

test('automatic WhatsApp messages contain safe full URLs without changing consent or queued messages',()=>{
 assert.match(sql,/function app_private\.wa_capture_notification\(p_id uuid,p_historical boolean default false\)/)
 assert.match(sql,/n\.type in \('project_task','project_stage'\)/)
 assert.match(sql,/\/tarefas\/\[0-9a-fA-F-\]\{36\}/)
 assert.match(sql,/https:\/\/playsistem-oficial\.playmomentsstudios\.workers\.dev/)
 assert.match(sql,/v_message,n\.link/)
 assert.match(sql,/on conflict \(notification_id\) do nothing/)
 assert.match(sql,/o\.status in \('ready_manual','missing_phone','historical'\)/)
 assert.match(whatsapp,/!item\.message_body\.includes\(destinationUrl\)/)
})
