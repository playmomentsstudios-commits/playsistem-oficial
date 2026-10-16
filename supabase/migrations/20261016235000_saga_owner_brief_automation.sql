-- Independent Saga owner brief; reuses legacy generic outbox and Baileys.
-- Stage OFF; never changes the RKC flow or customer/project notifications.
create table if not exists public.saga_owner_brief_settings(
 id boolean primary key default true check(id),
 enabled boolean not null default false,
 recipient_user_id uuid references public.profiles(id),
 start_local_day date not null default ((now() at time zone 'America/Sao_Paulo')::date + 1),
 updated_at timestamptz not null default now()
);
alter table public.saga_owner_brief_settings enable row level security;
revoke all on public.saga_owner_brief_settings from public,anon,authenticated;
grant select,update on public.saga_owner_brief_settings to service_role;

-- E-mail identifies preauthorized TEST RECIPIENT ONLY, not tasks visibility.
insert into public.saga_owner_brief_settings(id,recipient_user_id)
select true,p.id from public.profiles p join auth.users u on u.id=p.id
where lower(u.email)='eufedesigner@gmail.com' and p.role='customer'
and p.status='active' and public.wa_bridge_customer_eligible(p.id)
on conflict(id) do nothing;

insert into public.automation_flows(
 name,source,event_key,enabled,recipient_user_id,title_template,message_template
)
select 'Saga — Resumo operacional','chatgpt','saga_owner_brief',false,
 s.recipient_user_id,'Saga | Resumo das tarefas',''
from public.saga_owner_brief_settings s
where s.id=true and s.recipient_user_id is not null
on conflict(event_key) do nothing;

-- Read-only snapshot; never enqueues. 07:00,13:00,19:00 Brasília.
-- The task summary is internal operational data, not the customer's projects.
create or replace function public.saga_owner_brief_preview(p_at timestamptz default now())
returns jsonb language plpgsql stable security invoker set search_path='' as $$
declare
 v_day date;
 v_local timestamp;
 v_slot text;
 v_title text;
 v_message text;
 v_top text;
 v_pending bigint;
 v_progress bigint;
 v_completed_today bigint;
 v_overdue bigint;
 v_due_today bigint;
 v_total_completed bigint;
begin
 if p_at is null or not isfinite(p_at) then
  return jsonb_build_object('status','invalid_time');
 end if;
 v_local:=p_at at time zone 'America/Sao_Paulo';
 v_day:=v_local::date;
 if extract(hour from v_local)=7 then v_slot:='07';
 elsif extract(hour from v_local)=13 then v_slot:='13';
 elsif extract(hour from v_local)=19 then v_slot:='19';
 else return jsonb_build_object('status','not_due'); end if;
 select count(*) filter(where status='pending'),
 count(*) filter(where status='in_progress'),
 count(*) filter(where status='completed' and
  (completed_at at time zone 'America/Sao_Paulo')::date=v_day),
 count(*) filter(where due_date<v_day and status not in ('completed','cancelled')),
 count(*) filter(where due_date=v_day and status not in ('completed','cancelled')),
 count(*) filter(where status='completed')
 into v_pending,v_progress,v_completed_today,v_overdue,v_due_today,v_total_completed
 from public.tasks;
 select string_agg('• '||left(t.title,105)||
  case when t.due_date is not null
   then ' (prazo '||to_char(t.due_date,'DD/MM')||')' else '' end,
  E'\n' order by t.due_date nulls last,t.created_at,t.id)
 into v_top from (
   select id,title,due_date,created_at from public.tasks
   where status not in ('completed','cancelled')
   order by (case when status='in_progress' then 0 else 1 end),
            due_date nulls last,created_at,id limit 5
 ) t;
 v_title:='Saga | '||case v_slot when '07' then 'Prioridades do dia'
     when '13' then 'Andamento do dia' else 'Fechamento do dia' end;
 v_message:=case v_slot when '07' then 'Bom dia! Preparei suas prioridades.'
    when '13' then 'Boa tarde! Conferi o andamento das tarefas.'
    else 'Boa noite! Preparei o fechamento do dia.' end
  ||E'\n\n'||format(
   'Pendentes: %s | Em andamento: %s'||E'\n'||
   'Concluídas hoje: %s | Total concluído: %s'||E'\n'||
   'Prazo hoje: %s | Atrasadas: %s',
    v_pending,v_progress,v_completed_today,v_total_completed,v_due_today,v_overdue)
  ||E'\n\nPróximas tarefas:\n'||
  coalesce(v_top,'Não encontrei tarefas pendentes.')
  ||E'\n\nConsulte o Play Sistem para atualizar o andamento.';
 return jsonb_build_object('status','preview_only','slot',v_slot,
  'local_day',v_day::text,'title',v_title,
  'message',left(v_message,3900));
end $$;
revoke all on function public.saga_owner_brief_preview(timestamptz)
 from public,anon,authenticated;
grant execute on function public.saga_owner_brief_preview(timestamptz) to service_role;

