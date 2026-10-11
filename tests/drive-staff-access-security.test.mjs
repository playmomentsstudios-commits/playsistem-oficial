import test from 'node:test'
import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import { runInNewContext } from 'node:vm'
import ts from 'typescript'

const helpers = [
  '../supabase/functions/_shared/googleDrive.ts',
  '../supabase/functions/_shared/chatDriveAuth.ts',
]

async function loadAuth(path, profile, staff, staffError = null) {
  const src = await readFile(new URL(path, import.meta.url), 'utf8')
  const compiled = ts.transpileModule(src, {
    compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.CommonJS },
  }).outputText
  const db = {
    auth: { getUser: async () => ({
      data: { user: { id: 'test-user' } }, error: null,
    }) },
    from(table) {
      return {
        select() { return this },
        eq() { return this },
        single: async () => ({ data: profile, error: null }),
        maybeSingle: async () => ({
          data: staff,
          error: table === 'staff_profiles' ? staffError : null,
        }),
      }
    },
  }
  const ctx = {
    exports: {},
    require: () => ({ createClient: () => db }),
    Deno: { env: { get: () => 'test-only-credential' } },
    URLSearchParams,
    AbortSignal,
  }
  runInNewContext(compiled, ctx)
  const request = { headers: { get: () => 'Bearer fake-signed-in-token' } }
  return { auth: ctx.exports, request }
}

for (const path of helpers) {
  test(`Staff guard: inactive collaborator denied in ${path}`, async () => {
    const { auth, request } = await loadAuth(path,
      { role: 'staff', status: 'active' },
      { active: false, permissions: ['*'] })
    const user = await auth.requireUser(request)
    assert.equal(user.staffActive, false)
    assert.equal(auth.hasPermission(user, 'files.manage'), false)
    assert.throws(() => auth.requireStaff(user), /Staff access required/)
  })

  test(`Staff guard: active collaborator retains explicit permissions in ${path}`, async () => {
    const { auth, request } = await loadAuth(path,
      { role: 'staff', status: 'active' },
      { active: true, permissions: ['files.manage'] })
    const user = await auth.requireUser(request)
    assert.equal(user.staffActive, true)
    assert.equal(auth.hasPermission(user, 'files.manage'), true)
    assert.doesNotThrow(() => auth.requireStaff(user))
  })

  test(`Staff guard: missing staff row denied in ${path}`, async () => {
    const { auth, request } = await loadAuth(path,
      { role: 'staff', status: 'active' }, null)
    const user = await auth.requireUser(request)
    assert.equal(user.staffActive, false)
    assert.throws(() => auth.requireStaff(user), /Staff access required/)
  })

  test(`Staff guard: staff lookup errors fail closed in ${path}`, async () => {
    const { auth, request } = await loadAuth(path,
      { role: 'staff', status: 'active' }, null, new Error('temporary query failure'))
    await assert.rejects(auth.requireUser(request), /Unable to verify collaborator access/)
  })

  test(`Staff guard: administrator stays authorized, customer stays denied in ${path}`, async () => {
    const admin = await loadAuth(path, { role: 'admin', status: 'active' }, null)
    const a = await admin.auth.requireUser(admin.request)
    assert.doesNotThrow(() => admin.auth.requireStaff(a))
    const customer = await loadAuth(path, { role: 'customer', status: 'active' }, null)
    const c = await customer.auth.requireUser(customer.request)
    assert.throws(() => customer.auth.requireStaff(c), /Staff access required/)
  })
}
