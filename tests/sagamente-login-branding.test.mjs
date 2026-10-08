import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
const panel=readFileSync(new URL('../src/components/auth/LoginExperiencePanel.tsx',import.meta.url),'utf8')
const page=readFileSync(new URL('../src/pages/public/LoginPage.tsx',import.meta.url),'utf8')
test('Login and mobile use only Sagamente in visible labels',()=>{
  assert.match(panel,/SEU ESPAÇO NA SAGAMENTE/)
  assert.match(panel,/SAGAMENTE \/ ÁREA PESSOAL/)
  assert.match(panel,/<span>SAGAMENTE<\/span><b>ACESSO<\/b>/)
  assert.doesNotMatch(panel,/PLAY MOMENTS|PLAY LAB|>PM</)
})
test('Login animation uses the registered Sagamente symbol and earth palette',()=>{
  assert.match(panel,/pm-login-object-screen">\s*<img src="\/sagamente-mark.svg"/)
  assert.match(panel,/pm-login-mobile-object-screen"><img src="\/sagamente-mark.svg"/)
  assert.match(panel,/background:#2E5D46/)
  assert.match(panel,/color:#DFA269/)
  assert.doesNotMatch(panel,/#6539ff|#ff5967|#55131a|#53131a/i)
})
test('Authentication behavior stays managed by existing LoginPage and AuthContext',()=>{
  assert.match(page,/LoginExperiencePanel/)
  assert.match(page,/LoginMobileExperience/)
  assert.match(page,/await login\(\{ email, password \}\)/)
  assert.match(page,/afterAuthPath\(from, signedIn.role\)/)
})
