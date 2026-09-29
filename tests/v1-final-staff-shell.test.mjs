import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'

const layout=readFileSync(new URL('../src/layouts/AdminLayout.tsx',import.meta.url),'utf8')

test('staff topbar keeps light borders and readable mobile controls',()=>{
  assert.match(layout,/borderColor: collaboratorMode\?'#e1e4e8'/)
  assert.match(layout,/collaboratorMode\?'#475467':'#9090a0'/)
})

test('notification badges use workspace surface ring instead of dark-only ring',()=>{
  assert.match(layout,/ring-\[var\(--staff-surface,#0a0a0b\)\]/)
  assert.doesNotMatch(layout,/ring-2 ring-\[#0a0a0b\]/)
})
