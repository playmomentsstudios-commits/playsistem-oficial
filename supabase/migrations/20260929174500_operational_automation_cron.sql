-- Schedule the operational automation engine with Supabase pg_cron.
-- Safe to apply repeatedly. Requires migration 20260929173000_operational_automation_engine.sql.
begin;

create extension if not exists pg_cron with schema extensions;

-- Cron cannot call the authenticated wrapper because there is no user JWT.
-- This private runner contains the same server-side work and is executable only by postgres/service_role.
create or replace function public.run_operational_automations_system()
returns jsonb
language plpgsql
security definer
set search_path=public
as $$
declare
  v_crm integer:=0;
  v_rentals integer:=0;
  v_holds integer:=0;
  v_run_key text:=to_char(current_date,'YYYY-MM-DD');
begin
  select public.release_expired_rental_holds() into v_holds;

  -- Staff rental alerts, without relying on auth.uid().
  with alerts as (
    select r.id rental_id,p.name product_name,
      case
        when r.status='checked_out' and r.end_date<current_date then 'Devolução atrasada'
        when r.status='checked_out' and r.end_date=current_date then 'Devolução hoje'
        when r.status='confirmed' and r.start_date=current_date then 'Retirada hoje'
        when r.status='confirmed' and r.start_date=current_date+1 then 'Retirada amanhã'
        when r.status='awaiting_payment' and r.start_date<=current_date+1 then 'Pagamento pendente antes da retirada'
      end title,
      case
        when r.status='checked_out' and r.end_date<current_date then p.name||' deveria ter sido devolvido em '||to_char(r.end_date,'DD/MM/YYYY')||'.'
        when r.status='checked_out' and r.end_date=current_date then p.name||' tem devolução prevista para hoje.'
        when r.status='confirmed' and r.start_date=current_date then p.name||' tem retirada prevista para hoje.'
        when r.status='confirmed' and r.start_date=current_date+1 then p.name||' tem retirada prevista para amanhã.'
        else p.name||' ainda aguarda pagamento e a retirada está próxima.'
      end message
    from public.product_rentals r join public.products p on p.id=r.product_id
    where (r.status='checked_out' and r.end_date<=current_date)
       or (r.status='confirmed' and r.start_date between current_date and current_date+1)
       or (r.status='awaiting_payment' and r.start_date<=current_date+1)
  ), recipients as (
    select id from public.profiles where status='active' and role in ('admin','staff')
  ), ins as (
    insert into public.notifications(user_id,type,title,message,link,metadata)
    select u.id,'rental_operational',a.title,a.message,'/admin/locacoes',
      jsonb_build_object('rental_id',a.rental_id)
    from alerts a cross join recipients u
    where a.title is not null and not exists(
      select 1 from public.notifications n
      where n.user_id=u.id and n.type='rental_operational'
        and n.metadata->>'rental_id'=a.rental_id::text
        and n.title=a.title and n.created_at::date=current_date
    )
    returning 1
  ) select count(*) into v_rentals from ins;

  with due as (
    select c.customer_id,c.owner_id,c.next_action,c.next_action_at,
      trim(concat_ws(' ',p.first_name,p.last_name)) customer_name
    from public.customer_crm c join public.profiles p on p.id=c.customer_id
    where c.stage not in ('delivered','lost') and c.next_action_at is not null and c.next_action_at<=now()
  ), recipients as (
    select d.*,coalesce(d.owner_id,a.id) recipient_id
    from due d left join lateral (
      select id from public.profiles where role='admin' and status='active'
      order by created_at asc limit 1
    ) a on d.owner_id is null
  ), ins as (
    insert into public.notifications(user_id,type,title,message,link,metadata)
    select recipient_id,'crm_follow_up','Follow-up CRM pendente',
      coalesce(nullif(customer_name,''),'Cliente')||': '||coalesce(nullif(next_action,''),'Realizar acompanhamento.'),
      '/admin/crm',jsonb_build_object('customer_id',customer_id,'next_action_at',next_action_at)
    from recipients r
    where recipient_id is not null and not exists(
      select 1 from public.notifications n where n.user_id=r.recipient_id
        and n.type='crm_follow_up' and n.metadata->>'customer_id'=r.customer_id::text
        and n.created_at::date=current_date
    )
    returning 1
  ) select count(*) into v_crm from ins;

  insert into public.automation_runs(job_key,run_key,processed_count,metadata)
  values('operational_daily_system',v_run_key,v_crm+v_rentals+v_holds,
    jsonb_build_object('crm_followups',v_crm,'rental_alerts',v_rentals,'expired_holds',v_holds))
  on conflict(job_key,run_key) do update set processed_count=excluded.processed_count,
    metadata=excluded.metadata,created_at=now();

  return jsonb_build_object('ok',true,'crm_followups',v_crm,'rental_alerts',v_rentals,'expired_holds',v_holds);
end;
$$;
revoke all on function public.run_operational_automations_system() from public;
grant execute on function public.run_operational_automations_system() to service_role;

do $$
declare v_job bigint;
begin
  select jobid into v_job from cron.job where jobname='play-moments-operational-daily';
  if v_job is not null then perform cron.unschedule(v_job); end if;
  perform cron.schedule(
    'play-moments-operational-daily',
    '15 9 * * *',
    'select public.run_operational_automations_system();'
  );
end $$;

commit;
