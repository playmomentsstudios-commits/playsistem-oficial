-- Saga: prevent modified task summaries from conflicting with a previously
-- queued/sent idempotent slot. Existing flow, RKC and bridge remain unchanged.
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
 -- Only a configured daily slot may run, with a short retry window.
 if v_hour not in (7,13,19) or v_minute>=20 or
    not ((lpad(v_hour::text,2,'0')||':00')=any(cfg.digest_times)) then
   return jsonb_build_object('status','not_due');
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
 -- Once a slot has a durable event, never regenerate different content with
 -- the same key: task edits during the retry window must not cause a conflict.
 if exists(select 1 from public.automation_events where idempotency_key=v_key) then
   return jsonb_build_object('status','already_recorded','key',v_key);
 end if;
 v_summary:=public.saga_ops_summary_preview(p_at);
 if v_summary->>'status'<>'preview_only' then
   return jsonb_build_object('status','preview_failed');
 end if;
 v_out:=public.automation_enqueue_for_flow('saga_personal_ops',v_key,
    v_summary->>'title',v_summary->>'body');
 return v_out||jsonb_build_object('slot',v_hhmm,'flow','saga_personal_ops');
end $saga_tick$;
revoke all on function public.saga_ops_run_tick(timestamptz) from public,anon,authenticated;
grant execute on function public.saga_ops_run_tick(timestamptz) to service_role;
