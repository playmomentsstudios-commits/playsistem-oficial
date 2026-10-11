import test from 'node:test'
import assert from 'node:assert/strict'
import { PGlite } from '@electric-sql/pglite'
import { readFile } from 'node:fs/promises'

const migration = await readFile(
  new URL('../supabase/migrations/20261011033800_restrict_project_backup_table_grants.sql', import.meta.url),
  'utf8',
)

test('real PostgreSQL ACL: backup table is service-only after migration', async () => {
  const db = new PGlite()
  try {
    await db.exec(`
      create role anon nologin;
      create role authenticated nologin;
      create role service_role nologin;
      create table public.project_restructure_backups (id uuid primary key);
      grant all privileges on table public.project_restructure_backups
        to public, anon, authenticated, service_role;
    `)

    const before = (await db.query(`
      select has_table_privilege('anon','public.project_restructure_backups','truncate') as anon_truncate,
             has_table_privilege('authenticated','public.project_restructure_backups','select') as auth_select
    `)).rows[0]
    assert.deepEqual(before, { anon_truncate: true, auth_select: true })

    await db.exec(migration)

    const after = (await db.query(`
      select has_table_privilege('anon','public.project_restructure_backups','select') as anon_select,
             has_table_privilege('anon','public.project_restructure_backups','truncate') as anon_truncate,
             has_table_privilege('authenticated','public.project_restructure_backups','update') as auth_update,
             has_table_privilege('authenticated','public.project_restructure_backups','truncate') as auth_truncate,
             has_table_privilege('service_role','public.project_restructure_backups','select') as service_select,
             has_table_privilege('service_role','public.project_restructure_backups','truncate') as service_truncate,
             relrowsecurity as rls
      from pg_class where oid='public.project_restructure_backups'::regclass
    `)).rows[0]
    assert.deepEqual(after, {
      anon_select: false,
      anon_truncate: false,
      auth_update: false,
      auth_truncate: false,
      service_select: true,
      service_truncate: true,
      rls: true,
    })

    // Re-running the migration must be safe.
    await db.exec(migration)
  } finally {
    await db.close()
  }
})

test('optional backup table absent: migration remains safe for new environments', async () => {
  const db = new PGlite()
  try {
    await db.exec(migration)
  } finally {
    await db.close()
  }
})
