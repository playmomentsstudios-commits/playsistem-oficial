import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'

const read=path=>readFileSync(new URL('../'+path,import.meta.url),'utf8')
const routes=read('src/AppV2.tsx')
const customer=read('src/pages/customer/ProjectStagePage.tsx')
const project=read('src/pages/customer/ProjectsPage.tsx')
const admin=read('src/pages/admin/AdminProjectDetailV2.tsx')
const api=read('src/api/portal.ts')
const labels=read('src/lib/labels.ptBR.ts')
const migration=read('supabase/migrations/20261010235000_project_stage_detail_and_notifications.sql')
const session=read('supabase/functions/google-drive-upload-session/index.ts')
const finalize=read('supabase/functions/google-drive-finalize/index.ts')

test('dynamic stage route is protected by customer and admin layouts',()=>{
  assert.match(routes,/path="projetos\/:id\/etapas\/:stageId" element=\{<ProjectStagePage \/>\}/)
  assert.match(routes,/permission=\{\['projects.view','projects.manage'\]\}><ProjectStagePage/)
  assert.match(customer,/useParams\(\)/)
  assert.match(customer,/portalApi\.project\(id\)/)
  assert.match(customer,/portalApi\.projectFiles\(id\)/)
  assert.match(customer,/stage\.name/)
  assert.match(customer,/FilePreviewModal/)
  assert.match(customer,/ClientProjectFileCard/)
  assert.match(project,/Visualizar página desta etapa/)
  assert.match(admin,/Ver página da etapa/)
})

test('stage page filters everything to the authorized project and published stage',()=>{
  assert.match(customer,/item\.id===stageId&&item\.project_id===id&&item\.client_visible/)
  assert.match(customer,/task\.client_visible&&task\.project_id===id&&task\.stage_id===stageId/)
  assert.match(customer,/!file\.client_visible\|\|file\.project_id!==id/)
  assert.match(customer,/linkedTasks\.get\(file\.task_id\)===stageId/)
  assert.match(customer,/file\.stage_id===stageId/)
  assert.match(customer,/link\.client_visible/)
  assert.match(customer,/Esta etapa não existe, não está liberada/)
  assert.doesNotMatch(customer,/drive\.google\.com\/file\/d/)
})

test('admin can publish stage status review and attach project files to the correct stage',()=>{
  assert.match(migration,/check \(status in \('pending','in_progress','review','completed'\)\)/)
  assert.match(labels,/review:'Em revisão'/)
  assert.match(admin,/stageStatuses=\['pending','in_progress','review','completed'\]/)
  assert.match(admin,/Etapa do arquivo/)
  assert.match(admin,/stage_id:effectiveFileStage/)
  assert.match(admin,/assignClientFileStage\(uploaded\.id,effectiveFileStage\)/)
  assert.match(admin,/Etapa vinculada/)
  assert.match(api,/assignClientFileStage: async/)
  assert.match(api,/task\.project_id!==file\.project_id/)
  assert.match(api,/stage\.project_id!==file\.project_id/)
  assert.match(api,/task\.stage_id!==stageId/)
})

test('new notifications open only the referenced stage for entitled clients',()=>{
  assert.match(migration,/function public\.notify_project_stage_change\(\)/)
  assert.match(migration,/function public\.notify_task_change\(\)/)
  assert.match(migration,/when 'review' then 'Etapa disponível para revisão'/)
  assert.match(migration,/when 'completed' then 'Etapa concluída'/)
  assert.match(migration,/\'\/app\/projetos\/\'\|\|new\.project_id::text\|\|\'\/etapas\/\'\|\|new\.id::text/)
  assert.match(migration,/customer_portal_notification_enabled\(recipients\.user_id,'project'\)/)
  assert.match(migration,/app_private\.project_notice_recipients\(new\.project_id\)/)
  assert.match(migration,/stage\.client_visible/)
  assert.match(migration,/old\.status is distinct from new\.status/)
})

test('Google Drive never grants public access or mixes stages between projects',()=>{
  assert.match(session,/const effectiveStageId = taskStageId \|\| \(staffAllowed \? requestedStageId : null\)/)
  assert.match(session,/stage\?\.project_id !== projectId/)
  assert.match(finalize,/staff \? requestedStageId : null/)
  assert.match(finalize,/stage\?\.project_id !== projectId/)
  assert.match(finalize,/stage_id: fileStageId/)
  assert.match(finalize,/authenticated downloads are proxied/)
})
