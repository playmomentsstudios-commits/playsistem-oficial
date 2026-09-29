import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'

const css=readFileSync(new URL('../src/index.css',import.meta.url),'utf8')
const layout=readFileSync(new URL('../src/layouts/AdminLayout.tsx',import.meta.url),'utf8')

test('staff workspace has explicit accessible light-state tokens',()=>{
  assert.match(css,/--staff-danger:/)
  assert.match(css,/focus-visible/)
  assert.match(css,/\[role="menu"\]/)
  assert.match(css,/thead/)
  assert.match(css,/input,textarea,select/)
})

test('staff navigation uses light border and collaborator identity',()=>{
  assert.match(layout,/collaboratorMode \? '1px solid #e1e4e8'/)
  assert.match(layout,/'Colaborador'/)
  assert.match(layout,/staffBrand\.staff_surface_color/)
})
