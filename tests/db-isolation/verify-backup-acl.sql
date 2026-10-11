\set ON_ERROR_STOP on
-- Verify the actual immutable PR #355 migration, not a copied SQL substitute.
do $$
declare
  backup_rel oid;
  role_name text;
  privilege_name text;
  client_roles text[] := array['anon', 'authenticated'];
  table_privileges text[] := array[
    'SELECT', 'INSERT', 'UPDATE', 'DELETE', 'TRUNCATE', 'REFERENCES', 'TRIGGER'
  ];
begin
  backup_rel := to_regclass('public.project_restructure_backups');
  if backup_rel is null then raise exception 'Backup fixture table missing'; end if;

  if not (select relrowsecurity from pg_class where oid = backup_rel) then
    raise exception 'RLS is not enabled on the backups table';
  end if;

  foreach role_name in array client_roles loop
    foreach privilege_name in array table_privileges loop
      if has_table_privilege(role_name, backup_rel, privilege_name) then
        raise exception 'Client role % still has direct or inherited % privilege',
          role_name, privilege_name;
      end if;
    end loop;
  end loop;

  foreach privilege_name in array table_privileges loop
    if not has_table_privilege('service_role', backup_rel, privilege_name) then
      raise exception 'service_role lost required % privilege', privilege_name;
    end if;
  end loop;
end $$;
select 'PASS: all client ACLs revoked, RLS enabled, service access preserved' as result;
