-- V1 automation engine: idempotent operational sweeps callable by cron or an authenticated admin/staff session.
begin;

create table if not exists public.automation_runs (
  id uuid primary key default gen_random_uuid(),
  job_key text not null,
  run_key text not null,
  status text not null default 'completed' check(status in ('completed','failed')),
  processed_count integer not null default 0,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  unique(job_key,run_key)
);
alter table public.automation_runs enable row level security;
drop policy if exists automation_runs_staff_read on public.automation_runs;
create policy automation_runs_staff_read on public.automation_runs for select to authenticated
using(public.current_user_is_staff_or_admin());
grant select on public.automation_runs to authenticated;

create or replace function public.run_operational_automations()
returns jsonb
language plpgsql
security definer
set search_path=public
as $$
declare
  v_role text;
  v_crm integer:=0;
  v_rentals integer:=0;
  v_holds integer:=0;
  v_run_key text:=to_char(current_date,'YYYY-MM-DD');
begin
  select role into v_role from public.profiles where id=auth.uid() and status='active';
  if v_role not in ('admin','staff') then
    raise exception 'Staff access required' using errcode='42501';
  end if;

  -- Expire abandoned rental payment holds first so inventory is released.
  select public.release_expired_rental_holds() into v_holds;

  -- Existing rental notification routine is already daily-idempotent.
  select public.sync_rental_operational_notifications() into v_rentals;

  -- Turn overdue CRM next actions into owner/admin notifications once per day.
  with due as (
    select c.customer_id,c.owner_id,c.next_action,c.next_action_at,
           trim(concat_ws(' ',p.first_name,p.last_name)) customer_name
    from public.customer_crm c
    join public.profiles p on p.id=c.customer_id
    where c.stage not in ('delivered','lost')
      and c.next_action_at is not null
      and c.next_action_at<=now()
  ), recipients as (
    select d.*,coalesce(d.owner_id,a.id) recipient_id
    from due d
    left join lateral (
      select id from public.profiles
      where role='admin' and status='active'
      order by created_at asc limit 1
    ) a on d.owner_id is null
  ), ins as (
    insert into public.notifications(user_id,type,title,message,link,metadata)
    select recipient_id,'crm_follow_up','Follow-up CRM pendente',
      coalesce(nullif(customer_name,''),'Cliente')||': '||coalesce(nullif(next_action,''),'Realizar acompanhamento.'),
      '/admin/crm',
      jsonb_build_object('customer_id',customer_id,'next_action_at',next_action_at)
    from recipients r
    where recipient_id is not null
      and not exists(
        select 1 from public.notifications n
        where n.user_id=r.recipient_id
          and n.type='crm_follow_up'
          and n.metadata->>'customer_id'=r.customer_id::text
          and n.created_at::date=current_date
      )
    returning 1
  )
  select count(*) into v_crm from ins;

  insert into public.automation_runs(job_key,run_key,processed_count,metadata)
  values('operational_daily',v_run_key,v_crm+v_rentals+v_holds,
    jsonb_build_object('crm_followups',v_crm,'rental_alerts',v_rentals,'expired_holds',v_holds))
  on conflict(job_key,run_key) do update
  set processed_count=excluded.processed_count,metadata=excluded.metadata,created_at=now();

  return jsonb_build_object('ok',true,'crm_followups',v_crm,'rental_alerts',v_rentals,'expired_holds',v_holds);
end;
$$;
revoke all on function public.run_operational_automations() from public;
grant execute on function public.run_operational_automations() to authenticated;

commit;
