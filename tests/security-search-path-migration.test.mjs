import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const migration = await readFile(
  new URL('../supabase/migrations/20261011034500_pin_timestamp_trigger_search_path.sql', import.meta.url),
  'utf8',
);

test('all mutable timestamp trigger search paths are pinned to public', () => {
  for (const name of [
    'set_profiles_updated_at',
    'set_catalog_updated_at',
    'set_operational_updated_at',
    'set_settings_updated_at',
  ]) {
    assert.match(
      migration,
      new RegExp(`alter\\s+function\\s+public\\.${name}\\(\\)\\s+set\\s+search_path\\s*=\\s*public`, 'i'),
    );
  }
});
