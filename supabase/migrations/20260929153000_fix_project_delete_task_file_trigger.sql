-- Fix project deletion when client_files still point to project tasks.
-- The validation trigger used to reject the FK ON DELETE SET NULL update because
-- the task may already be gone during the project cascade.
begin;

create or replace function public.validate_client_file_task()
returns trigger
language plpgsql
set search_path=public
as $$
declare task_project uuid;
begin
  -- A null task is always valid. This is especially important during
  -- project/task cascades where the FK intentionally performs ON DELETE SET NULL.
  if new.task_id is null then
    return new;
  end if;

  select project_id into task_project
  from public.tasks
  where id=new.task_id;

  if task_project is null then
    raise exception 'Task not found' using errcode='23503';
  end if;

  if new.project_id is null then
    new.project_id := task_project;
  elsif new.project_id <> task_project then
    raise exception 'Task does not belong to selected project' using errcode='23514';
  end if;

  return new;
end;
$$;

create or replace function public.admin_delete_project(p_project_id uuid)
returns void
language plpgsql
security definer
set search_path=public
as $$
begin
  if not public.current_user_is_admin() then
    raise exception 'Admin Master access required' using errcode='42501';
  end if;
  if not exists(select 1 from public.projects where id=p_project_id) then
    raise exception 'Project not found' using errcode='P0002';
  end if;

  -- Detach platform file metadata before tasks disappear. Physical Google Drive
  -- objects remain untouched by design.
  update public.client_files
  set task_id=null, project_id=null
  where project_id=p_project_id
     or task_id in (select id from public.tasks where project_id=p_project_id);

  delete from public.projects where id=p_project_id;
end;
$$;

revoke all on function public.admin_delete_project(uuid) from public;
grant execute on function public.admin_delete_project(uuid) to authenticated;

commit;
