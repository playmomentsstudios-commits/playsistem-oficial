-- READ ONLY. Run against the target database before applying the draft SQL.
select now() as observed_at, version();
select id,wa_bridge_auto_enabled,wa_bridge_delivery_mode,wa_bridge_test_only,
 wa_bridge_test_phone,wa_bridge_sender_phone,wa_bridge_daily_limit,wa_bridge_auto_started_at
from public.app_settings where id=true;
select status,requested_mode,heartbeat_at,connected_phone,last_error
from public.whatsapp_bridge_state where id=true;
select p.id,p.role,p.status,p.phone,u.email
from public.profiles p join auth.users u on u.id=p.id
where lower(u.email)='eufedesigner@gmail.com';
select status,ack_status,destination_phone,provider_message_id,error_reason,claimed_at
from public.whatsapp_bridge_attempts order by claimed_at desc limit 10;
select pg_get_functiondef('public.wa_bridge_claim(uuid)'::regprocedure);
select pg_get_functiondef('app_private.wa_capture_notification(uuid,boolean)'::regprocedure);
select tgname,pg_get_triggerdef(oid) from pg_trigger
where tgrelid in ('public.notifications'::regclass,'public.whatsapp_message_outbox'::regclass)
and not tgisinternal;
