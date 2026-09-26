-- CRM comercial, pipeline e visão operacional do cliente.

create table if not exists public.customer_crm (
  customer_id uuid primary key constraint customer_crm_customer_id_fkey references public.profiles(id) on delete cascade,
  stage text not null default 'new_contact'
    check (stage in ('new_contact','in_service','quote','negotiation','won','production','delivered','lost')),
  owner_id uuid constraint customer_crm_owner_id_fkey references public.profiles(id) on delete set null,
  source text,
  next_action text,
  next_action_at timestamptz,
  last_contact_at timestamptz,
  estimated_value bigint not null default 0 check (estimated_value >= 0),
  internal_notes text,
  lost_reason text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  updated_by uuid constraint customer_crm_updated_by_fkey references public.profiles(id) on delete set null
);

create table if not exists public.customer_crm_history (
  id uuid primary key default gen_random_uuid(),
  customer_id uuid not null constraint customer_crm_history_customer_id_fkey references public.profiles(id) on delete cascade,
  from_stage text,
  to_stage text not null,
  changed_by uuid constraint customer_crm_history_changed_by_fkey references public.profiles(id) on delete set null,
  note text,
  created_at timestamptz not null default now()
);

create index if not exists customer_crm_stage_idx on public.customer_crm(stage,updated_at desc);
create index if not exists customer_crm_owner_idx on public.customer_crm(owner_id,updated_at desc);
create index if not exists customer_crm_next_action_idx on public.customer_crm(next_action_at);
create index if not exists customer_crm_history_customer_idx on public.customer_crm_history(customer_id,created_at desc);

insert into public.customer_crm(customer_id,stage,created_at,updated_at)
select id,'new_contact',coalesce(created_at,now()),now()
from public.profiles
where role='customer'
on conflict(customer_id) do nothing;

create or replace function public.ensure_customer_crm_row()
returns trigger
language plpgsql
security definer
set search_path=public
as $$
begin
  if new.role='customer' then
    insert into public.customer_crm(customer_id,created_at,updated_at)
    values(new.id,coalesce(new.created_at,now()),now())
    on conflict(customer_id) do nothing;
  end if;
  return new;
end;
$$;

drop trigger if exists profiles_ensure_customer_crm on public.profiles;
create trigger profiles_ensure_customer_crm
after insert or update of role on public.profiles
for each row execute function public.ensure_customer_crm_row();

alter table public.customer_crm enable row level security;
alter table public.customer_crm_history enable row level security;

drop policy if exists customer_crm_read on public.customer_crm;
create policy customer_crm_read
on public.customer_crm for select to authenticated
using (
  public.current_user_is_admin()
  or public.current_user_has_permission('customers.view')
  or public.current_user_has_permission('customers.manage')
);

drop policy if exists customer_crm_write on public.customer_crm;
create policy customer_crm_write
on public.customer_crm for all to authenticated
using (
  public.current_user_is_admin()
  or public.current_user_has_permission('customers.manage')
)
with check (
  public.current_user_is_admin()
  or public.current_user_has_permission('customers.manage')
);

drop policy if exists customer_crm_history_read on public.customer_crm_history;
create policy customer_crm_history_read
on public.customer_crm_history for select to authenticated
using (
  public.current_user_is_admin()
  or public.current_user_has_permission('customers.view')
  or public.current_user_has_permission('customers.manage')
);

grant select on public.customer_crm,public.customer_crm_history to authenticated;
grant insert,update,delete on public.customer_crm to authenticated;

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

  update public.customer_crm
  set
    stage=next_stage,
    owner_id=p_owner_id,
    source=p_source,
    next_action=p_next_action,
    next_action_at=p_next_action_at,
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
