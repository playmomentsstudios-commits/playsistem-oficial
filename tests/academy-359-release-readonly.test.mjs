import test from 'node:test'
import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'

const dir='../docs/security/academy-359/'
const read=name=>readFile(new URL(dir+name,import.meta.url),'utf8')

test('release manifest remains blocked pending verified backup',async()=>{
  const m=JSON.parse(await read('release-manifest.json'))
  assert.equal(m.target_pull_request,359)
  assert.equal(m.expected_pr_head_sha,'3bb14f4423d492ed4b2e1fed4e2a945024174351')
  assert.equal(m.migration_version,'20261011060000')
  assert.equal(m.production_snapshot.baseline_body_normalized_md5,'2cde6ea773130830e6ee8d93ca81f181')
  assert.equal(m.production_snapshot.migration_recorded_before,false)
  assert.equal(m.evidence.backup_restoration_verified,false)
  assert.equal(m.evidence.staging_supabase_branch_exists,false)
  assert.equal(m.release_gate.approval_to_apply_in_production,false)
  assert.ok(m.release_gate.required_before_release.length>=5)
})

test('preflight and postflight are read-only catalog queries',async()=>{
  for(const name of ['preflight-readonly.sql','postflight-readonly.sql']){
    const source=(await read(name)).replace(/--[^\n]*/g,'')
    const statements=source.split(';').map(s=>s.trim()).filter(Boolean)
    assert.ok(statements.length>=2,'Expected catalog and version queries')
    for(const sql of statements)
      assert.match(sql,/^(select|with)\s/i,name+' cannot contain write statements')
    assert.doesNotMatch(source,/\b(update|insert|delete|truncate|alter|drop|grant|revoke|create|call|do)\s/i)
    assert.match(source,/supabase_migrations\.schema_migrations/i)
  }
})

test('preflight proves baseline; postflight verifies authentication guard',async()=>{
  const before=await read('preflight-readonly.sql')
  const after=await read('postflight-readonly.sql')
  assert.match(before,/2cde6ea773130830e6ee8d93ca81f181/)
  assert.match(before,/1f616a95576e00b167fc01b815f8b659/)
  assert.match(before,/116309ee0123f96ccbd9b6a8d9f386c4/)
  assert.match(before,/CATALOG_PRECHECK_OK/)
  assert.match(after,/TARGET_ACL_AND_GUARD_OK/)
  assert.match(after,/if auth\.uid\(\) is null then/)
  assert.match(after,/has_function_privilege\('anon'/)
})

test('runbook requires backup, approval and security-preserving rollback',async()=>{
  const s=await read('controlled-release-runbook.md')
  assert.match(s,/backup.*restaur/i)
  assert.match(s,/roll-forward/i)
  assert.match(s,/n[aã]o executar rollback SQL antigo automaticamente/i)
  assert.match(s,/autorização expressa/i)
})
