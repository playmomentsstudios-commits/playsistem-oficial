
-- Keep projects.customer_id as the sole contractual/approval customer.
-- Extra customers are viewers only and never replace the primary owner.
create table if not exists public.project_customer_access (
  project_id uuid not null references public.projects(id) on delete cascade,
  customer_id uuid not null references public.profiles(id) on delete cascade,
  added_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  primary key(project_id,customer_id)
);
create index if not exists idx_project_customer_access_customer on public.project_customer_access(customer_id,project_id);
alter table public.project_customer_access enable row level security;
grant select,insert,delete on public.project_customer_access to authenticated;
revoke all on public.project_customer_access from anon;

drop policy if exists project_customer_access_read on public.project_customer_access;
create policy project_customer_access_read on public.project_customer_access for select to authenticated
using (
  (customer_id = (select auth.uid()) and (select public.current_user_is_active_customer()))
  or (select public.current_user_is_admin())
  or (select public.current_user_has_permission('projects.view'))
  or (select public.current_user_has_permission('projects.manage'))
);
drop policy if exists project_customer_access_insert on public.project_customer_access;
create policy project_customer_access_insert on public.project_customer_access for insert to authenticated
with check ((select public.current_user_is_admin()) or (select public.current_user_has_permission('projects.manage')));
drop policy if exists project_customer_access_delete on public.project_customer_access;
create policy project_customer_access_delete on public.project_customer_access for delete to authenticated
using ((select public.current_user_is_admin()) or (select public.current_user_has_permission('projects.manage')));

create or replace function app_private.validate_project_customer_access()
returns trigger language plpgsql security definer set search_path = ''
as $body$
declare owner_customer uuid; kind text;
begin
  select p.customer_id,p.project_type into owner_customer,kind
    from public.projects p where p.id=new.project_id;
  if not found or kind='internal' then
    raise exception 'Somente projetos não internos podem receber clientes adicionais' using errcode='23514';
  end if;
  if new.customer_id = owner_customer then
    raise exception 'Este cliente já é o responsável principal pelo projeto' using errcode='23505';
  end if;
  if not exists (select 1 from public.profiles x
                 where x.id=new.customer_id and x.role='customer' and x.status='active') then
    raise exception 'Selecione uma conta de cliente ativa' using errcode='23514';
  end if;
  return new;
end;
$body$;
revoke all on function app_private.validate_project_customer_access() from public,anon,authenticated;
drop trigger if exists project_customer_access_validate on public.project_customer_access;
create trigger project_customer_access_validate before insert or update of customer_id,project_id
on public.project_customer_access for each row execute function app_private.validate_project_customer_access();

create or replace function app_private.cleanup_extra_customer_access()
returns trigger language plpgsql security definer set search_path = ''
as $body$
begin
  if new.project_type='internal' then
    delete from public.project_customer_access where project_id=new.id;
  elseif new.customer_id is not null then
    delete from public.project_customer_access where project_id=new.id and customer_id=new.customer_id;
  end if;
  return new;
end;
$body$;
revoke all on function app_private.cleanup_extra_customer_access() from public,anon,authenticated;
drop trigger if exists projects_cleanup_extra_customer_access on public.projects;
create trigger projects_cleanup_extra_customer_access
after update of customer_id,project_type on public.projects
for each row execute function app_private.cleanup_extra_customer_access();

-- Project summary: authenticated active primary customer or extra viewer, with staff overrides.
drop policy if exists projects_read on public.projects;
create policy projects_read on public.projects for select to authenticated
using (
 (project_type <> 'internal' and (select public.current_user_is_active_customer()) and
  (customer_id = (select auth.uid()) or exists (
    select 1 from public.project_customer_access a
    where a.project_id=projects.id and a.customer_id=(select auth.uid())
  )))
 or (select public.current_user_is_admin())
 or (select public.current_user_has_permission('projects.view'))
 or (select public.current_user_has_permission('projects.manage'))
);

