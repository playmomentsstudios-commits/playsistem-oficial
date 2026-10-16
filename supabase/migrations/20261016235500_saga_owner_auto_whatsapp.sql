-- Saga: owner-only operational digests using the existing, tested WhatsApp bridge.
-- No changes to RKC flow, wa_bridge_claim, WhatsApp delivery budgets or recipient opt-in.
-- source='chatgpt' is the legacy generic automation ADAPTER requirement, not the
-- visible agent identity; event_key and idempotency keys are strictly Saga-specific.
insert into public.automation_flows(name,source,event_key,recipient_user_id,enabled)
select 'Saga — Resumos operacionais', 'chatgpt', 'saga_personal_ops', p.id, false
from public.profiles p
where lower(p.email)='eufedesigner@gmail.com'
  and p.role='customer' and p.status='active'
  and public.wa_bridge_customer_eligible(p.id)
on conflict(event_key) do nothing;

-- Pure preview: the owner's internal task statistics, not customer-facing stage updates.
create or replace function public.saga_ops_summary_preview(p_at timestamptz default now())
returns jsonb language plpgsql stable security invoker set search_path='' as $saga_preview$
declare
  v_day date;
  v_hour int;
  v_pending int;
  v_in_progress int;
  v_review int;
  v_due_today int;
  v_overdue int;
  v_completed_today int;
  v_priority_list text;
  v_heading text;
  v_intro text;
  v_body text;
begin
  if p_at is null or not isfinite(p_at) then
    return jsonb_build_object('status','invalid_time');
  end if;
  v_day:=(p_at at time zone 'America/Sao_Paulo')::date;
  v_hour:=extract(hour from p_at at time zone 'America/Sao_Paulo')::int;
  v_heading:=case when v_hour<13 then 'Planejamento'
       when v_hour<19 then 'Acompanhamento' else 'Fechamento' end;
  v_intro:=case when v_hour<13 then 'Bom dia! Organizei suas prioridades no Play Sistem.'
       when v_hour<19 then 'Atualizei o andamento das tarefas no Play Sistem.'
       else 'Preparei o fechamento das atividades e as prioridades seguintes.' end;
  select
    count(*) filter(where status='pending'),
    count(*) filter(where status='in_progress'),
    count(*) filter(where status='review'),
    count(*) filter(where due_date=v_day and status not in ('completed','cancelled')),
    count(*) filter(where due_date<v_day and status not in ('completed','cancelled')),
    count(*) filter(where status='completed' and
       (updated_at at time zone 'America/Sao_Paulo')::date=v_day)
  into v_pending,v_in_progress,v_review,v_due_today,v_overdue,v_completed_today
  from public.tasks;
  select coalesce(string_agg(
      '• '||left(regexp_replace(x.title,'[\r\n]+',' ','g'),105)||
      ' ['||case x.status when 'in_progress' then 'em andamento'
        when 'review' then 'em revisão' else 'pendente' end||']'||
      case when x.due_date is not null then
        ' · prazo '||to_char(x.due_date,'DD/MM') else '' end,
      E'\n' order by x.n), 'Nenhuma tarefa pendente identificada.')
    into v_priority_list
  from (
    select title,status,due_date,
      row_number() over(order by
        (due_date<v_day) desc nulls last,
        (due_date=v_day) desc nulls last,
        case priority when 'urgent' then 0 when 'high' then 1
          when 'medium' then 2 else 3 end,
        due_date asc nulls last,created_at asc,id asc) as n
    from public.tasks where status not in ('completed','cancelled')
    order by (due_date<v_day) desc nulls last,
        (due_date=v_day) desc nulls last,
        case priority when 'urgent' then 0 when 'high' then 1
          when 'medium' then 2 else 3 end,
        due_date asc nulls last,created_at asc,id asc limit 4
  ) x;
  v_body:='*Saga | '||v_heading||' — '||to_char(v_day,'DD/MM/YYYY')||'*'||
    E'\n\n'||v_intro||E'\n\n'||
    format('Pendentes: %s | Em andamento: %s | Revisão: %s',
      v_pending,v_in_progress,v_review)||E'\n'||
    format('Prazos para hoje: %s | Atrasadas: %s | Concluídas hoje: %s',
      v_due_today,v_overdue,v_completed_today)||
    E'\n\n*Próximas prioridades*\n'||v_priority_list||
    E'\n\nAcompanhe e atualize as tarefas pelo Play Sistem.';
  return jsonb_build_object('status','preview_only',
    'title','Saga | '||v_heading,
    'body',left(v_body,3900),
    'local_day',v_day::text,
    'pending',v_pending,'in_progress',v_in_progress,
    'review',v_review,'due_today',v_due_today,'overdue',v_overdue,
    'completed_today',v_completed_today);
end $saga_preview$;
revoke all on function public.saga_ops_summary_preview(timestamptz)
 from public,anon,authenticated;
grant execute on function public.saga_ops_summary_preview(timestamptz) to service_role;

