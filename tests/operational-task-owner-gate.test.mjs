import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const migration = await readFile(
  new URL('../supabase/migrations/20261011035500_task_owner_required_for_active_status.sql', import.meta.url),
  'utf8',
);
const page = await readFile(
  new URL('../src/pages/admin/AdminProductivity.tsx', import.meta.url),
  'utf8',
);

test('active and review task writes require an active staff/admin owner in the database', () => {
  assert.match(migration, /new\.status in \('in_progress', 'review'\)/);
  assert.match(migration, /new\.assigned_to is null/);
  assert.match(migration, /p\.role = 'admin'/);
  assert.match(migration, /sp\.active/);
  assert.match(migration, /before insert or update of status, assigned_to/);
});

test('productivity board lets an operator assign an orphan and blocks ownerless transitions', () => {
  assert.match(page, /assignTask\(task\.id,e\.target\.value\)/);
  assert.match(page, /!eligibleAssignees\.some\(\(member:any\)=>member\.id===task\.assigned_to\)/);
  assert.match(page, /Substituir responsável/);
  assert.match(page, /Atribua um responsável antes de iniciar/);
  assert.match(page, /role="alert"/);
  assert.match(page, /async function changeStatus\(id:string,status:string\):Promise<boolean>/);
  assert.match(page, /if\(await changeStatus\(selectedTask\.id,nextStatus\)\)/);
  assert.match(page, /return false/);
});
