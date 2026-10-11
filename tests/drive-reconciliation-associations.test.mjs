import test from 'node:test'
import assert from 'node:assert/strict'
import ts from 'typescript'
import { readFile } from 'node:fs/promises'

const source = await readFile(
  new URL('../supabase/functions/_shared/driveReconciliation.ts', import.meta.url),
  'utf8',
)
const js = ts.transpileModule(source, {
  compilerOptions: { module: ts.ModuleKind.ESNext },
}).outputText
const { reconciliationAssociationPatch } = await import(
  'data:text/javascript;base64,' + Buffer.from(js).toString('base64')
)

test('Drive sync leaves task and stage associations untouched within the same project', () => {
  const metadata = { name: 'preview.png', drive_folder_id: 'folder', stage_id: null }
  assert.deepEqual(
    reconciliationAssociationPatch(metadata, 'project-1', 'project-1'),
    { name: 'preview.png', drive_folder_id: 'folder' },
  )
})

test('Drive sync clears old task association when a file moves to another project', () => {
  const metadata = { name: 'preview.png', drive_folder_id: 'folder', stage_id: 'stage-2' }
  assert.deepEqual(
    reconciliationAssociationPatch(metadata, 'project-1', 'project-2'),
    { name: 'preview.png', drive_folder_id: 'folder', stage_id: 'stage-2', task_id: null },
  )
})

test('Drive sync clears task and stage context when moving to an unassigned folder', () => {
  const metadata = { name: 'preview.png', drive_folder_id: 'folder', stage_id: null }
  assert.deepEqual(
    reconciliationAssociationPatch(metadata, 'project-1', 'project-2'),
    { name: 'preview.png', drive_folder_id: 'folder', stage_id: null, task_id: null },
  )
})
