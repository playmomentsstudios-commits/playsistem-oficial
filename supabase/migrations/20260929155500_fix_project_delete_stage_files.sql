-- Follow-up for project deletion: stage-scoped files must be detached atomically.
begin;

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

  -- Detach every relational pointer before tasks/stages disappear.
  -- Physical Google Drive objects are intentionally preserved.
  update public.client_files
  set task_id=null, stage_id=null, project_id=null
  where project_id=p_project_id
     or task_id in (select id from public.tasks where project_id=p_project_id)
     or stage_id in (select id from public.project_stages where project_id=p_project_id);

  delete from public.projects where id=p_project_id;
end;
$$;

revoke all on function public.admin_delete_project(uuid) from public;
grant execute on function public.admin_delete_project(uuid) to authenticated;

commit;
