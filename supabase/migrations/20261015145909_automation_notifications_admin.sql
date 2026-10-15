create or replace function public.automation_enqueue_for_flow(
 p_flow_key text, p_key text, p_title text, p_body text
) returns jsonb language plpgsql security invoker set search_path='' as $$
declare f public.automation_flows%rowtype; e public.automation_events%rowtype;
 cfg public.app_settings%rowtype; b public.whatsapp_bridge_state%rowtype;
 v_notice uuid; v_outbox uuid; v_error text;
begin
 if p_key is null or p_key !~ '^[A-Za-z0-9:_-]{8,120}$'
 or p_title is null or length(btrim(p_title)) not between 1 and 120
 or p_body is null or length(btrim(p_body)) not between 1 and 4000 then
  raise exception 'Invalid automation payload' using errcode='22023';
 end if;
 -- Serialize idempotency and per-flow budget, including concurrent HTTP requests.
 select * into f from public.automation_flows where event_key=p_flow_key for update;
 if not found then raise exception 'Recipient identity not verified' using errcode='22023'; end if;
 select * into e from public.automation_events where idempotency_key=p_key;
 if found then
  if e.flow_id<>f.id or e.title<>p_title or e.message_body<>p_body then
   raise exception 'Idempotency conflict' using errcode='22023';
  end if;
  return jsonb_build_object('event_id',e.id,'status',e.status,'outbox_id',e.outbox_id,
   'error_code',e.error_code,'duplicate',true);
 end if;
 if not f.enabled or f.source<>'chatgpt' then v_error:='flow_paused'; end if;
 if not exists(select 1 from public.profiles p
  where p.id=f.recipient_user_id and lower(p.email)='eufedesigner@gmail.com'
  and p.role='customer' and p.status='active'
  and regexp_replace(coalesce(p.phone,''),'[^0-9]','','g') in ('62993241277','5562993241277'))
 then v_error:='recipient_mismatch'; end if;
 select * into cfg from public.app_settings where id=true for update;
 select * into b from public.whatsapp_bridge_state where id=true;
 if cfg.wa_bridge_auto_enabled is distinct from true
 or cfg.wa_bridge_delivery_mode not in ('self_test','single_client','consented_clients')
 or cfg.wa_bridge_delivery_mode is null
 or cfg.wa_bridge_test_only is distinct from (cfg.wa_bridge_delivery_mode='self_test')
 or (cfg.wa_bridge_delivery_mode='self_test' and cfg.wa_bridge_test_phone is distinct from '5562993241277')
 or (cfg.wa_bridge_delivery_mode='single_client' and cfg.wa_bridge_single_customer_id is distinct from f.recipient_user_id)
 or not public.wa_bridge_customer_eligible(f.recipient_user_id)
 or not exists(select 1 from public.user_preferences pref where pref.user_id=f.recipient_user_id and pref.wa_opt_in_phone='5562993241277')
 or cfg.wa_bridge_auto_started_at is null or cfg.wa_bridge_auto_started_at>now()
 or b.status is distinct from 'connected' or b.requested_mode is distinct from 'connect'
 or b.heartbeat_at is null or b.heartbeat_at<now()-interval '35 seconds'
 or b.connected_phone is distinct from cfg.wa_bridge_sender_phone
 then v_error:=coalesce(v_error,'bridge_preflight_failed'); end if;
 if cfg.wa_bridge_daily_limit is null or cfg.wa_bridge_daily_limit<1 or
 (select count(*) from public.whatsapp_bridge_attempts
  where (claimed_at at time zone 'America/Sao_Paulo')::date=
   (now() at time zone 'America/Sao_Paulo')::date)>=cfg.wa_bridge_daily_limit
 then v_error:=coalesce(v_error,'bridge_daily_limit'); end if;
 if exists(select 1 from public.automation_events where flow_id=f.id
  and status='queued' and created_at>now()-interval '2 minutes') or
 (select count(*) from public.automation_events where flow_id=f.id
  and outbox_id is not null and created_at>now()-interval '24 hours')>=10
 then v_error:=coalesce(v_error,'automation_rate_limit'); end if;
 insert into public.automation_events(flow_id,idempotency_key,event_type,title,message_body,status,error_code)
 values(f.id,p_key,'automation_check_in',p_title,p_body,
  case when v_error is null then 'approved' else 'failed' end,v_error) returning * into e;
 if v_error is not null then
  return jsonb_build_object('event_id',e.id,'status','failed','error_code',v_error);
 end if;
 insert into public.notifications(user_id,type,title,message,link,metadata)
 values(f.recipient_user_id,'automation_check_in',p_title,p_body,'/admin/whatsapp',
  jsonb_build_object('automation_event_id',e.id,'source','chatgpt')) returning id into v_notice;
 -- Existing capture trigger ignores this type. Explicit insert uses the same
 -- outbox, claims, budgets, Node bridge, finish and receipt RPCs as current sends.
 insert into public.whatsapp_message_outbox(notification_id,recipient_user_id,recipient_name,
 destination_phone,event_type,title,message_body,target_link,status,source)
 values(v_notice,f.recipient_user_id,'Felipe Costa','5562993241277',
 'automation_check_in',p_title,p_body,'/admin/whatsapp','ready_manual','live') returning id into v_outbox;
 update public.automation_events set status='queued',approved_at=now(),
  notification_id=v_notice,outbox_id=v_outbox where id=e.id;
 return jsonb_build_object('event_id',e.id,'status','queued','outbox_id',v_outbox,'duplicate',false);
