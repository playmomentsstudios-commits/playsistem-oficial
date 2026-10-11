import test from 'node:test'
import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import { runInNewContext } from 'node:vm'
import ts from 'typescript'

const modules = [
  '../supabase/functions/_shared/googleDrive.ts',
  '../supabase/functions/_shared/chatDriveAuth.ts',
]

async function loadOAuthFunction(path, fetchStub) {
  const source = await readFile(new URL(path, import.meta.url), 'utf8')
  const output = ts.transpileModule(source, {
    compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.CommonJS },
  }).outputText
  const sandbox = {
    exports: {},
    require: () => ({ createClient: () => { throw new Error('not called') } }),
    Deno: { env: { get: () => 'test-only-credential' } },
    URLSearchParams,
    AbortSignal,
    fetch: fetchStub,
  }
  runInNewContext(output, sandbox)
  return sandbox.exports.getDriveAccessToken
}

for (const path of modules) {
  test(`OAuth safety: ${path} redacts upstream descriptions and bounds network waits`, async () => {
    let requestSignal
    const oauth = await loadOAuthFunction(path, async (_url, init) => {
      requestSignal = init.signal
      return {
        ok: false, status: 400,
        json: async () => ({
          error: 'invalid_request',
          error_description: 'SENSITIVE_UPSTREAM_DETAIL_MUST_NOT_LEAK',
        }),
      }
    })
    await assert.rejects(oauth(), error =>
      /Google Drive|Google/.test(error.message)
      && !error.message.includes('SENSITIVE_UPSTREAM_DETAIL_MUST_NOT_LEAK'))
    assert.ok(requestSignal, 'OAuth fetch must have an abort signal')
  })

  test(`OAuth safety: ${path} reports revoked credentials without revealing values`, async () => {
    const oauth = await loadOAuthFunction(path, async () => ({
      ok: false, status: 400,
      json: async () => ({ error: 'invalid_grant', error_description: 'revoked' }),
    }))
    await assert.rejects(oauth(), error =>
      error.message.includes('expirou ou foi revogada')
      && !error.message.includes('test-only-credential'))
  })

  test(`OAuth safety: ${path} recovers from invalid upstream JSON`, async () => {
    const oauth = await loadOAuthFunction(path, async () => ({
      ok: false, status: 502,
      json: async () => { throw new SyntaxError('bad upstream payload') },
    }))
    await assert.rejects(oauth(), error =>
      /temporariamente indisponível/i.test(error.message))
  })

  test(`OAuth safety: ${path} preserves valid OAuth login`, async () => {
    const oauth = await loadOAuthFunction(path, async () => ({
      ok: true, status: 200,
      json: async () => ({ access_token: 'short-lived-test-token' }),
    }))
    assert.equal(await oauth(), 'short-lived-test-token')
  })
}
