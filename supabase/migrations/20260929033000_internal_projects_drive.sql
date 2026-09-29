-- Internal projects: separate operational scope from customer/financial projects.
-- Allows Play Moments internal work to use the same projects/tasks/files pipeline
-- without creating a fake customer or touching sales/payments.

alter table public.drive_settings
  add column if not exists internal_projects_folder_id text;

alter table public.client_files
  alter column customer_id drop not null;

create table if not exists public.project_members (
  project_id uuid not null references public.projects(id) on delete cascade,
  user_id uuid not null references public.profiles(id) on delete cascade,
  member_role text not null default 'contributor'
    check (member_role in ('lead','contributor','reviewer')),
  active boolean not null default true,
  added_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key(project_id,user_id)
);

create index if not exists project_members_user_idx
  on public.project_members(user_id,active,project_id);

alter table public.project_members enable row level security;

drop policy if exists project_members_read on public.project_members;
create policy project_members_read
on public.project_members for select to authenticated
using (
  user_id=auth.uid()
  or public.current_user_is_admin()
  or public.current_user_has_permission('projects.view')
  or public.current_user_has_permission('projects.manage')
);

drop policy if exists project_members_manage on public.project_members;
create policy project_members_manage
on public.project_members for all to authenticated
using (
  public.current_user_is_admin()
  or public.current_user_has_permission('projects.manage')
)
with check (
  public.current_user_is_admin()
  or public.current_user_has_permission('projects.manage')
);

grant select,insert,update,delete on public.project_members to authenticated;

create or replace function public.normalize_internal_project_scope()
returns trigger
language plpgsql
set search_path=public
as $$
begin
  if new.project_type='internal' then
    new.customer_id := null;
    new.order_id := null;
    new.quote_id := null;
  end if;
  return new;
end;
$$;

drop trigger if exists projects_normalize_internal_scope on public.projects;
create trigger projects_normalize_internal_scope
before insert or update of project_type,customer_id,order_id,quote_id
on public.projects
for each row execute function public.normalize_internal_project_scope();

create or replace function public.normalize_project_file_scope()
returns trigger
language plpgsql
set search_path=public
as $$
declare
  project_customer uuid;
  project_kind text;
begin
  if new.project_id is null then
    return new;
  end if;

  select customer_id,project_type
    into project_customer,project_kind
  from public.projects
  where id=new.project_id;

  if not found then
    raise exception 'Project not found' using errcode='P0002';
  end if;

  if project_kind='internal' then
    new.customer_id := null;
    new.client_visible := false;
  else
    new.customer_id := project_customer;
  end if;

  return new;
end;
$$;

drop trigger if exists client_files_normalize_project_scope on public.client_files;
create trigger client_files_normalize_project_scope
before insert or update of project_id,customer_id,client_visible
on public.client_files
for each row execute function public.normalize_project_file_scope();

create or replace function public.notify_client_file()
returns trigger
language plpgsql
security definer
set search_path=public
as $$
begin
  if new.client_visible and new.customer_id is not null then
    insert into public.notifications(user_id,type,title,message,link,metadata)
    values(
      new.customer_id,
      'file_received',
      'Novo arquivo disponível',
      'A Play Moments disponibilizou "'||new.name||'".',
      '/app/arquivos',
      jsonb_build_object('file_id',new.id)
    );
  end if;
  return new;
end;
$$;

drop trigger if exists client_files_notify on public.client_files;
create trigger client_files_notify
after insert on public.client_files
for each row execute function public.notify_client_file();

create or replace function public.project_member_from_task_assignment()
returns trigger
language plpgsql
security definer
set search_path=public
as $$
begin
  if new.assigned_to is not null then
    insert into public.project_members(
      project_id,user_id,member_role,active,added_by,updated_at
    )
    values(
      new.project_id,new.assigned_to,'contributor',true,auth.uid(),now()
    )
    on conflict(project_id,user_id) do update set
      active=true,
      updated_at=now();
  end if;
  return new;
end;
$$;

drop trigger if exists tasks_add_project_member on public.tasks;
create trigger tasks_add_project_member
after insert or update of assigned_to,project_id
on public.tasks
for each row execute function public.project_member_from_task_assignment();

-- Backfill current task assignees as project members.
insert into public.project_members(project_id,user_id,member_role,active,added_by)
select distinct t.project_id,t.assigned_to,'contributor',true,t.created_by
from public.tasks t
where t.assigned_to is not null
on conflict(project_id,user_id) do nothing;
