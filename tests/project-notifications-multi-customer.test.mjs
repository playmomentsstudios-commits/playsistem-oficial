import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import test from 'node:test'

const sql=readFileSync(new URL('../supabase/migrations/20261010210000_project_notifications_multi_customer.sql',import.meta.url),'utf8')

test('project notifications use explicit primary and additional customer access',()=>{
  assert.ok(sql.includes('project.customer_id as customer_id'))
  assert.ok(sql.includes('public.project_customer_access access'))
  assert.ok(sql.includes("profile.role='customer' and profile.status='active'"))
  assert.ok(sql.includes("project.project_type <> 'internal'"))
})

test('project, stage, task and files all use authorized recipients',()=>{
  for(const name of ['notify_project_status_change','notify_project_stage_change','notify_task_change','notify_client_file_available','notify_client_file_published']){
    assert.ok(sql.includes('function public.'+name+'()'),name)
  }
  assert.ok(sql.includes("customer_portal_notification_enabled(recipients.user_id,'project')"))
  assert.ok(sql.includes("customer_portal_notification_enabled(recipients.user_id,'file')"))
})

test('duplicate project status and file insert notices are avoided',()=>{
  assert.ok(sql.includes('if old.due_date is distinct from new.due_date then'))
  assert.ok(sql.includes('drop trigger if exists client_files_notify on public.client_files'))
})
