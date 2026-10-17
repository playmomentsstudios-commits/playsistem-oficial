-- Extend the existing bridge claim WITHOUT changing its legacy branches.
-- Inject a single source-scoped Saga clause and a mode gate; fail closed on drift.
do $saga_patch$
declare
 body text;
 anchor text:=E'\n  )\n order by o.created_at,o.id limit 1 for update of o skip locked;';
 phone_anchor text:=E'\n  and o.destination_phone ~ ''^55[0-9]{10,11}$''';
 additional text;
begin
 select pg_get_functiondef('public.wa_bridge_claim(uuid)'::regprocedure) into body;
 if position('o.event_type=''saga_operational_digest''' in body)>0 then
  raise exception 'Saga claim was already patched; inspect before reapplying';
 end if;
 if length(body)<3000
 or (length(body)-length(replace(body,anchor,'')))<>length(anchor)
 or (length(body)-length(replace(body,phone_anchor,'')))<>length(phone_anchor)
 or position('public.automation_events' in body)=0
 or position('public.whatsapp_bridge_attempts' in body)=0 then
  raise exception 'Unexpected production bridge claim definition: fail closed';
 end if;
 body:=replace(body,phone_anchor,phone_anchor||E'\n  and (o.event_type<>''saga_operational_digest'' or cfg.wa_bridge_delivery_mode=''consented_clients'')');
 additional:=$saga_branch$
    or (
       o.event_type='saga_operational_digest'
       and n.type='saga_operational_digest'
       and n.user_id=o.recipient_user_id
       and n.metadata->>'source'='saga_operational'
       and n.metadata->>'saga_run_id' is not null
       and cfg.wa_bridge_delivery_mode='consented_clients'
       and public.wa_bridge_customer_eligible(o.recipient_user_id)
       and o.destination_phone=(select pref.wa_opt_in_phone
          from public.user_preferences pref where pref.user_id=o.recipient_user_id)
       and exists (
         select 1 from public.saga_digest_runs r
         join public.saga_operational_recipients allowlist
           on allowlist.recipient_user_id=r.recipient_user_id
           and allowlist.enabled
         join public.saga_digest_runtime_controls controls on controls.id=true
         join public.sagamente_assistant_settings settings on settings.id=true
         join public.profiles profile on profile.id=r.recipient_user_id
         join public.user_preferences prefs on prefs.user_id=profile.id
         where r.id::text=n.metadata->>'saga_run_id'
           and r.outbox_id=o.id and r.notification_id=n.id
           and r.recipient_user_id=o.recipient_user_id
           and r.state='queued' and r.content->>'kind'='saga_operational_digest'
           and r.created_at>now()-interval '2 hours'
           and settings.enabled and settings.whatsapp_notifications
           and controls.prepare_enabled and controls.dispatch_enabled
           and lower(profile.email)='eufedesigner@gmail.com'
           and profile.role='customer' and profile.status='active'
           and prefs.wa_automatic_opt_in
           and prefs.notify_project_updates
           and prefs.wa_opt_in_at is not null
           and prefs.wa_opt_in_phone=o.destination_phone
       )
    )
$saga_branch$;
 body:=replace(body,anchor,E'\n'||additional||anchor);
 execute body;
end $saga_patch$;
