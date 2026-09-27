-- Track resumable Google Drive uploads so recovery/finalization cannot be replayed across users or projects.

create table if not exists public.drive_upload_sessions (
  id uuid primary key,
  user_id uuid not null references public.profiles(id) on delete cascade,
  project_id uuid not null references public.projects(id) on delete cascade,
  upload_url text not null,
  file_name text not null,
  file_size bigint not null check (file_size > 0),
  status text not null default 'active' check (status in ('active','completed','expired')),
  created_at timestamptz not null default now(),
  completed_at timestamptz
);

create unique index if not exists drive_upload_sessions_upload_url_key
  on public.drive_upload_sessions(upload_url);

create index if not exists drive_upload_sessions_user_project_idx
  on public.drive_upload_sessions(user_id,project_id,created_at desc);

alter table public.drive_upload_sessions enable row level security;
-- No authenticated policies: this table is intentionally service-role only.
revoke all on public.drive_upload_sessions from anon, authenticated;
