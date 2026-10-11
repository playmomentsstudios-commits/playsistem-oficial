import test from 'node:test'
import assert from 'node:assert/strict'
import { mkdtempSync, writeFileSync, chmodSync, readFileSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join, resolve } from 'node:path'
import { spawnSync } from 'node:child_process'
import { fileURLToPath } from 'node:url'

const base = resolve(fileURLToPath(new URL('..', import.meta.url)))
const preflight = join(base, 'services/whatsapp-bridge/deploy/vm/preflight.mjs')
const install = join(base, 'services/whatsapp-bridge/deploy/vm/install-service.sh')
function runEnv(body, mode = 0o600) {
  const dir = mkdtempSync(join(tmpdir(), 'sagamente-wa-test-'))
  try {
    const envFile = join(dir, '.env')
    writeFileSync(envFile, body)
    chmodSync(envFile, mode)
    return spawnSync(process.execPath, [preflight], { cwd: dir, encoding: 'utf8' })
  } finally { rmSync(dir, { recursive: true, force: true }) }
}
const valid = 'SUPABASE_URL=https://example.supabase.co\nSUPABASE_SERVICE_ROLE_KEY=' + 'x'.repeat(45) + '\nSAGAMENTE_WHATSAPP_PHONE=5562987654321\n'
test('preflight valido nao imprime credenciais', () => {
  const res = runEnv(valid)
  assert.equal(res.status, 0, res.stderr)
  assert.doesNotMatch(res.stdout + res.stderr, /x{10,}/)
})
test('preflight rejeita permissoes excessivas', () => {
  const res = runEnv(valid, 0o644)
  assert.notEqual(res.status, 0)
  assert.match(res.stderr, /0600/)
})
test('preflight rejeita telefone invalido', () => {
  const res = runEnv(valid.replace('5562987654321', '12345'))
  assert.notEqual(res.status, 0)
  assert.match(res.stderr, /SAGAMENTE_WHATSAPP_PHONE/)
})
test('instalador nunca inicia o servico automaticamente', () => {
  const script = readFileSync(install, 'utf8')
  assert.doesNotMatch(script, /systemctl\s+(?:start|enable|restart)\b/)
  assert.match(script, /ProtectSystem=strict/)
  assert.match(script, /ReadWritePaths=/)
})
