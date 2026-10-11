#!/usr/bin/env node
// Advisory-only inventory. NEVER connects to a hosted Supabase database.
import { readdir } from 'node:fs/promises'
import { resolve } from 'node:path'

export function inspectMigrationNames(names) {
  const sql = names.filter(name => name.endsWith('.sql')).sort()
  const versions = new Map()
  const invalid = []
  for (const name of sql) {
    const matched = /^(\d{14})_[A-Za-z0-9_-]+\.sql$/.exec(name)
    if (!matched) {
      invalid.push(name)
      continue
    }
    versions.set(matched[1], [...(versions.get(matched[1]) || []), name])
  }
  return {
    files: sql.length,
    versions: versions.size,
    invalid,
    collisions: [...versions.entries()].filter(([, files]) => files.length > 1)
      .map(([timestamp, files]) => ({ timestamp, files })),
  }
}

async function main() {
  const root = resolve(process.cwd(), 'supabase/migrations')
  const report = inspectMigrationNames(await readdir(root))
  const details = report.collisions.length
    ? report.collisions.map(c => `- \`${c.timestamp}\`: ${c.files.join(', ')}`).join('\n')
    : '- Nenhuma'
  const summary = [
    '## Inventário de migrações — somente leitura',
    '',
    `- Arquivos SQL no repositório: **${report.files}**`,
    `- Versões distintas nos arquivos: **${report.versions}**`,
    `- Arquivos fora do padrão: **${report.invalid.length}**`,
    `- Colisões de timestamp: **${report.collisions.length}**`,
    '',
    '### Colisões existentes',
    details,
    '',
    '> **Não equivale a validação integral da base.** O histórico remoto possui versões',
    '> independentes e precisa ser reconciliado. Nenhuma conexão de produção foi feita.',
    '',
  ].join('\n')
  process.stdout.write(summary)
  if (process.env.GITHUB_STEP_SUMMARY) {
    const { appendFile } = await import('node:fs/promises')
    await appendFile(process.env.GITHUB_STEP_SUMMARY, summary)
  }
  if (report.invalid.length) {
    process.stderr.write('Arquivos com nomes inválidos: '+report.invalid.join(', ')+'\n')
    process.exitCode = 1
  }
  // Historical collisions are reported, not silently accepted as safe.
  if (report.collisions.length) {
    process.stdout.write('::warning title=Histórico de migrações::Colisões de timestamp exigem reconciliação antes do replay integral.\n')
  }
}

if (process.argv[1] && import.meta.url === new URL('file://' + resolve(process.argv[1])).href) {
  await main()
}
