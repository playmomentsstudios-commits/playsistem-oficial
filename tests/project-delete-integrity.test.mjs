import test from 'node:test'
import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'

const migration=await readFile(new URL('../supabase/migrations/20260929153000_fix_project_delete_task_file_trigger.sql',import.meta.url),'utf8')

test('project deletion detaches task and project file metadata before cascade',()=>{
 assert.match(migration,/update public\.client_files[\s\S]*set task_id=null, project_id=null/)
 assert.match(migration,/task_id in \(select id from public\.tasks where project_id=p_project_id\)/)
 assert.match(migration,/delete from public\.projects where id=p_project_id/)
})

test('client file task validation accepts FK nullification during task deletion',()=>{
 assert.match(migration,/if new\.task_id is null then[\s\S]*return new/)
})
