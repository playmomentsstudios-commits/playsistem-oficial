import test from 'node:test'
import assert from 'node:assert/strict'
import ts from 'typescript'
import { readFileSync } from 'node:fs'

const source=readFileSync(new URL('../src/lib/projectFileOrganization.ts',import.meta.url),'utf8')
const js=ts.transpileModule(source,{compilerOptions:{module:ts.ModuleKind.ESNext}}).outputText
const {adminFileAccessLabel,adminFilePhysicalFolderLabel}=await import('data:text/javascript;base64,'+Buffer.from(js).toString('base64'))

test('maps current and legacy Drive locations without confusing folder and task context',()=>{
  const project={drive_folders:[{folder_kind:'raw',drive_folder_id:'drive-raw'}]}
  assert.equal(adminFilePhysicalFolderLabel({storage_provider:'google_drive',drive_folder_id:'drive-raw'},project),'Legado · Brutos')
  assert.equal(adminFilePhysicalFolderLabel({storage_provider:'google_drive',drive_folder_id:'drive-custom',custom_folder:{parent_kind:'preview',name:'Versão final'}},project),'03 - Revisão / Versão final')
  assert.equal(adminFilePhysicalFolderLabel({storage_provider:'google_drive',drive_folder_id:'unknown'},project),'Outra pasta do Drive')
  assert.equal(adminFilePhysicalFolderLabel({storage_provider:'google_drive'},project),'Pasta no Drive não identificada')
  assert.equal(adminFilePhysicalFolderLabel({storage_provider:'supabase'},project),'Supabase Storage')
})

test('reports effective visibility conservatively through file, task, and stage scope',()=>{
  const project={project_type:'external',tasks:[{id:'task-private',stage_id:'stage-public',client_visible:false}],stages:[{id:'stage-private',client_visible:false},{id:'stage-public',client_visible:true}]}
  assert.equal(adminFileAccessLabel({client_visible:true,task_id:'task-private'},project),'Somente equipe · tarefa')
  assert.equal(adminFileAccessLabel({client_visible:true,stage_id:'stage-private'},project),'Somente equipe · etapa')
  assert.equal(adminFileAccessLabel({client_visible:false},project),'Somente equipe · arquivo')
  assert.equal(adminFileAccessLabel({client_visible:true},project),'Liberado ao cliente')
  assert.equal(adminFileAccessLabel({client_visible:true,task_id:'missing'},project),'Acesso não confirmado · tarefa')
  assert.equal(adminFileAccessLabel({client_visible:true,stage_id:'missing'},{...project,stages:[]}), 'Acesso não confirmado · etapa')
  assert.equal(adminFileAccessLabel({client_visible:true},{...project,project_type:'internal'}),'Somente equipe · projeto interno')
})