drop policy if exists project_stages_read on public.project_stages;
create policy project_stages_read on public.project_stages for select to authenticated
using (
  (select public.current_user_is_admin())
  or (select public.current_user_has_permission('projects.view'))
  or (select public.current_user_has_permission('projects.manage'))
  or (client_visible and (select public.current_user_is_active_customer())
      and exists (select 1 from public.projects p
        where p.id=project_stages.project_id and p.project_type<>'internal'
          and (p.customer_id=(select auth.uid()) or exists (
            select 1 from public.project_customer_access a where a.project_id=p.id and a.customer_id=(select auth.uid())
          ))))
);

drop policy if exists tasks_read on public.tasks;
create policy tasks_read on public.tasks for select to authenticated
using (
  (select public.current_user_is_admin())
  or (select public.current_user_has_permission('projects.view'))
  or (select public.current_user_has_permission('projects.manage'))
  or (client_visible and (select public.current_user_is_active_customer())
      and exists (select 1 from public.projects p
        where p.id=tasks.project_id and p.project_type<>'internal'
          and (p.customer_id=(select auth.uid()) or exists (
            select 1 from public.project_customer_access a where a.project_id=p.id and a.customer_id=(select auth.uid())
          ))))
);

drop policy if exists checklist_read on public.task_checklist_items;
create policy checklist_read on public.task_checklist_items for select to authenticated
using (
  (select public.current_user_is_staff_or_admin())
  or ((select public.current_user_is_active_customer()) and exists(
    select 1 from public.tasks t join public.projects p on p.id=t.project_id
    where t.id=task_checklist_items.task_id and t.client_visible and p.project_type<>'internal'
      and (p.customer_id=(select auth.uid()) or exists (
        select 1 from public.project_customer_access a where a.project_id=p.id and a.customer_id=(select auth.uid())
      ))))
);

drop policy if exists task_links_read on public.task_links;
create policy task_links_read on public.task_links for select to authenticated
using (
  (select public.current_user_is_staff_or_admin())
  or ((select public.current_user_is_active_customer()) and client_visible and exists(
    select 1 from public.tasks t join public.projects p on p.id=t.project_id
    where t.id=task_links.task_id and t.client_visible and p.project_type<>'internal'
      and (p.customer_id=(select auth.uid()) or exists (
        select 1 from public.project_customer_access a where a.project_id=p.id and a.customer_id=(select auth.uid())
      ))))
);

-- Existing customer_id continues to reference the primary owner (billing and approvals).
-- Additional viewers can read only explicitly published project files.
drop policy if exists client_files_read on public.client_files;
create policy client_files_read on public.client_files for select to authenticated
using (
  (select public.current_user_is_admin())
  or (select public.current_user_has_permission('files.view'))
  or (select public.current_user_has_permission('files.manage'))
  or (client_visible and (select public.current_user_is_active_customer()) and (
     customer_id=(select auth.uid())
     or (project_id is not null and exists (
       select 1 from public.projects p join public.project_customer_access a on a.project_id=p.id
       where p.id=client_files.project_id and p.project_type<>'internal' and a.customer_id=(select auth.uid())
     ))
  ))
);

drop policy if exists project_custom_folders_read on public.project_custom_folders;
create policy project_custom_folders_read on public.project_custom_folders for select to authenticated
using (
  (select public.current_user_is_admin())
  or (select public.current_user_has_permission('files.view'))
  or (select public.current_user_has_permission('files.manage'))
  or (client_visible and (select public.current_user_is_active_customer()) and exists(
    select 1 from public.projects p where p.id=project_custom_folders.project_id and p.project_type<>'internal'
      and (p.customer_id=(select auth.uid()) or exists(
        select 1 from public.project_customer_access a where a.project_id=p.id and a.customer_id=(select auth.uid())
      ))
  ))
);