end $$;
revoke all on function public.automation_enqueue_for_flow(text,text,text,text) from public,anon,authenticated;
grant execute on function public.automation_enqueue_for_flow(text,text,text,text) to service_role;


alter table public.automation_flows
 add column if not exists title_template text not null default 'Check-in RKC',
 add column if not exists message_template text not null default '';
create policy automation_flows_admin_read on public.automation_flows for select to authenticated using(public.current_user_is_admin());
create policy automation_events_admin_read on public.automation_events for select to authenticated using(public.current_user_is_admin());
grant select on public.automation_flows,public.automation_events,public.automation_delivery_status to authenticated;

create or replace function public.automation_admin_save(
 p_id uuid,p_name text,p_title text,p_template text,p_enabled boolean
) returns uuid language plpgsql security definer set search_path='' as $$
declare v_id uuid; v_recipient uuid;
begin
 if auth.uid() is null or not public.current_user_is_admin() then raise exception 'Somente administradores' using errcode='42501'; end if;
 if p_name is null or length(btrim(p_name)) not between 1 and 100
 or p_title is null or length(btrim(p_title)) not between 1 and 120
 or p_template is null or length(p_template)>4000 or p_enabled is null
 then raise exception 'Dados inválidos' using errcode='22023'; end if;
 select id into v_recipient from public.profiles where lower(email)='eufedesigner@gmail.com' and role='customer' and status='active';
 if v_recipient is null then raise exception 'Destinatário indisponível' using errcode='22023'; end if;
 if p_id is null then
  insert into public.automation_flows(name,event_key,source,recipient_user_id,enabled,title_template,message_template)
  values(btrim(p_name),'flow_'||replace(gen_random_uuid()::text,'-',''),'chatgpt',v_recipient,p_enabled,btrim(p_title),p_template) returning id into v_id;
 else
  update public.automation_flows set name=btrim(p_name),title_template=btrim(p_title),message_template=p_template,enabled=p_enabled,updated_at=now()
  where id=p_id and recipient_user_id=v_recipient returning id into v_id;
 end if;
 if v_id is null then raise exception 'Automação indisponível' using errcode='22023'; end if;
 return v_id;
end $$;
revoke all on function public.automation_admin_save(uuid,text,text,text,boolean) from public,anon;
grant execute on function public.automation_admin_save(uuid,text,text,text,boolean) to authenticated;

