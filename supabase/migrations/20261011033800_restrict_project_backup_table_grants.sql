-- Keep restructure backups service-only at the table privilege layer.
-- RLS remains enabled and has no client policies; service_role retains its existing grant.
-- Older/fresh environments without this optional backup table must keep migrating.
do $migration$
begin
  if to_regclass('public.project_restructure_backups') is not null then
    execute 'alter table public.project_restructure_backups enable row level security';
    execute 'revoke all privileges on table public.project_restructure_backups from anon, authenticated';
  end if;
end
$migration$;
