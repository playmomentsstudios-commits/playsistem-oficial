import test from 'node:test';
import assert from 'node:assert/strict';
import { readdir, readFile } from 'node:fs/promises';

const dir = new URL('../supabase/migrations/', import.meta.url);
const files = (await readdir(dir)).filter((name) => name.endsWith('.sql')).sort();
const groups = new Map();

for (const file of files) {
  const timestamp = file.match(/^(\d{14})_/)?.[1];
  if (!timestamp) continue;
  groups.set(timestamp, [...(groups.get(timestamp) || []), file]);
}

const duplicates = [...groups]
  .filter(([, names]) => names.length > 1)
  .map(([timestamp, names]) => [timestamp, [...names].sort()]);

test('migration timestamps remain unique except grandfathered collision', () => {
  assert.deepEqual(duplicates, [[
    '20260928173000',
    [
      '20260928173000_academy_2_certificates_cohorts.sql',
      '20260928173000_public_digital_literacy.sql',
    ],
  ]]);
});

test('renumbered digital literacy migration documents the repair', async () => {
  const source = await readFile(
    new URL('../supabase/migrations/20260928174000_public_digital_literacy.sql', import.meta.url),
    'utf8',
  );
  assert.match(source, /Renumerada porque 20260928173000/);
});
