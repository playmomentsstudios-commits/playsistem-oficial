import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import test from 'node:test'

const sql=readFileSync(new URL('../supabase/migrations/20261011120000_whatsapp_status_specific_drive_folders.sql',import.meta.url),'utf8')

test('only matching Drive folders are linked on task/stage status changes',()=>{
  assert.match(sql,/n.type not in \('project_task','project_stage'\)/)
  assert.match(sql,/v_status in \('in_progress','review','completed'\)/)
  assert.match(sql,/from public.project_drive_folders pdf/)
  assert.match(sql,/pdf.project_id=v_project/)
  assert.match(sql,/pdf.drive_folder_id=c.drive_folder_id/)
  assert.match(sql,/when 'in_progress' then 'received'/)
  assert.match(sql,/when 'review' then 'preview'/)
  assert.match(sql,/when 'completed' then 'approved'/)
})

test('preserves direct Drive URLs and existing recipient and file restrictions',()=>{
  assert.match(sql,/c.client_visible and c.storage_provider='google_drive'/)
  assert.match(sql,/n.type='project_task' and c.task_id=v_task/)
  assert.match(sql,/n.type='project_stage'/)
  assert.match(sql,/project_customer_access/)
  assert.match(sql,/v_file_url:=f.external_url/)
  assert.match(sql,/https:\/\/drive.google.com\/file\/d\//)
  assert.doesNotMatch(sql,/whatsapp-file-open\?t=/)
  assert.doesNotMatch(sql,/permissions.create|anyoneWithLink/)
})
