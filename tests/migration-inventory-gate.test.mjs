import test from 'node:test'
import assert from 'node:assert/strict'
import { readdir } from 'node:fs/promises'
import { inspectMigrationNames } from '../scripts/migration-inventory.mjs'

test('migration inventory recognizes real 14-digit timestamps and duplicate versions', () => {
  assert.deepEqual(inspectMigrationNames([
    '20261011000000_first.sql',
    '20261011000000_second.sql',
    '20261011000001_third.sql',
    'bad-migration.sql',
    'README.md',
  ]), {
    files: 4,
    versions: 2,
    invalid: ['bad-migration.sql'],
    collisions: [{
      timestamp: '20261011000000',
      files: ['20261011000000_first.sql','20261011000000_second.sql'],
    }],
  })
})

test('current repository history is inventoried without connecting to production', async () => {
  const names = await readdir(new URL('../supabase/migrations/', import.meta.url))
  const report = inspectMigrationNames(names)
  assert.ok(report.files >= 100)
  assert.ok(report.versions <= report.files)
  assert.deepEqual(report.invalid, [])
  // Known legacy duplicate should be reported, never silently ignored.
  assert.ok(report.collisions.some(row => row.timestamp === '20260928173000'))
})
