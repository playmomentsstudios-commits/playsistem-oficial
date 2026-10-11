import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import ts from 'typescript'

const read = path => readFileSync(new URL('../' + path, import.meta.url), 'utf8')
const source = ts.transpileModule(read('src/lib/whatsappConsent.ts'), { compilerOptions: { module: ts.ModuleKind.ESNext } }).outputText
const { whatsappPhone, whatsappConsentCurrent, saveWhatsappConsent, WHATSAPP_CONSENT_PATH } = await import('data:text/javascript;base64,' + Buffer.from(source).toString('base64'))
const phone = '5564999999999'
const preferences = { user_id: 'customer', wa_automatic_opt_in: true, wa_opt_in_at: '2026-10-11', wa_opt_in_phone: phone }

test('shareable page returns through login without implicitly accepting', async () => {
  const navigation = ts.transpileModule(read('src/lib/navigation.ts'), { compilerOptions: { module: ts.ModuleKind.ESNext } }).outputText
  const { authLink, afterAuthPath } = await import('data:text/javascript;base64,' + Buffer.from(navigation).toString('base64'))
  assert.equal(WHATSAPP_CONSENT_PATH, '/whatsapp')
  assert.equal(new URL(authLink('/login', WHATSAPP_CONSENT_PATH), 'https://site.test').searchParams.get('next'), '/whatsapp')
  assert.equal(afterAuthPath('/whatsapp', 'customer'), '/whatsapp')
  assert.equal(whatsappPhone('(64) 99999-9999'), phone)
  assert.equal(whatsappPhone('+55 64 99999-9999'), phone)
  assert.equal(whatsappPhone('123'), '')
})

test('new acceptance saves only the WhatsApp flag and confirms server-stamped phone/time', async () => {
  const calls = []
  const result = await saveWhatsappConsent(null, phone, true, async values => { calls.push(values); return preferences })
  assert.equal(result, preferences)
  assert.deepEqual(calls, [{ wa_automatic_opt_in: true }])
  await assert.rejects(saveWhatsappConsent(null, phone, true, async () => ({ ...preferences, wa_opt_in_at: null })), /não foi confirmada/)
  await assert.rejects(saveWhatsappConsent(null, '', true, async () => { assert.fail('must not write') }), /DDD/)
})

test('current consent is idempotent; changed phone explicitly revokes before reauthorizing', async () => {
  assert.ok(whatsappConsentCurrent(preferences, phone))
  await saveWhatsappConsent(preferences, phone, true, async () => { assert.fail('must not write') })
  const stale = { ...preferences, wa_opt_in_phone: '5564999999998' }, calls = []
  await saveWhatsappConsent(stale, phone, true, async values => {
    calls.push(values)
    return values.wa_automatic_opt_in ? preferences : { ...preferences, wa_automatic_opt_in: false, wa_opt_in_at: null, wa_opt_in_phone: null }
  })
  assert.deepEqual(calls, [{ wa_automatic_opt_in: false }, { wa_automatic_opt_in: true }])
  let count = 0
  await assert.rejects(saveWhatsappConsent(stale, phone, true, async () => { count++; throw new Error('offline') }), /offline/)
  assert.equal(count, 1)
})

test('withdrawal works without a valid phone and errors never show success', async () => {
  const calls = []
  await saveWhatsappConsent(preferences, '', false, async values => { calls.push(values); return { ...preferences, wa_automatic_opt_in: false } })
  assert.deepEqual(calls, [{ wa_automatic_opt_in: false }])
  await assert.rejects(saveWhatsappConsent(preferences, phone, false, async () => preferences), /cancelar/)
})

test('a session switched to another account cannot save the earlier customer consent', async () => {
  let writes = 0
  globalThis.__consentSupabase = {
    auth: { getUser: async () => ({ data: { user: { id: 'other-account' } } }) },
    from: () => { writes++; assert.fail('must reject before writing') },
  }
  try {
    const apiSource = ts.transpileModule(read('src/api/settings.ts'), { compilerOptions: { module: ts.ModuleKind.ESNext } }).outputText
      .replace(/import \{ supabase \} from '[^']+';/, 'const supabase = globalThis.__consentSupabase;')
    const { settingsApi } = await import('data:text/javascript;base64,' + Buffer.from(apiSource).toString('base64'))
    await assert.rejects(settingsApi.saveUserPreferences({ wa_automatic_opt_in: true }, 'original-account'), /conta conectada mudou/)
    assert.equal(writes, 0)
  } finally { delete globalThis.__consentSupabase }
})
