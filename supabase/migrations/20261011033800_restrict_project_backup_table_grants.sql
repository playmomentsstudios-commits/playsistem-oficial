-- Keep restructure backups service-only at the table privilege layer.
-- RLS remains enabled and has no client policies; service_role retains its existing grant.
alter table public.project_restructure_backups enable row level security;
revoke all privileges on table public.project_restructure_backups from anon, authenticated;
