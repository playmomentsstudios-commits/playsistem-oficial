-- Keep restructure backups available only to trusted server/database roles.
-- RLS remains enabled and has no client policies; service_role retains its existing grant.
-- Also revoke PUBLIC grants: they would otherwise be inherited by anon/authenticated.
-- Older/fresh environments without this optional backup table must keep migrating.
do $migration$
begin
  if to_regclass('public.project_restructure_backups') is not null then
    execute 'alter table public.project_restructure_backups enable row level security';
    execute 'revoke all privileges on table public.project_restructure_backups from public, anon, authenticated';
  end if;
end
$migration$;
