import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
const panel=readFileSync(new URL('../src/components/auth/LoginExperiencePanel.tsx',import.meta.url),'utf8')
const page=readFileSync(new URL('../src/pages/public/LoginPage.tsx',import.meta.url),'utf8')
test('Floating card owns the animated S on both viewports',()=>{assert.match(panel,/pm-login-object-screen">\s*<SagamenteMotion/);assert.match(panel,/pm-login-mobile-object-screen"><SagamenteMotion/);assert.doesNotMatch(page,/<SagamenteMotion/)})
test('Login keeps accessible recovery and signup paths',()=>{assert.match(page,/esqueci-senha/);assert.match(page,/authLink\('\/cadastro', from\)/)})
