import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'

const page = readFileSync(new URL('../src/pages/admin/AdminProjectDetailV2.tsx', import.meta.url), 'utf8')

test('project summary uses compact inline status and priority controls', () => {
  assert.match(page, /aria-label="Resumo do projeto"/)
  assert.match(page, /aria-label="Andamento do projeto"/)
  assert.match(page, /aria-label="Prioridade do projeto"/)
  assert.match(page, /onChange=\{e=>void updateProject\(\{status:e\.target\.value\}\)\}/)
  assert.match(page, /onChange=\{e=>void updateProject\(\{priority:e\.target\.value\}\)\}/)
  assert.match(page, /role="progressbar"/)
  assert.match(page, /Informações/)
})

test('customer management starts as collapsed summary with expandable controls', () => {
  assert.match(page, /aria-label="Clientes com acesso ao projeto"/)
  assert.match(page, /<details className="group">/)
  assert.match(page, /primaryCustomerName/)
  assert.match(page, /additionalViewerNames\.slice\(0,2\)/)
  assert.match(page, /Gerenciar/)
  assert.match(page, /aria-label="Cliente principal do projeto"/)
  assert.match(page, /aria-label="Adicionar outro cliente ao projeto"/)
  assert.match(page, /onClick=\{.*saveCustomerLink\(\)/)
  assert.match(page, /onClick=\{.*addViewer\(\)/)
  assert.match(page, /onClick=\{.*removeViewer\(access\.customer_id\)/)
})

test('exports and irreversible project action move behind actions disclosure', () => {
  assert.match(page, /exportProjectReportSpreadsheet\(project,team\)/)
  assert.match(page, /printProjectReportPdf\(project,team\)/)
  assert.match(page, /user\?\.role==='admin'/)
  assert.match(page, /void deleteProject\(\)/)
  assert.match(page, /EXCLUIR/)
})
