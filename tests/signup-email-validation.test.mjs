import assert from 'node:assert/strict'
import {readFileSync} from 'node:fs'
import test from 'node:test'
const read=(file)=>readFileSync(new URL('../'+file,import.meta.url),'utf8')
const page=read('src/pages/public/RegisterPage.tsx')
const helper=read('src/lib/signupEmail.ts')
const auth=read('src/contexts/AuthContext.tsx')

test('email is normalized and syntax-checked in first step, not only by unmounted browser input',()=>{
  assert.match(page,/if \(!normalizeSignupEmail\(form.email\)\)/)
  assert.match(page,/else if \(!isValidSignupEmail\(form.email\)\) errs.email = EMAIL_FORMAT_HINT/)
  assert.match(page,/\['name','lastName','email','phone','documentNumber'\]/)
  assert.match(page,/if\(step===1\)setForm\(prev=>\(\{\.\.\.prev,email:normalizeSignupEmail\(prev.email\)\}\)\)/)
  assert.match(page,/id="register-email"/)
  assert.match(page,/autoCapitalize="none"/)
  assert.match(page,/spellCheck=\{false\}/)
  assert.match(helper,/value\.trim\(\)\.replace/)
  assert.match(helper,/const parts=email\.split\('@'\)/)
  assert.match(helper,/const labels=domain\.split\('\.'\)/)
  assert.match(auth,/supabase\.auth\.signUp\(/)
})

test('Supabase email format errors bring user back to email field with other wizard state preserved',()=>{
  assert.match(page,/isServerEmailFormatError\(err\)/)
  assert.match(page,/setErrors\(prev=>\(\{\.\.\.prev,email:/)
  assert.match(page,/setStep\(1\)/)
  assert.match(page,/document\.getElementById\('register-email'\)\?\.focus\(\)/)
  assert.match(page,/Corrija o endereço na primeira etapa/)
  assert.match(page,/role="alert"/)
  assert.match(helper,/unable to validate email address/)
  assert.match(helper,/invalid email/)
  assert.doesNotMatch(page,/window\.location\.reload\(/)
})

test('required conditions are visually above registration CTA, separate from opt-in preferences',()=>{
  const begin=page.indexOf('aria-labelledby="communication-preferences-title"')
  const terms=page.indexOf('aria-labelledby="conditions-title"')
  const create=page.indexOf('>Criar conta</Button>')
  assert.ok(begin>=0&&terms>begin&&create>terms)
  assert.match(page,/disabled=\{!acceptedConditions \|\| loading\}/)
  assert.match(page,/checked=\{form\.whatsappUpdatesOptIn\}/)
  assert.match(page,/checked=\{form\.marketingOptIn\}/)
  assert.doesNotMatch(page,/disabled=\{[^}]*whatsappUpdatesOptIn/)
  assert.doesNotMatch(page,/disabled=\{[^}]*marketingOptIn/)
})

test('validation returns to earlier step before posting data if any first-stage field changes',()=>{
  assert.match(page,/const invalidStep=Object\.keys\(stepErrors\(1\)\)\.length\?1:Object\.keys\(stepErrors\(2\)\)\.length\?2:3/)
  assert.match(page,/setStep\(invalidStep\)/)
  assert.match(page,/if \(Object\.keys\(errs\)\.length\) \{/)
  assert.match(page,/const result = await register\(\{/)
})
