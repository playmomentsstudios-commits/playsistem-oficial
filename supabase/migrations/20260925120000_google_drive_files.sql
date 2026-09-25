-- Google Drive + Central de Arquivos.
-- Requer migrations anteriores até 20260925110000 aplicadas.

alter table public.profiles
  add column if not exists drive_folder_id text;

alter table public.projects
  add column if not exists drive_folder_id text;

alter table public.client_files
  add column if not exists storage_provider text not null default 'supabase'
    check (storage_provider in ('supabase','google_drive','external')),
  add column if not exists drive_file_id text,
  add column if not exists drive_folder_id text,
  add column if not exists file_size bigint,
  add column if not exists mime_type text;

update public.client_files
set storage_provider = case
  when drive_file_id is not null then 'google_drive'
  when external_url is not null and storage_path is null then 'external'
  else 'supabase'
end
where storage_provider='supabase';

create index if not exists profiles_drive_folder_idx
  on public.profiles(drive_folder_id)
  where drive_folder_id is not null;

create index if not exists projects_drive_folder_idx
  on public.projects(drive_folder_id)
  where drive_folder_id is not null;

create index if not exists client_files_drive_file_idx
  on public.client_files(drive_file_id)
  where drive_file_id is not null;

create table if not exists public.drive_settings (
  id boolean primary key default true check(id),
  root_folder_id text,
  clients_folder_id text,
  root_folder_name text not null default 'PLAY MOMENTS',
  updated_at timestamptz not null default now(),
  updated_by uuid references public.profiles(id) on delete set null
);

insert into public.drive_settings(id)
values(true)
on conflict(id) do nothing;

alter table public.drive_settings enable row level security;

drop policy if exists drive_settings_staff_read on public.drive_settings;
create policy drive_settings_staff_read
on public.drive_settings
for select
to authenticated
using (public.current_user_is_staff_or_admin());

grant select on public.drive_settings to authenticated;

create table if not exists public.project_drive_folders (
  project_id uuid not null references public.projects(id) on delete cascade,
  folder_kind text not null check(folder_kind in (
    'received',
    'raw',
    'production',
    'preview',
    'approved',
    'delivery'
  )),
  drive_folder_id text not null,
  folder_name text not null,
  created_at timestamptz not null default now(),
  primary key(project_id,folder_kind)
);

alter table public.project_drive_folders enable row level security;

drop policy if exists project_drive_folders_read on public.project_drive_folders;
create policy project_drive_folders_read
on public.project_drive_folders
for select
to authenticated
using (
  public.current_user_is_staff_or_admin()
  or (
    public.current_user_is_active_customer()
    and exists(
      select 1
      from public.projects p
      where p.id=project_id and p.customer_id=auth.uid()
    )
  )
);

grant select on public.project_drive_folders to authenticated;

create or replace function public.validate_drive_client_file()
returns trigger
language plpgsql
set search_path=public
as $$
begin
  if new.storage_provider='google_drive' and new.drive_file_id is null then
    raise exception 'Google Drive file id is required' using errcode='23514';
  end if;

  if new.storage_provider='supabase' and new.storage_path is null then
    raise exception 'Supabase storage path is required' using errcode='23514';
  end if;

  if new.storage_provider='external' and new.external_url is null then
    raise exception 'External URL is required' using errcode='23514';
  end if;

  return new;
end;
$$;

drop trigger if exists client_files_validate_provider on public.client_files;
create trigger client_files_validate_provider
before insert or update of storage_provider,drive_file_id,storage_path,external_url
on public.client_files
for each row execute function public.validate_drive_client_file();
