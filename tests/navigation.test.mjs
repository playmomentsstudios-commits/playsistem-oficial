import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import ts from 'typescript'
const source = await readFile(new URL('../src/lib/navigation.ts', import.meta.url), 'utf8')
const compiled = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.ESNext } }).outputText
const { safeReturnPath, afterAuthPath, authLink, conversationLink } = await import('data:text/javascript;base64,' + Buffer.from(compiled).toString('base64'))
test('rejects external, protocol-relative, encoded and malformed return destinations', () => {
  for (const path of ['https://evil.test', '//evil.test', '/\\evil.test', '/%2fevil.test', '/%252fevil.test', '/%5cevil.test', '/%0a/evil.test', '/a\tb', '/%', 'javascript:alert(1)', '/login', '/cadastro', null]) {
    assert.equal(safeReturnPath(path), null, String(path))
  }
})
test('preserves safe query/hash through both auth screens', () => {
  for (const path of ['/a/..//evil.test', '/%2e%2e//evil.test', '/%6cogin']) assert.equal(safeReturnPath(path), null)
  const path = '/app/conversas?assunto=orcamento#mensagens'
  assert.equal(safeReturnPath(path), path)
  for (const page of ['/login', '/cadastro']) assert.equal(new URL(authLink(page, path), 'https://site.test').searchParams.get('next'), path)
  assert.equal(afterAuthPath(path, 'customer'), path)
})
test('routes all roles and all contact intentions', () => {
  for (const subject of [undefined, 'orcamento', 'duvida']) {
    const suffix = subject ? '?assunto=' + subject : ''
    assert.equal(new URL(conversationLink(null, subject), 'https://site.test').searchParams.get('next'), '/app/conversas' + suffix)
    assert.equal(conversationLink('customer', subject), '/app/conversas' + suffix)
    for (const role of ['admin', 'staff']) assert.equal(conversationLink(role, subject), '/admin/conversas' + suffix)
  }
  assert.equal(afterAuthPath('//evil.test', 'customer'), '/app/dashboard')
  assert.equal(afterAuthPath(null, 'admin'), '/admin')
  assert.equal(afterAuthPath('/admin', 'customer'), '/app/dashboard')
})