create or replace function public.automation_admin_send(p_flow_id uuid,p_message text,p_test boolean,p_request_key text)
returns jsonb language plpgsql security definer set search_path='' as $$
declare f public.automation_flows%rowtype;
begin
 if auth.uid() is null or not public.current_user_is_admin() then raise exception 'Somente administradores' using errcode='42501'; end if;
 if p_test is null then raise exception 'Ação inválida' using errcode='22023'; end if;
 select * into f from public.automation_flows where id=p_flow_id;
 if not found then raise exception 'Automação indisponível' using errcode='22023'; end if;
 if p_test then
  return public.automation_enqueue('play-sistem:first-whatsapp-test:v1','TESTE — PLAY SISTEM',
   E'TESTE — PLAY SISTEM\n\nEsta é uma notificação de teste do módulo de Automações e Notificações.\n\nIntegração Play Sistem + ChatGPT.\n\nSe você recebeu esta mensagem, o fluxo de envio está funcionando.');
 end if;
 return public.automation_enqueue_for_flow(f.event_key,p_request_key,f.title_template,p_message);
end $$;
revoke all on function public.automation_admin_send(uuid,text,boolean,text) from public,anon;
grant execute on function public.automation_admin_send(uuid,text,boolean,text) to authenticated;

create or replace view public.automation_delivery_status with (security_invoker=true) as
select e.id as event_id,e.idempotency_key,e.created_at,e.error_code,e.outbox_id,
 a.id as bridge_attempt_id,a.provider_message_id,a.error_reason,a.ack_status,
 case when a.ack_status in ('delivered','read') then 'delivered'
  when a.status='failed' then 'failed'
  when a.status='sent' then 'sent_unconfirmed'
  when a.status='claimed' then 'sending'
  else e.status end as delivery_status,e.flow_id,e.title,e.message_body
from public.automation_events e
left join public.whatsapp_bridge_attempts a on a.outbox_id=e.outbox_id;
revoke all on public.automation_delivery_status from public,anon,authenticated;
grant select on public.automation_delivery_status to service_role;


grant select on public.automation_delivery_status to authenticated;

-- Preserve installed production claim: 250/day configuration, 1-minute pacing,
-- project rules, welcome lane and all opt-in/mode checks. Add only linked RKC events.
CREATE OR REPLACE FUNCTION public.wa_bridge_claim(p_instance uuid)
 RETURNS jsonb
 LANGUAGE plpgsql
 SET search_path TO ''
AS $function$
declare cfg public.app_settings%rowtype; bridge public.whatsapp_bridge_state%rowtype;
 v_row public.whatsapp_message_outbox%rowtype;
 v_target text; v_attempt uuid; v_body text; v_used bigint;
