-- Saga owner/ops: retry a failed preflight safely, without a duplicate send.
-- Keep exactly one active Saga ops cron; RKC and existing bridge claim unchanged.
create or replace function public.saga_ops_retry_tick()
returns jsonb language plpgsql volatile security invoker set search_path='' as $$
declare
 cfg public.sagamente_assistant_settings%rowtype;
 app public.app_settings%rowtype;
 bridge public.whatsapp_bridge_state%rowtype;
 flow_row public.automation_flows%rowtype;
 v_local timestamp;
 v_hhmm text;
 v_key text;
 v_count int;
 v_attempt int;
 v_has_outbox boolean;
 v_result jsonb;
 v_summary jsonb;
begin
 v_local:=now() at time zone 'America/Sao_Paulo';
 v_hhmm:=to_char(v_local,'HH24:MI');
 if extract(hour from v_local)::int not in (7,13,19)
  or extract(minute from v_local)::int>=20 then
  return jsonb_build_object('status','not_due');
 end if;
 select * into cfg from public.sagamente_assistant_settings where id=true;
 if cfg.enabled is distinct from true or cfg.whatsapp_notifications is distinct from true
  or cfg.timezone<>'America/Sao_Paulo'
  or not ((to_char(v_local,'HH24')||':00')=any(cfg.digest_times)) then
  return jsonb_build_object('status','disabled');
 end if;
 -- Prevent failed idempotency rows when the shared bridge is globally paused.
 select * into app from public.app_settings where id=true;
 select * into bridge from public.whatsapp_bridge_state where id=true;
 if app.wa_bridge_auto_enabled is distinct from true
  or app.wa_bridge_delivery_mode not in ('consented_clients','single_client')
  or app.wa_bridge_test_only is distinct from false
  or app.wa_bridge_auto_started_at is null
  or app.wa_bridge_auto_started_at>now()
  or bridge.status is distinct from 'connected'
  or bridge.requested_mode is distinct from 'connect'
  or bridge.heartbeat_at is null
  or bridge.heartbeat_at<now()-interval '35 seconds'
  or bridge.connected_phone is distinct from app.wa_bridge_sender_phone then
  return jsonb_build_object('status','bridge_paused');
 end if;
 select * into flow_row from public.automation_flows
 where event_key='saga_personal_ops' for update;
 if not found or flow_row.enabled is distinct from true then
  return jsonb_build_object('status','flow_disabled');
 end if;
 if app.wa_bridge_delivery_mode='single_client'
   and app.wa_bridge_single_customer_id is distinct from flow_row.recipient_user_id then
  return jsonb_build_object('status','recipient_outside_mode');
 end if;
 v_key:='sagaops_'||to_char(v_local,'YYYYMMDD_HH24');
 select count(*)::int,coalesce(bool_or(outbox_id is not null),false)
 into v_count,v_has_outbox
 from public.automation_events
 where idempotency_key=v_key
    or (idempotency_key like v_key||'_r%' and
        idempotency_key ~ ('^'||v_key||'_r[1-3]$'));
 if v_has_outbox then
  return jsonb_build_object('status','already_queued','key',v_key);
 end if;
 if v_count=0 then
  return public.saga_ops_run_tick();
 end if;
 if v_count>=4 then
  return jsonb_build_object('status','retry_exhausted','key',v_key);
 end if;
 -- Recompute the facts after a temporary preflight failure; do not reuse
 -- stale content or retry messages that ever received an outbox ID.
 v_attempt:=v_count;
 v_summary:=public.saga_ops_summary_preview(now());
 if v_summary->>'status'<>'preview_only' then
  return jsonb_build_object('status','preview_unavailable');
 end if;
 v_result:=public.automation_enqueue_for_flow(
  'saga_personal_ops',v_key||'_r'||v_attempt::text,
  v_summary->>'title',v_summary->>'body');
 return v_result||jsonb_build_object('retry',v_attempt,'slot',v_hhmm);
end $$;
revoke all on function public.saga_ops_retry_tick() from public,anon,authenticated;
grant execute on function public.saga_ops_retry_tick() to service_role;

-- Route the existing ONE Saga cron through the guarded retry entry point.
-- Do not create another minute job, and do not change its active state.
do $$
declare j record;
begin
 select jobid,active into j from cron.job
 where jobname='saga-owner-ops-minute';
 if not found then raise exception 'Saga ops cron missing'; end if;
 perform cron.alter_job(
   job_id=>j.jobid,
   command=>'select public.saga_ops_retry_tick();');
 if not exists(select 1 from cron.job
    where jobid=j.jobid and active=j.active
    and command='select public.saga_ops_retry_tick();') then
  raise exception 'Saga ops cron postcondition failed';
 end if;
end $$;
