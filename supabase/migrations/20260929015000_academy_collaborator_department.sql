-- Align collaborator persistence with the Academy department introduced by the V1 RBAC UI.
-- Preserves all existing collaborators and permissions.
begin;

alter table public.staff_profiles
  drop constraint if exists staff_profiles_department_check;

alter table public.staff_profiles
  add constraint staff_profiles_department_check
  check (department in (
    'commercial','design','video','audio','web','support','finance','operations','academy','custom'
  ));

create or replace function public.admin_save_collaborator(
  p_user_id uuid,
  p_job_title text,
  p_department text,
  p_permissions text[],
  p_active boolean default true
)
returns void
language plpgsql
security definer
set search_path=public
as $$
begin
  if not public.current_user_is_admin() then
    raise exception 'Administrator access required' using errcode='42501';
  end if;

  if p_department not in (
    'commercial','design','video','audio','web','support','finance','operations','academy','custom'
  ) then
    raise exception 'Invalid department' using errcode='22023';
  end if;

  update public.profiles
  set role='staff'
  where id=p_user_id and role<>'admin';

  if not found and not exists(select 1 from public.profiles where id=p_user_id and role='admin') then
    raise exception 'User not found' using errcode='P0002';
  end if;

  insert into public.staff_profiles(user_id,job_title,department,permissions,active,updated_by,updated_at)
  values(
    p_user_id,
    coalesce(nullif(btrim(p_job_title),''),'Colaborador'),
    p_department,
    coalesce(p_permissions,'{}'::text[]),
    p_active,
    auth.uid(),
    now()
  )
  on conflict(user_id) do update set
    job_title=excluded.job_title,
    department=excluded.department,
    permissions=excluded.permissions,
    active=excluded.active,
    updated_by=excluded.updated_by,
    updated_at=now();
end;
$$;

revoke all on function public.admin_save_collaborator(uuid,text,text,text[],boolean) from public;
grant execute on function public.admin_save_collaborator(uuid,text,text,text[],boolean) to authenticated;

commit;
