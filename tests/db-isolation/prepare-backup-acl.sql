\set ON_ERROR_STOP on
-- Synthetic grants only in the ephemeral local Postgres container.
-- Supabase local roles anon/authenticated/service_role already exist.
drop table if exists public.project_restructure_backups;
create table public.project_restructure_backups (id uuid primary key);
alter table public.project_restructure_backups enable row level security;
grant all privileges on table public.project_restructure_backups
  to public, anon, authenticated, service_role;

do $$
declare
  role_name text;
  privilege_name text;
  fixture_roles text[] := array['anon', 'authenticated', 'service_role'];
  table_privileges text[] := array[
    'SELECT', 'INSERT', 'UPDATE', 'DELETE', 'TRUNCATE', 'REFERENCES', 'TRIGGER'
  ];
begin
  foreach role_name in array fixture_roles loop
    foreach privilege_name in array table_privileges loop
      if not has_table_privilege(role_name, 'public.project_restructure_backups', privilege_name) then
        raise exception 'Invalid fixture: role % lacks initial % privilege',
          role_name, privilege_name;
      end if;
    end loop;
  end loop;
end $$;
