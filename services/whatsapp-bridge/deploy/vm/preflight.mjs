// Checagem local de seguranca. Nao faz rede, nao acessa Supabase e nao envia WhatsApp.
import { readFileSync, statSync } from 'node:fs'
import { resolve } from 'node:path'

const envPath = resolve(process.cwd(), '.env')
function fail(message) {
  console.error('[preflight] ' + message)
  process.exitCode = 1
}

try {
  const stat = statSync(envPath)
  if (!stat.isFile()) throw new Error('O .env precisa ser um arquivo regular.')
  if ((stat.mode & 0o077) !== 0) throw new Error('O .env deve ter permissao 0600 (sem acesso de grupo/outros).')
  if (process.getuid?.() !== undefined && stat.uid !== process.getuid()) {
    throw new Error('O .env deve pertencer ao usuario do servico.')
  }
  const values = new Map()
  for (const line of readFileSync(envPath, 'utf8').split(/\r?\n/)) {
    const trimmed = line.trim()
    if (!trimmed || trimmed.startsWith('#')) continue
    const eq = trimmed.indexOf('=')
    if (eq <= 0) continue
    const key = trimmed.slice(0, eq).trim()
    let val = trimmed.slice(eq + 1).trim()
    if ((val.startsWith('"') && val.endsWith('"')) || (val.startsWith("'") && val.endsWith("'"))) val = val.slice(1, -1)
    values.set(key, val)
  }
  let validUrl = false
  try { const u = new URL(values.get('SUPABASE_URL')); validUrl = u.protocol === 'https:' && Boolean(u.hostname) } catch {}
  if (!validUrl) throw new Error('SUPABASE_URL precisa ser uma URL HTTPS valida.')
  if (!values.get('SUPABASE_SERVICE_ROLE_KEY') || values.get('SUPABASE_SERVICE_ROLE_KEY').length < 30) {
    throw new Error('SUPABASE_SERVICE_ROLE_KEY ausente ou incompleta.')
  }
  if (!/^55\d{10,11}$/.test(values.get('SAGAMENTE_WHATSAPP_PHONE') || '')) {
    throw new Error('SAGAMENTE_WHATSAPP_PHONE deve conter DDI 55 e DDD, apenas digitos.')
  }
  console.log('[preflight] Configuracao basica aprovada. Nenhuma mensagem foi enviada.')
} catch (error) {
  fail(error.message || 'Falha de validacao.')
}
