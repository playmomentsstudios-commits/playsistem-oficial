\set ON_ERROR_STOP on
-- This data is synthetic and runs ONLY in the ephemeral local Postgres container.
-- Supabase local roles anon/authenticated/service_role already exist.
drop table if exists public.project_restructure_backups;
create table public.project_restructure_backups (id uuid primary key);
alter table public.project_restructure_backups enable row level security;
grant all privileges on table public.project_restructure_backups
  to public, anon, authenticated, service_role;

do $$
begin
  if not has_table_privilege('anon', 'public.project_restructure_backups', 'TRUNCATE')
     or not has_table_privilege('authenticated', 'public.project_restructure_backups', 'SELECT')
  then
    raise exception 'Invalid fixture: expected initial client permissions';
  end if;
end $$;
