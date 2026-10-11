-- Close the NULL comparison bypass in this SECURITY DEFINER role-management RPC.
create or replace function public.admin_set_member_role(
  p_user_id uuid,
  p_role text
)
returns void
language plpgsql
security definer
set search_path=public
as $$
declare
  caller_role text;
begin
  if auth.uid() is null then
    raise exception 'Administrator access required' using errcode='42501';
  end if;

  select role into caller_role
  from public.profiles
  where id=auth.uid() and status='active';

  if caller_role is distinct from 'admin' then
    raise exception 'Administrator access required' using errcode='42501';
  end if;

  if p_role not in ('customer','staff','admin') then
    raise exception 'Invalid role' using errcode='22023';
  end if;

  if p_user_id=auth.uid() and p_role<>'admin' then
    raise exception 'You cannot remove your own administrator role' using errcode='22023';
  end if;

  update public.profiles set role=p_role where id=p_user_id;
  if not found then raise exception 'User not found' using errcode='P0002'; end if;

  if p_role='customer' then
    update public.staff_profiles set active=false,updated_by=auth.uid(),updated_at=now()
    where user_id=p_user_id;
  elsif p_role='staff' then
    insert into public.staff_profiles(user_id,job_title,department,permissions,active,updated_by)
    values(p_user_id,'Colaborador','custom','{}'::text[],true,auth.uid())
    on conflict(user_id) do update set active=true,updated_by=auth.uid(),updated_at=now();
  end if;
end;
$$;

revoke all on function public.admin_set_member_role(uuid, text) from public, anon;
grant execute on function public.admin_set_member_role(uuid, text) to authenticated, service_role;
