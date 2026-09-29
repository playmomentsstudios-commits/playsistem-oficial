-- Internal project Drive structure follows project stages.
-- External/customer projects keep the existing six operational folders.

create table if not exists public.project_stage_drive_folders (
  stage_id uuid primary key references public.project_stages(id) on delete cascade,
  project_id uuid not null references public.projects(id) on delete cascade,
  drive_folder_id text not null unique,
  folder_name text not null,
  created_at timestamptz not null default now()
);

create index if not exists project_stage_drive_folders_project_idx
  on public.project_stage_drive_folders(project_id,stage_id);

alter table public.project_stage_drive_folders enable row level security;

drop policy if exists project_stage_drive_folders_read on public.project_stage_drive_folders;
create policy project_stage_drive_folders_read
on public.project_stage_drive_folders
for select
to authenticated
using (
  public.current_user_is_admin()
  or public.current_user_has_permission('projects.view')
  or public.current_user_has_permission('projects.manage')
  or exists(
    select 1
    from public.projects p
    where p.id=project_id
      and p.customer_id=auth.uid()
  )
);

drop policy if exists project_stage_drive_folders_manage on public.project_stage_drive_folders;
create policy project_stage_drive_folders_manage
on public.project_stage_drive_folders
for all
to authenticated
using (
  public.current_user_is_admin()
  or public.current_user_has_permission('files.manage')
)
with check (
  public.current_user_is_admin()
  or public.current_user_has_permission('files.manage')
);

grant select,insert,update,delete
on public.project_stage_drive_folders
to authenticated;

alter table public.client_files
  add column if not exists stage_id uuid references public.project_stages(id) on delete set null;

create index if not exists client_files_stage_idx
  on public.client_files(stage_id,created_at desc);

create or replace function public.validate_client_file_stage()
returns trigger
language plpgsql
set search_path=public
as $$
begin
  if new.stage_id is not null then
    if new.project_id is null then
      raise exception 'A stage file must belong to a project' using errcode='23514';
    end if;

    if not exists(
      select 1
      from public.project_stages s
      where s.id=new.stage_id
        and s.project_id=new.project_id
    ) then
      raise exception 'Stage does not belong to project' using errcode='23514';
    end if;
  end if;

  return new;
end;
$$;

drop trigger if exists client_files_validate_stage on public.client_files;
create trigger client_files_validate_stage
before insert or update of project_id,stage_id
on public.client_files
for each row execute function public.validate_client_file_stage();