begin
 select * into cfg from public.app_settings where id=true for update;
 select * into bridge from public.whatsapp_bridge_state where id=true;
 if not cfg.wa_bridge_auto_enabled or cfg.wa_bridge_daily_limit=0
  or bridge.instance_id is distinct from p_instance or bridge.status<>'connected'
  or bridge.requested_mode<>'connect' or bridge.heartbeat_at<now()-interval '35 seconds'
  or bridge.connected_phone is distinct from cfg.wa_bridge_sender_phone
  or cfg.wa_bridge_auto_started_at is null then return null; end if;
 if cfg.wa_bridge_delivery_mode not in ('self_test','single_client','consented_clients')
 or cfg.wa_bridge_test_only is distinct from (cfg.wa_bridge_delivery_mode='self_test')
 then return null; end if;
 if cfg.wa_bridge_delivery_mode='single_client'
 and (cfg.wa_bridge_single_customer_id is null
 or not public.wa_bridge_customer_eligible(cfg.wa_bridge_single_customer_id)) then return null; end if;
 select count(*) into v_used from public.whatsapp_bridge_attempts
 where (claimed_at at time zone 'America/Sao_Paulo')::date =
  (now() at time zone 'America/Sao_Paulo')::date;
 if v_used>=cfg.wa_bridge_daily_limit then return null; end if;
 -- Anti-burst limits, applied to both tests and real recipients.
 if exists(select 1 from public.whatsapp_bridge_attempts
    where claimed_at>now()-interval '1 minute') then return null; end if;
 if (select count(*) from public.whatsapp_bridge_attempts
    where claimed_at>now()-interval '1 hour')>=10 then return null; end if;
 select o.* into v_row from public.whatsapp_message_outbox o
 join public.notifications n on n.id=o.notification_id
 where o.status='ready_manual' and o.source='live'
  and o.created_at>=cfg.wa_bridge_auto_started_at
  and o.destination_phone ~ '^55[0-9]{10,11}$'
  and (
    cfg.wa_bridge_delivery_mode='self_test'
    or (
      o.event_type in ('project_status','project_updated','project_task','project_stage',
                       'file_available','file_review_requested')
      and n.metadata->>'project_id' is not null
      and public.wa_bridge_customer_eligible(o.recipient_user_id)
      and o.destination_phone=(select pref.wa_opt_in_phone from public.user_preferences pref
        where pref.user_id=o.recipient_user_id)
      and (cfg.wa_bridge_delivery_mode='consented_clients'
        or o.recipient_user_id=cfg.wa_bridge_single_customer_id)
      and exists (
        select 1 from public.projects p where p.id=(n.metadata->>'project_id')::uuid
          and p.project_type<>'internal' and
            (p.customer_id=o.recipient_user_id or exists (
             select 1 from public.project_customer_access a
             where a.project_id=p.id and a.customer_id=o.recipient_user_id
            ))
      )
    )
    or (
      o.event_type='account_welcome'
      and n.type='account_welcome'
      and n.user_id=o.recipient_user_id
      and public.wa_bridge_customer_eligible(o.recipient_user_id)
      and o.destination_phone=(
        select pref.wa_opt_in_phone from public.user_preferences pref
        where pref.user_id=o.recipient_user_id
      )
      and (cfg.wa_bridge_delivery_mode='consented_clients'
        or o.recipient_user_id=cfg.wa_bridge_single_customer_id)
      and exists (select 1 from public.customer_onboarding_events e where e.user_id=o.recipient_user_id)
    )
    or (
      o.event_type='automation_check_in' and n.type='automation_check_in'
      and n.user_id=o.recipient_user_id
      and public.wa_bridge_customer_eligible(o.recipient_user_id)
      and o.destination_phone='5562993241277'
      and o.destination_phone=(select pref.wa_opt_in_phone from public.user_preferences pref where pref.user_id=o.recipient_user_id)
      and (cfg.wa_bridge_delivery_mode='consented_clients' or o.recipient_user_id=cfg.wa_bridge_single_customer_id)
      and exists(select 1 from public.automation_events e
        join public.automation_flows f on f.id=e.flow_id
        join public.profiles p on p.id=f.recipient_user_id
        where e.outbox_id=o.id and e.notification_id=n.id and e.status='queued'
        and f.enabled and f.source='chatgpt'
        and f.recipient_user_id=o.recipient_user_id
        and lower(p.email)='eufedesigner@gmail.com' and p.role='customer' and p.status='active')
    )
  )
 order by o.created_at,o.id limit 1 for update of o skip locked;
 if not found then return null; end if;
 v_target:=case when cfg.wa_bridge_delivery_mode='self_test' then cfg.wa_bridge_test_phone else v_row.destination_phone end;
 v_body:=case when cfg.wa_bridge_delivery_mode='self_test'
   then '[TESTE SAGAMENTE - envio para o número de teste; destinatário original: '||
    v_row.recipient_name||' / '||v_row.destination_phone||']'||E'\n\n'
   else '' end||v_row.message_body;
 update public.whatsapp_message_outbox set status='sending_auto' where id=v_row.id;
 insert into public.whatsapp_bridge_attempts(outbox_id,instance_id,destination_phone,test_mode)
 values(v_row.id,p_instance,v_target,cfg.wa_bridge_delivery_mode='self_test') returning id into v_attempt;
 return jsonb_build_object('attempt_id',v_attempt,'outbox_id',v_row.id,
  'phone',v_target,'message',v_body,'test_only',cfg.wa_bridge_delivery_mode='self_test');
end $function$;

revoke all on function public.wa_bridge_claim(uuid) from public,anon,authenticated;
grant execute on function public.wa_bridge_claim(uuid) to service_role;
