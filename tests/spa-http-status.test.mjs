import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'

const edge=readFileSync(new URL('../netlify/edge-functions/spa-status.ts',import.meta.url),'utf8')

test('unknown SPA routes are converted to HTTP 404 with noindex',()=>{
  assert.match(edge,/status:404/)
  assert.match(edge,/X-Robots-Tag','noindex, nofollow'/)
  assert.match(edge,/context\.next\(\)/)
})

test('known dynamic and private SPA route families are preserved',()=>{
  assert.match(edge,/produtos/)
  assert.match(edge,/servicos/)
  assert.match(edge,/certificados/)
  assert.match(edge,/clean\.startsWith\('\/app\/'\)/)
  assert.match(edge,/clean\.startsWith\('\/admin\/'\)/)
})
