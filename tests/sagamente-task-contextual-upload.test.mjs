import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'

const source=readFileSync(new URL('../src/pages/admin/AdminProjectDetailV2.tsx',import.meta.url),'utf8')
const block=source.split('async function uploadTaskFile(')[1]?.split('async function uploadNewVersion(')[0]||''

test('contextual task upload has project, task, stage and private visibility',()=>{
  assert.match(block,/project_id:id/)
  assert.match(block,/task_id:task\.id/)
  assert.match(block,/stage_id:task\.stage_id\|\|null/)
  assert.match(block,/client_visible:false/)
  assert.match(block,/folder_kind:project\.project_type==='internal'\?'production':'preview'/)
})
test('internal task without stage cannot upload',()=>{
  assert.match(block,/project\.project_type==='internal'&&!task\.stage_id/)
})
test('task UI exposes contextual upload',()=>{
  assert.match(source,/uploadTaskFile\(e,task\)/)
  assert.match(source,/title="Adicionar arquivos à tarefa" aria-label="Adicionar arquivos à tarefa"/)
  assert.match(source,/Privado · Revisão/)
})
