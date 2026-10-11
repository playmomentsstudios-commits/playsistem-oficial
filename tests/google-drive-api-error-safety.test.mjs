import test from 'node:test'
import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import { runInNewContext } from 'node:vm'
import ts from 'typescript'

const helpers = [
  '../supabase/functions/_shared/googleDrive.ts',
  '../supabase/functions/_shared/chatDriveAuth.ts',
]

async function getDriveJson(path, response) {
  const source = await readFile(new URL(path, import.meta.url), 'utf8')
  const compiled = ts.transpileModule(source, {
    compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.CommonJS },
  }).outputText
  const requests = []
  const sandbox = {
    exports: {},
    require: () => ({}),
    Deno: { env: { get: () => 'dummy-test-secret' } },
    URLSearchParams,
    AbortSignal,
    fetch: async (url, init) => {
      requests.push({ url, init })
      if (requests.length === 1) {
        return { ok: true, status: 200, json: async () => ({ access_token: 'mock-access' }) }
      }
      return response
    },
  }
  runInNewContext(compiled, sandbox)
  return { driveJson: sandbox.exports.driveJson, requests }
}

for (const helper of helpers) {
  test(`Drive API: ${helper} sanitizes Google error payloads and never leaks secrets`, async () => {
    for (const status of [400, 403, 404, 429, 502]) {
      const { driveJson, requests } = await getDriveJson(helper, {
        ok: false, status,
        text: async () => JSON.stringify({
          error: { message: 'NEVER_SHOW_INTERNAL_FILE_ID_OR_PRIVATE_GOOGLE_DETAILS' },
        }),
      })
      await assert.rejects(driveJson('https://www.googleapis.com/drive/v3/files/test'), error => (
        !error.message.includes('NEVER_SHOW_INTERNAL_FILE_ID_OR_PRIVATE_GOOGLE_DETAILS')
        && !error.message.includes('dummy-test-secret')
        && /Google Drive|Google/.test(error.message)
      ))
      assert.equal(requests.length, 2)
      assert.equal(requests[1].init.headers.Authorization, 'Bearer mock-access')
    }
  })

  test(`Drive API: ${helper} handles invalid upstream JSON without emitting raw body`, async () => {
    const { driveJson } = await getDriveJson(helper, {
      ok: false, status: 503, text: async () => '<private invalid upstream html>',
    })
    await assert.rejects(driveJson('https://www.googleapis.com/drive/v3/files/test'), error =>
      /temporariamente indisponível/i.test(error.message)
      && !error.message.includes('<private'))
  })

  test(`Drive API: ${helper} retains valid success payloads`, async () => {
    const { driveJson } = await getDriveJson(helper, {
      ok: true, status: 200,
      text: async () => '{"id":"mock-file-id","name":"exemplo.png"}',
    })
    assert.deepEqual(await driveJson('https://www.googleapis.com/drive/v3/files/test'), {
      id: 'mock-file-id',
      name: 'exemplo.png',
    })
  })
}
