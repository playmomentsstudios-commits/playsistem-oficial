-- Apply the configured CRM follow-up period automatically.
-- Requires migrations through 20260926260000_site_settings_cms.sql.

create or replace function public.save_customer_crm(
  p_customer_id uuid,
  p_stage text default null,
  p_owner_id uuid default null,
  p_source text default null,
  p_next_action text default null,
  p_next_action_at timestamptz default null,
  p_last_contact_at timestamptz default null,
  p_estimated_value bigint default null,
  p_internal_notes text default null,
  p_lost_reason text default null,
  p_stage_note text default null
)
returns public.customer_crm
language plpgsql
security definer
set search_path=public
as $$
declare
  current_row public.customer_crm%rowtype;
  result_row public.customer_crm%rowtype;
  next_stage text;
  resolved_next_action_at timestamptz;
  default_follow_up_days integer;
begin
  if not (
    public.current_user_is_admin()
    or public.current_user_has_permission('customers.manage')
  ) then
    raise exception 'Customer management permission required' using errcode='42501';
  end if;

  if not exists(select 1 from public.profiles where id=p_customer_id and role='customer') then
    raise exception 'Customer not found' using errcode='P0002';
  end if;

  insert into public.customer_crm(customer_id)
  values(p_customer_id)
  on conflict(customer_id) do nothing;

  select * into current_row
  from public.customer_crm
  where customer_id=p_customer_id
  for update;

  next_stage:=coalesce(p_stage,current_row.stage);
  if next_stage not in ('new_contact','in_service','quote','negotiation','won','production','delivered','lost') then
    raise exception 'Invalid CRM stage' using errcode='22023';
  end if;

  if p_owner_id is not null and not exists(
    select 1
    from public.profiles p
    left join public.staff_profiles sp on sp.user_id=p.id
    where p.id=p_owner_id and p.status='active'
      and (p.role='admin' or (p.role='staff' and coalesce(sp.active,false)))
  ) then
    raise exception 'Invalid CRM owner' using errcode='22023';
  end if;

  select coalesce(crm_default_follow_up_days,2)
  into default_follow_up_days
  from public.app_settings
  where id=true;
  default_follow_up_days:=coalesce(default_follow_up_days,2);

  if next_stage in ('delivered','lost') then
    resolved_next_action_at:=null;
  elsif p_next_action_at is not null then
    resolved_next_action_at:=p_next_action_at;
  elsif current_row.next_action_at is not null then
    resolved_next_action_at:=current_row.next_action_at;
  else
    resolved_next_action_at:=now() + make_interval(days=>default_follow_up_days);
  end if;

  update public.customer_crm
  set
    stage=next_stage,
    owner_id=p_owner_id,
    source=p_source,
    next_action=case when next_stage in ('delivered','lost') then null else p_next_action end,
    next_action_at=resolved_next_action_at,
    last_contact_at=coalesce(p_last_contact_at,last_contact_at),
    estimated_value=coalesce(p_estimated_value,estimated_value),
    internal_notes=p_internal_notes,
    lost_reason=case when next_stage='lost' then p_lost_reason else null end,
    updated_at=now(),
    updated_by=auth.uid()
  where customer_id=p_customer_id
  returning * into result_row;

  if current_row.stage is distinct from next_stage then
    insert into public.customer_crm_history(customer_id,from_stage,to_stage,changed_by,note)
    values(p_customer_id,current_row.stage,next_stage,auth.uid(),nullif(btrim(coalesce(p_stage_note,'')),''));
  end if;

  return result_row;
end;
$$;

revoke all on function public.save_customer_crm(uuid,text,uuid,text,text,timestamptz,timestamptz,bigint,text,text,text) from public;
grant execute on function public.save_customer_crm(uuid,text,uuid,text,text,timestamptz,timestamptz,bigint,text,text,text) to authenticated;
