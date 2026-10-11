\set ON_ERROR_STOP on
-- Verify the actual PR #355 migration, NOT a copied/reimplemented SQL substitute.
do $$
declare
  backup_rel oid;
begin
  backup_rel := to_regclass('public.project_restructure_backups');
  if backup_rel is null then raise exception 'Backup fixture table missing'; end if;

  if not (select relrowsecurity from pg_class where oid = backup_rel) then
    raise exception 'RLS is not enabled on the backups table';
  end if;
  if has_table_privilege('anon', backup_rel, 'SELECT')
     or has_table_privilege('anon', backup_rel, 'TRUNCATE')
     or has_table_privilege('authenticated', backup_rel, 'SELECT')
     or has_table_privilege('authenticated', backup_rel, 'UPDATE')
     or has_table_privilege('authenticated', backup_rel, 'TRUNCATE')
  then
    raise exception 'Client still has direct or inherited privileges';
  end if;
  if not has_table_privilege('service_role', backup_rel, 'SELECT')
     or not has_table_privilege('service_role', backup_rel, 'TRUNCATE')
  then
    raise exception 'Service role lost required privileges';
  end if;
end $$;
select 'PASS: backup ACLs restricted, RLS enabled, service access preserved' as result;
