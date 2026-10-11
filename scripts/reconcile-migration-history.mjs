#!/usr/bin/env node
// Read-only reconciliation of SQL filenames and Supabase migration VERSION METADATA.
// Does not connect to production. Matching names are NOT SQL equivalence evidence.
import { readdir, readFile, writeFile, appendFile } from 'node:fs/promises'
import { resolve } from 'node:path'
import { pathToFileURL } from 'node:url'

export function validCalendarTimestamp(s) {
  if (!/^\d{14}$/.test(s || '')) return false
  const [y,m,d,h,mi,se] = [s.slice(0,4),s.slice(4,6),s.slice(6,8),
    s.slice(8,10),s.slice(10,12),s.slice(12,14)].map(Number)
  const x = new Date(Date.UTC(y,m-1,d,h,mi,se))
  return x.getUTCFullYear() === y && x.getUTCMonth()+1 === m
    && x.getUTCDate() === d && x.getUTCHours() === h
    && x.getUTCMinutes() === mi && x.getUTCSeconds() === se
}

export function reconcileMigrationHistory(localFileNames, remoteMigrations) {
  if (!Array.isArray(localFileNames) || !Array.isArray(remoteMigrations))
    throw new Error('Expected two arrays of migration metadata')
  const invalidFileNames = []
  const local = localFileNames.filter(n => n.endsWith('.sql')).sort().flatMap(filename => {
    const m = /^(\d{14})_([A-Za-z0-9_-]+)\.sql$/.exec(filename)
    if (!m) { invalidFileNames.push(filename); return [] }
    return [{filename, version:m[1], name:m[2]}]
  })
  const seenRemote = new Set()
  for (const r of remoteMigrations) {
    if (!r || typeof r !== 'object' || !/^\d{14}$/.test(r.version || '')
      || !/^[A-Za-z0-9_-]+$/.test(r.name || ''))
      throw new Error('Malformed remote migration metadata')
    if (seenRemote.has(r.version)) throw new Error('Duplicate remote version')
    seenRemote.add(r.version)
  }
  const byVersion = new Map(), byName = new Map()
  for (const f of local) {
    byVersion.set(f.version, [...(byVersion.get(f.version) || []), f])
    byName.set(f.name, [...(byName.get(f.name) || []), f])
  }
  const collisions = [...byVersion].filter(([,rows]) => rows.length > 1)
    .map(([version,rows]) => ({version,files:rows.map(r=>r.filename)}))
  const invalidDatetimes = local.filter(f => !validCalendarTimestamp(f.version))
    .map(f => f.filename)
  const exactVersion = [], nameOnly = [], remoteOnly = [], ambiguous = []
  for (const r of remoteMigrations) {
    const matchesVersion = byVersion.get(r.version) || []
    const matchesName = byName.get(r.name) || []
    if (matchesVersion.length > 1) {
      ambiguous.push({remote:r, files:matchesVersion.map(x=>x.filename), reason:'duplicate version'})
    } else if (matchesVersion.length === 1) {
      exactVersion.push({remote:r,local:matchesVersion[0].filename,
        name_equal: r.name === matchesVersion[0].name})
    } else if (matchesName.length > 1) {
      ambiguous.push({remote:r, files:matchesName.map(x=>x.filename),reason:'duplicate name'})
    } else if (matchesName.length === 1) {
      nameOnly.push({remote:r,local:matchesName[0].filename})
    } else {
      remoteOnly.push(r)
    }
  }
  return {
    summary: {
      local_sql_files:localFileNames.filter(n=>n.endsWith('.sql')).length,
      remote_records:remoteMigrations.length,
      exact_version_matches:exactVersion.length,
      same_name_different_version:nameOnly.length,
      remote_unmatched:remoteOnly.length,
      invalid_calendar_timestamps:invalidDatetimes.length,
      duplicate_local_versions:collisions.length,
      local_without_remote_version:local.filter(f=>!seenRemote.has(f.version)).length,
      equivalence_verified:false,
      ready_for_full_replay:false
    },
    exactVersion,nameOnly,remoteOnly,ambiguous,collisions,invalidDatetimes,invalidFileNames
  }
}

export function renderReport(report, observedAt = 'unknown') {
  const {summary:s}=report
  const q = String.fromCharCode(96)
  const lines = [
    '# SAGAMENTE — Migration History Reconciliation (READ ONLY)',
    '',
    'Snapshot observed: '+observedAt+'. No production SQL was executed.',
    '',
    '| Check | Count |',
    '|---|---:|',
    '| Local SQL files | '+s.local_sql_files+' |',
    '| Remote migration records | '+s.remote_records+' |',
    '| Exact version matches | '+s.exact_version_matches+' |',
    '| Same name, different version | '+s.same_name_different_version+' |',
    '| Remote version/name unmatched | '+s.remote_unmatched+' |',
    '| Invalid local calendar timestamp | '+s.invalid_calendar_timestamps+' |',
    '| Duplicate local versions | '+s.duplicate_local_versions+' |',
    '',
    '**BLOCKED — histories are NOT reconciled. No automatic replay or db push is authorized.**',
    '',
    '## Same-name candidates (never proof of SQL equivalence)',
    '| Remote | Local file |',
    '|---|---|'
  ]
  for(const x of report.nameOnly) lines.push('| '+q+x.remote.version+'_'+x.remote.name+q+' | '+q+x.local+q+' |')
  lines.push('', '## Remote-only entries')
  for(const x of report.remoteOnly) lines.push('- '+q+x.version+'_'+x.name+q)
  lines.push('', '## Invalid timestamp files')
  for(const x of report.invalidDatetimes) lines.push('- '+q+x+q)
  lines.push('', '## Duplicate local versions')
  for(const x of report.collisions) lines.push('- '+q+x.version+q+': '+x.files.join(', '))
  lines.push('', '### Next gate',
    'Compare actual SQL/DDL semantics for '+s.same_name_different_version+' same-name candidates, resolve remote-only versions,',
    'document the local timestamp problems and prepare a separately reviewed local baseline.',
    'Never run reconciliation writes against production without approval.', '')
  return lines.join('\n')
}

async function main(args) {
  const i=args.indexOf('--remote')
  if(i<0 || !args[i+1]) throw new Error('Usage: node scripts/reconcile-migration-history.mjs --remote <metadata.json> [--output <report.json>]')
  const metadata = JSON.parse(await readFile(resolve(args[i+1]),'utf8'))
  if(!metadata || !Array.isArray(metadata.migrations)) throw new Error('Missing migrations array')
  const files = await readdir(resolve('supabase/migrations'))
  const report = reconcileMigrationHistory(files,metadata.migrations)
  const markdown=renderReport(report,metadata.observed_at)
  process.stdout.write(markdown+'\n')
  if(process.env.GITHUB_STEP_SUMMARY) await appendFile(process.env.GITHUB_STEP_SUMMARY,markdown+'\n')
  const j=args.indexOf('--output')
  if(j>=0){
    if(!args[j+1])throw new Error('Missing report path')
    await writeFile(resolve(args[j+1]),JSON.stringify(report,null,2)+'\n')
  }
  if(report.invalidFileNames.length)throw new Error('Migration filenames cannot be parsed')
}

if(process.argv[1] && import.meta.url===pathToFileURL(resolve(process.argv[1])).href)
  await main(process.argv.slice(2))