-- Automatic schedule: retries preflight every minute for the first 20 minutes
-- of each authorized 07/13/19 slot. Exactly one enqueue/day/slot by idempotency.
-- Existing generic adapter verifies identity, live consent, WhatsApp mode,
-- connected bridge, sender, daily cap, 1-min pacing and duplicate attempts.
create or replace function public.saga_ops_run_tick(p_at timestamptz default now())
returns jsonb language plpgsql volatile security invoker set search_path='' as $saga_tick$
declare
 cfg public.sagamente_assistant_settings%rowtype;
 f public.automation_flows%rowtype;
 b public.whatsapp_bridge_state%rowtype;
 v_local timestamp;
 v_hhmm text;
 v_hour int;
 v_minute int;
 v_summary jsonb;
 v_out jsonb;
 v_key text;
begin
 if p_at is null or not isfinite(p_at) or
    abs(extract(epoch from (clock_timestamp()-p_at)))>90 then
   return jsonb_build_object('status','invalid_clock');
 end if;
 select * into cfg from public.sagamente_assistant_settings where id=true;
 if not found or cfg.enabled is distinct from true or
    cfg.whatsapp_notifications is distinct from true or
    cfg.timezone<>'America/Sao_Paulo' then
   return jsonb_build_object('status','disabled');
 end if;
 v_local:=p_at at time zone cfg.timezone;
 v_hhmm:=to_char(v_local,'HH24:MI');
 v_hour:=extract(hour from v_local)::int;
 v_minute:=extract(minute from v_local)::int;
 if v_hour not in (7,13,19) or v_minute>=20 or
    (lpad(v_hour::text,2,'0')||':00')<>all(cfg.digest_times) then
   -- The clock config is authoritative; never infer additional hours.
   if v_hour not in (7,13,19) or v_minute>=20 or
       not ((lpad(v_hour::text,2,'0')||':00')=any(cfg.digest_times)) then
     return jsonb_build_object('status','not_due');
   end if;
 end if;
 select * into f from public.automation_flows where event_key='saga_personal_ops';
 if not found or f.enabled is distinct from true or f.source<>'chatgpt'
   or not exists(
    select 1 from public.profiles p
    where p.id=f.recipient_user_id
    and lower(p.email)='eufedesigner@gmail.com' and p.status='active'
      and p.role='customer'
      and public.wa_bridge_customer_eligible(p.id)
      and exists(select 1 from public.user_preferences pref
        where pref.user_id=p.id and pref.notify_project_updates is true)
   ) then
   return jsonb_build_object('status','recipient_not_authorized');
 end if;
 select * into b from public.whatsapp_bridge_state where id=true;
 if not found or b.status<>'connected' or b.requested_mode<>'connect'
    or b.heartbeat_at is null or b.heartbeat_at<now()-interval '35 seconds' then
   return jsonb_build_object('status','bridge_offline');
 end if;
 v_key:='sagaops_'||to_char(v_local,'YYYYMMDD_HH24');
 v_summary:=public.saga_ops_summary_preview(p_at);
 if v_summary->>'status'<>'preview_only' then
   return jsonb_build_object('status','preview_failed');
 end if;
 v_out:=public.automation_enqueue_for_flow('saga_personal_ops',v_key,
    v_summary->>'title',v_summary->>'body');
 return v_out||jsonb_build_object('slot',v_hhmm,'flow','saga_personal_ops');
end $saga_tick$;
revoke all on function public.saga_ops_run_tick(timestamptz)
 from public,anon,authenticated;
grant execute on function public.saga_ops_run_tick(timestamptz) to service_role;

-- Single explicit production test entry point for the already-consenting owner.
-- Unlike the scheduler, this is an immediate, once-per-day diagnostic.
create or replace function public.saga_ops_test_send()
returns jsonb language plpgsql volatile security invoker set search_path='' as $saga_test$
declare v_data jsonb;
begin
 v_data:=public.saga_ops_summary_preview(now());
 return public.automation_enqueue_for_flow('saga_personal_ops',
   'sagaops_test_'||to_char(now() at time zone 'America/Sao_Paulo','YYYYMMDD'),
   'Saga | Teste do resumo automático',
   '[TESTE DA SAGA — cadastro autorizado]'||E'\n\n'||
   coalesce(v_data->>'body','Não consegui consultar as tarefas.'));
end $saga_test$;
revoke all on function public.saga_ops_test_send() from public,anon,authenticated;
grant execute on function public.saga_ops_test_send() to service_role;

-- Registered in disabled state; activate ONLY after CI and live end-to-end test.
do $saga_cron$
declare v_id bigint;
begin
 select jobid into v_id from cron.job where jobname='saga-owner-ops-minute';
 if v_id is null then
  v_id:=cron.schedule('saga-owner-ops-minute','* * * * *',
    'select public.saga_ops_run_tick();');
 end if;
 perform cron.alter_job(job_id=>v_id,active=>false);
 if not exists(select 1 from cron.job where jobid=v_id
   and active=false and command='select public.saga_ops_run_tick();') then
  raise exception 'Saga owner cron must remain inactive before approval';
 end if;
end $saga_cron$;
