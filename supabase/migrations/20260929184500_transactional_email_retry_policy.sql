-- Retry policy and priority controls for the provider-neutral transactional outbox.
begin;

alter table public.transactional_email_outbox
  add column if not exists priority text not null default 'normal'
    check(priority in ('critical','normal','informational')),
  add column if not exists max_attempts integer not null default 4 check(max_attempts between 1 and 10);

update public.transactional_email_outbox
set priority=case
  when event_key='payment_confirmed' then 'critical'
  when event_key='academy_enrollment' then 'normal'
  when event_key='project_completed' then 'normal'
  else 'informational' end;

create or replace function public.claim_transactional_email_batch(p_limit integer default 25)
returns setof public.transactional_email_outbox
language plpgsql security definer set search_path=public as $$
begin
  return query
  with picked as (
    select id from public.transactional_email_outbox
    where status in ('pending','failed')
      and attempts < max_attempts
      and next_attempt_at<=now()
    order by case priority when 'critical' then 0 when 'normal' then 1 else 2 end,created_at
    for update skip locked limit greatest(1,least(coalesce(p_limit,25),100))
  ), claimed as (
    update public.transactional_email_outbox o
    set status='processing',attempts=o.attempts+1,updated_at=now()
    from picked where o.id=picked.id returning o.*
  )
  select * from claimed;
end $$;
revoke all on function public.claim_transactional_email_batch(integer) from public;
grant execute on function public.claim_transactional_email_batch(integer) to service_role;

create or replace function public.finish_transactional_email(
 p_id uuid,p_sent boolean,p_provider text default null,p_provider_message_id text default null,p_error text default null
) returns void language plpgsql security definer set search_path=public as $$
declare v_attempts integer; v_max integer;
begin
 select attempts,max_attempts into v_attempts,v_max from public.transactional_email_outbox where id=p_id for update;
 if not found then raise exception 'Outbox item not found'; end if;
 if p_sent then
   update public.transactional_email_outbox set status='sent',provider=p_provider,provider_message_id=p_provider_message_id,
     last_error=null,sent_at=now(),updated_at=now() where id=p_id;
 else
   update public.transactional_email_outbox set status=case when v_attempts>=v_max then 'cancelled' else 'failed' end,
     provider=coalesce(p_provider,provider),last_error=left(coalesce(p_error,'Delivery failed'),2000),
     next_attempt_at=now()+case greatest(v_attempts,1) when 1 then interval '5 minutes' when 2 then interval '30 minutes' else interval '2 hours' end,
     updated_at=now() where id=p_id;
 end if;
end $$;
revoke all on function public.finish_transactional_email(uuid,boolean,text,text,text) from public;
grant execute on function public.finish_transactional_email(uuid,boolean,text,text,text) to service_role;

commit;
