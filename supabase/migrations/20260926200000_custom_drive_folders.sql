-- Custom folders inside standard project Drive folders.

create table if not exists public.project_custom_folders (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references public.projects(id) on delete cascade,
  parent_kind text not null check(parent_kind in ('received','raw','production','preview','approved','delivery')),
  name text not null check(length(btrim(name)) between 1 and 120),
  drive_folder_id text not null unique,
  client_visible boolean not null default false,
  created_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  unique(project_id,parent_kind,name)
);

alter table public.project_custom_folders enable row level security;

drop policy if exists project_custom_folders_read on public.project_custom_folders;
create policy project_custom_folders_read
on public.project_custom_folders
for select to authenticated
using (
  public.current_user_is_admin()
  or public.current_user_has_permission('files.view')
  or public.current_user_has_permission('files.manage')
  or (
    client_visible
    and public.current_user_is_active_customer()
    and exists(
      select 1 from public.projects p
      where p.id=project_id and p.customer_id=auth.uid()
    )
  )
);

grant select on public.project_custom_folders to authenticated;

alter table public.client_files
  add column if not exists custom_folder_id uuid
  references public.project_custom_folders(id) on delete set null;

create index if not exists client_files_custom_folder_idx
  on public.client_files(custom_folder_id,created_at desc);