-- Non-interactive, backend-only tick. Uses verified consent & existing generic
-- enqueue_for_flow, not the RKC flow. No approval required per scheduled send.
create or replace function public.saga_owner_brief_tick()
returns jsonb language plpgsql volatile security invoker set search_path='' as $$
declare
 v_cfg public.saga_owner_brief_settings%rowtype;
 v_flow public.automation_flows%rowtype;
 v_assistant public.sagamente_assistant_settings%rowtype;
 v_app public.app_settings%rowtype;
 v_bridge public.whatsapp_bridge_state%rowtype;
 v_day date;
 v_local timestamp;
 v_slot text;
 v_key text;
 v_preview jsonb;
 v_result jsonb;
 v_usage integer;
begin
 select * into v_cfg from public.saga_owner_brief_settings where id=true for update;
 if not found or v_cfg.enabled is distinct from true or v_cfg.recipient_user_id is null
 then return jsonb_build_object('status','disabled'); end if;
 v_local:=now() at time zone 'America/Sao_Paulo';
 v_day:=v_local::date;
 if v_day<v_cfg.start_local_day then return jsonb_build_object('status','not_started'); end if;
 if extract(hour from v_local)=7 then v_slot:='07';
 elsif extract(hour from v_local)=13 then v_slot:='13';
 elsif extract(hour from v_local)=19 then v_slot:='19';
 else return jsonb_build_object('status','outside_window'); end if;
 select * into v_assistant from public.sagamente_assistant_settings where id=true;
 if not found or v_assistant.timezone<>'America/Sao_Paulo'
 or not v_slot||':00'=any(v_assistant.digest_times)
 then return jsonb_build_object('status','slot_not_configured'); end if;
 select * into v_flow from public.automation_flows where event_key='saga_owner_brief';
 if not found or v_flow.enabled is distinct from true
 or v_flow.recipient_user_id is distinct from v_cfg.recipient_user_id
 or v_flow.source<>'chatgpt' then return jsonb_build_object('status','flow_paused'); end if;
 -- Hard cap: ONLY the previously verified personal test recipient, until a
 -- separately reviewed administrator flow replaces this mapping.
 if not exists(
  select 1 from public.profiles p join auth.users u on u.id=p.id
  join public.user_preferences pref on pref.user_id=p.id
  where p.id=v_cfg.recipient_user_id and lower(u.email)='eufedesigner@gmail.com'
  and p.role='customer' and p.status='active'
  and pref.notify_project_updates is true
  and public.wa_bridge_customer_eligible(p.id)
 ) then return jsonb_build_object('status','recipient_not_authorized'); end if;
 v_key:='saga:owner:'||v_day::text||':'||v_slot;
 if exists(select 1 from public.automation_events where idempotency_key=v_key)
 then return jsonb_build_object('status','already_recorded','key',v_key); end if;

 select * into v_app from public.app_settings where id=true;
 select * into v_bridge from public.whatsapp_bridge_state where id=true;
 if v_app.wa_bridge_auto_enabled is distinct from true
  or v_app.wa_bridge_delivery_mode not in ('consented_clients','single_client')
  or (v_app.wa_bridge_delivery_mode='single_client'
     and v_app.wa_bridge_single_customer_id is distinct from v_cfg.recipient_user_id)
  or v_app.wa_bridge_auto_started_at is null
  or v_app.wa_bridge_daily_limit is null or v_app.wa_bridge_daily_limit<1
  or v_bridge.status is distinct from 'connected'
  or v_bridge.requested_mode is distinct from 'connect'
  or v_bridge.heartbeat_at is null or v_bridge.heartbeat_at<now()-interval '35 seconds'
  or v_bridge.connected_phone is distinct from v_app.wa_bridge_sender_phone
 then return jsonb_build_object('status','bridge_unavailable'); end if;
 select count(*) into v_usage from public.whatsapp_bridge_attempts
 where (claimed_at at time zone 'America/Sao_Paulo')::date=v_day;
 if v_usage>=v_app.wa_bridge_daily_limit
 then return jsonb_build_object('status','bridge_daily_limit'); end if;
 -- Generic automation_enqueue_for_flow is the authority for final rate
 -- checks and queue idempotency. Avoid calling while its rate cap is active.
 if exists(select 1 from public.automation_events
  where flow_id=v_flow.id and status='queued'
  and created_at>now()-interval '2 minutes')
 or (select count(*) from public.automation_events
   where flow_id=v_flow.id and outbox_id is not null
   and created_at>now()-interval '24 hours')>=10
 then return jsonb_build_object('status','rate_limited'); end if;
 v_preview:=public.saga_owner_brief_preview(now());
 if v_preview->>'status'<>'preview_only'
 then return jsonb_build_object('status','preview_unavailable'); end if;
 v_result:=public.automation_enqueue_for_flow(
 'saga_owner_brief',v_key,v_preview->>'title',v_preview->>'message');
 return v_result;
end $$;
revoke all on function public.saga_owner_brief_tick() from public,anon,authenticated;
grant execute on function public.saga_owner_brief_tick() to service_role;

-- Job exists but is initially INACTIVE, even after registration.
do $$
declare v_job bigint;
begin
 select jobid into v_job from cron.job
 where jobname='saga-owner-brief-minute';
 if v_job is null then
  v_job:=cron.schedule('saga-owner-brief-minute','* * * * *',
    'select public.saga_owner_brief_tick();');
 end if;
 perform cron.alter_job(job_id=>v_job,active=>false);
 if not exists(select 1 from cron.job where jobid=v_job and active=false
   and command='select public.saga_owner_brief_tick();')
 then raise exception 'Saga owner cron must remain inactive'; end if;
end $$;
