import test from 'node:test'
import assert from 'node:assert/strict'
import { readdir,readFile } from 'node:fs/promises'
import { reconcileMigrationHistory,validCalendarTimestamp,renderReport } from '../scripts/reconcile-migration-history.mjs'

test('strict calendar timestamp validation catches rollover hours and minutes',()=>{
  assert.equal(validCalendarTimestamp('20261011031000'),true)
  assert.equal(validCalendarTimestamp('20260926240000'),false)
  assert.equal(validCalendarTimestamp('20260929007000'),false)
  assert.equal(validCalendarTimestamp('20260230000000'),false)
})

test('matching migration names are candidates, never verified SQL equivalence',()=>{
  const r=reconcileMigrationHistory([
    '20261011010000_example.sql',
    '20261011020000_other.sql',
    '20261011020000_collision.sql',
    '20260926240000_invalid_hour.sql',
  ],[
    {version:'20261011010200',name:'example'},
    {version:'20261011020000',name:'other'},
    {version:'20261011040000',name:'remote_only'},
  ])
  assert.equal(r.summary.same_name_different_version,1)
  assert.equal(r.summary.exact_version_matches,0)
  assert.equal(r.ambiguous.length,1)
  assert.equal(r.summary.remote_unmatched,1)
  assert.equal(r.summary.duplicate_local_versions,1)
  assert.equal(r.summary.invalid_calendar_timestamps,1)
  assert.equal(r.summary.equivalence_verified,false)
  assert.equal(r.summary.ready_for_full_replay,false)
  assert.match(renderReport(r),/NOT reconciled/)
  assert.ok(renderReport(r).includes('Compare actual SQL/DDL semantics for 1 same-name candidates'))
})

test('rejects malformed remote records and duplicated versions',()=>{
  assert.throws(()=>reconcileMigrationHistory([],[{version:'not-a-version',name:'x'}]),/Malformed/)
  assert.throws(()=>reconcileMigrationHistory([],[{version:'20261011010101',name:'a'},{version:'20261011010101',name:'b'}]),/Duplicate/)
})

test('committed remote snapshot is reconciled against a variable local migration inventory',async()=>{
  const snapshot=JSON.parse(await readFile(new URL('../docs/security/remote-migration-metadata-2026-10-11.json',import.meta.url),'utf8'))
  const local=await readdir(new URL('../supabase/migrations/',import.meta.url))
  const r=reconcileMigrationHistory(local,snapshot.migrations)
  assert.equal(r.summary.remote_records,snapshot.migrations.length)
  assert.ok(r.summary.local_sql_files>=138)
  assert.equal(r.summary.exact_version_matches,0)
  assert.ok(r.summary.same_name_different_version>=26)
  assert.equal(r.summary.remote_unmatched,13)
  assert.ok(r.summary.invalid_calendar_timestamps>=6)
  assert.ok(r.summary.duplicate_local_versions>=1)
  assert.equal(r.summary.local_without_remote_version,r.summary.local_sql_files)
  assert.deepEqual(r.invalidFileNames,[])
  assert.ok(r.collisions.some(x=>x.version==='20260928173000'))
  assert.ok(r.remoteOnly.some(x=>x.name==='wa_truthful_project_status_copy'))
  assert.ok(r.invalidDatetimes.some(x=>x.startsWith('20260926240000')))
})
