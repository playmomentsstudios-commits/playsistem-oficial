-- Central WhatsApp: two clearly separate budgets, editable from 0..100.
-- Independent inbox/Push priority events are not outbound WhatsApp attempts.
alter table public.app_settings drop constraint if exists wa_bridge_limit_check;
alter table public.app_settings add constraint wa_bridge_limit_check
 check (wa_bridge_daily_limit between 0 and 100);
alter table public.app_settings drop constraint if exists priority_alert_daily_limit_valid;
alter table public.app_settings add constraint priority_alert_daily_limit_valid
 check (priority_daily_limit between 0 and 100);
alter table public.app_settings alter column wa_bridge_daily_limit set default 30;
alter table public.app_settings alter column priority_daily_limit set default 30;

-- Upgrade untouched initial limit to a conservative starter threshold; leave any
-- independently configured higher/lower values alone. Keep external sends paused.
update public.app_settings
 set wa_bridge_daily_limit=case when wa_bridge_daily_limit=10 then 30 else wa_bridge_daily_limit end,
     priority_daily_limit=case when priority_daily_limit=10 then 30 else priority_daily_limit end,
     wa_bridge_auto_enabled=false
 where id=true;

-- Serialize claims on app_settings and throttle sustained bursts in the
-- DATABASE so an old or restarted Node worker cannot bypass pacing.
-- One attempt every 2 minutes, max 10/hour, max configured 0..100/day,
-- each counted by claimed_at in the business timezone.
create or replace function public.wa_bridge_claim(p_instance uuid)
returns jsonb language plpgsql security invoker set search_path='' as $$
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
    where claimed_at>now()-interval '2 minutes') then return null; end if;
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
end $$;
revoke all on function public.wa_bridge_claim(uuid) from public,anon,authenticated;
grant execute on function public.wa_bridge_claim(uuid) to service_role;
