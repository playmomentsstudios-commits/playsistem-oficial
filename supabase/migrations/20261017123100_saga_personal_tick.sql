-- Saga personal delivery uses a separate "saga_personal" flow.
-- Calls the SAME proven transport as the RKC, without altering RKC or wa_bridge_claim.
-- Only server-side, never callable by authenticated browser sessions.
create or replace function public.saga_personal_tick(p_at timestamptz default now())
returns jsonb language plpgsql volatile security invoker set search_path='' as $$
declare
 s public.sagamente_assistant_settings%rowtype;
 c public.saga_digest_runtime_controls%rowtype;
 a public.app_settings%rowtype;
 b public.whatsapp_bridge_state%rowtype;
 f public.automation_flows%rowtype;
 briefing jsonb;
 queued jsonb;
 local_clock timestamp;
 hhmm text;
begin
 if p_at is null or not isfinite(p_at) or
  abs(extract(epoch from(now()-p_at)))>90 then
   return jsonb_build_object('status','invalid_clock');
 end if;
 select * into s from public.sagamente_assistant_settings where id=true;
 select * into c from public.saga_digest_runtime_controls where id=true;
 if s.enabled is distinct from true
  or s.whatsapp_notifications is distinct from true
  or c.dispatch_enabled is distinct from true then
   return jsonb_build_object('status','disabled');
 end if;
 if s.timezone is distinct from 'America/Sao_Paulo' then
  return jsonb_build_object('status','timezone_mismatch');
 end if;
 local_clock:=p_at at time zone s.timezone;
 if extract(hour from local_clock)::integer not in (7,13,19) then
  return jsonb_build_object('status','not_due');
 end if;
 hhmm:=to_char(local_clock,'HH24')||':00';
 if not hhmm=any(s.digest_times) then
  return jsonb_build_object('status','not_configured');
 end if;

 select * into f from public.automation_flows
 where event_key='saga_personal' for update;
 if not found or f.enabled is distinct from true or f.source<>'chatgpt' then
  return jsonb_build_object('status','flow_disabled');
 end if;
 -- The existing transport performs an additional pinned test identity check.
 if not public.wa_bridge_customer_eligible(f.recipient_user_id)
  or not exists(select 1 from public.profiles p join public.user_preferences u
   on u.user_id=p.id where p.id=f.recipient_user_id
   and p.role='customer' and p.status='active'
   and u.notify_project_updates is true and u.wa_automatic_opt_in is true
   and u.wa_opt_in_at is not null) then
   return jsonb_build_object('status','recipient_not_authorized');
 end if;

 select * into a from public.app_settings where id=true;
 select * into b from public.whatsapp_bridge_state where id=true;
 if a.wa_bridge_auto_enabled is distinct from true
  or a.wa_bridge_delivery_mode not in ('consented_clients','single_client')
  or a.wa_bridge_test_only is distinct from false
  or (a.wa_bridge_delivery_mode='single_client'
   and a.wa_bridge_single_customer_id is distinct from f.recipient_user_id)
  or a.wa_bridge_auto_started_at is null
  or a.wa_bridge_auto_started_at>now()
  or b.status is distinct from 'connected'
  or b.requested_mode is distinct from 'connect'
  or b.heartbeat_at is null
  or b.heartbeat_at<now()-interval '35 seconds'
  or b.connected_phone is distinct from a.wa_bridge_sender_phone then
   return jsonb_build_object('status','bridge_unavailable');
 end if;
 if a.wa_bridge_daily_limit is null or a.wa_bridge_daily_limit<1 or
  (select count(*) from public.whatsapp_bridge_attempts
   where (claimed_at at time zone 'America/Sao_Paulo')::date=
    (now() at time zone 'America/Sao_Paulo')::date)>=a.wa_bridge_daily_limit
 then return jsonb_build_object('status','daily_limit');
 end if;
 briefing:=public.saga_personal_brief_at(p_at);
 if briefing->>'status'<>'ready' then return briefing; end if;
 -- automation_enqueue_for_flow verifies recipient again, and uniquely guards key.
 queued:=public.automation_enqueue_for_flow(
 'saga_personal',briefing->>'key',briefing->>'title',briefing->>'body');
 return jsonb_build_object('status',queued->>'status',
  'duplicate',coalesce((queued->>'duplicate')::boolean,false),
  'event_id',queued->>'event_id','error_code',queued->>'error_code',
  'local_day',briefing->>'local_day','slot',briefing->>'slot');
end $$;
revoke all on function public.saga_personal_tick(timestamptz) from public,anon,authenticated;
grant execute on function public.saga_personal_tick(timestamptz) to service_role;
