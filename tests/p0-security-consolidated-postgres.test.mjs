import test from 'node:test'
import assert from 'node:assert/strict'
import { PGlite } from '@electric-sql/pglite'
import { readFile } from 'node:fs/promises'

const migration = name => readFile(new URL('../supabase/migrations/' + name, import.meta.url), 'utf8')

test('consolidated P0 ACL and trigger search_path migrations preserve intended roles', async () => {
  const db = new PGlite()
  try {
    await db.exec(`
      create role anon nologin;
      create role authenticated nologin;
      create role service_role nologin;
      create table public.project_restructure_backups(id uuid primary key);
      create function public.release_order_stock(uuid) returns void language sql as $$ select $$;
      create function public.recalculate_customer_loyalty(uuid) returns void language sql as $$ select $$;
      create function public.submit_file_review(uuid,text,text) returns void language sql as $$ select $$;
      create function public.submit_file_review_v2(uuid,text,text,text,jsonb,jsonb) returns void language sql as $$ select $$;
      grant all on table public.project_restructure_backups to public, anon, authenticated, service_role;
      grant execute on function public.release_order_stock(uuid) to public, anon, authenticated, service_role;
      grant execute on function public.recalculate_customer_loyalty(uuid) to public, anon, authenticated, service_role;
      grant execute on function public.submit_file_review(uuid,text,text) to public, anon, authenticated, service_role;
      grant execute on function public.submit_file_review_v2(uuid,text,text,text,jsonb,jsonb) to public, anon, authenticated, service_role;
      create function public.set_profiles_updated_at() returns trigger language plpgsql as $$ begin return new; end $$;
      create function public.set_catalog_updated_at() returns trigger language plpgsql as $$ begin return new; end $$;
      create function public.set_operational_updated_at() returns trigger language plpgsql as $$ begin return new; end $$;
      create function public.set_settings_updated_at() returns trigger language plpgsql as $$ begin return new; end $$;
    `)
    for (const name of [
      '20261011033800_restrict_project_backup_table_grants.sql',
      '20261011034500_pin_timestamp_trigger_search_path.sql',
      '20261011040000_restrict_order_stock_release_rpc.sql',
      '20261011050300_restrict_customer_loyalty_recalc_rpc.sql',
      '20261011050400_secure_file_review_rpc_grants.sql',
    ]) await db.exec(await migration(name))

    const acl = (await db.query(`
      select
        has_table_privilege('anon','public.project_restructure_backups','select') as anon_backup,
        has_table_privilege('authenticated','public.project_restructure_backups','select') as auth_backup,
        has_table_privilege('service_role','public.project_restructure_backups','select') as service_backup,
        has_function_privilege('anon','public.release_order_stock(uuid)','execute') as anon_stock,
        has_function_privilege('authenticated','public.release_order_stock(uuid)','execute') as auth_stock,
        has_function_privilege('anon','public.recalculate_customer_loyalty(uuid)','execute') as anon_loyalty,
        has_function_privilege('authenticated','public.recalculate_customer_loyalty(uuid)','execute') as auth_loyalty,
        has_function_privilege('anon','public.submit_file_review(uuid,text,text)','execute') as anon_review,
        has_function_privilege('authenticated','public.submit_file_review(uuid,text,text)','execute') as auth_review,
        has_function_privilege('service_role','public.submit_file_review(uuid,text,text)','execute') as service_review,
        has_function_privilege('anon','public.submit_file_review_v2(uuid,text,text,text,jsonb,jsonb)','execute') as anon_review_v2,
        has_function_privilege('authenticated','public.submit_file_review_v2(uuid,text,text,text,jsonb,jsonb)','execute') as auth_review_v2
    `)).rows[0]
    assert.deepEqual(acl, {
      anon_backup: false, auth_backup: false, service_backup: true,
      anon_stock: false, auth_stock: false,
      anon_loyalty: false, auth_loyalty: false,
      anon_review: false, auth_review: true, service_review: true,
      anon_review_v2: false, auth_review_v2: true,
    })

    const paths = (await db.query(`
      select p.proname, p.proconfig
      from pg_proc p join pg_namespace n on n.oid=p.pronamespace
      where n.nspname='public'
        and p.proname in ('set_profiles_updated_at','set_catalog_updated_at','set_operational_updated_at','set_settings_updated_at')
      order by p.proname
    `)).rows
    assert.equal(paths.length, 4)
    for (const fn of paths) assert.ok(fn.proconfig?.includes('search_path=public'), fn.proname)
  } finally {
    await db.close()
  }
})
