-- WhatsApp QR: append a safe clickable URL for dynamic project stages.
-- Preserve consent, test routing and cap as-is.
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
 select count(*) into v_used from public.whatsapp_bridge_attempts
 where (claimed_at at time zone 'America/Sao_Paulo')::date =
  (now() at time zone 'America/Sao_Paulo')::date;
 if v_used>=cfg.wa_bridge_daily_limit then return null; end if;
 select o.* into v_row from public.whatsapp_message_outbox o
 left join public.user_preferences pref on pref.user_id=o.recipient_user_id
 where o.status='ready_manual' and o.source='live'
  and o.created_at>=cfg.wa_bridge_auto_started_at
  and o.destination_phone is not null
  and (cfg.wa_bridge_test_only or coalesce(pref.wa_automatic_opt_in,false))
 order by o.created_at,o.id limit 1 for update of o skip locked;
 if not found then return null; end if;
 v_target:=case when cfg.wa_bridge_test_only then cfg.wa_bridge_test_phone else v_row.destination_phone end;
 v_body:=case when cfg.wa_bridge_test_only
   then '[TESTE SAGAMENTE - envio para o número de teste; destinatário original: '||
    v_row.recipient_name||' / '||v_row.destination_phone||']'||E'\n\n'
   else '' end||v_row.message_body;
 -- Only valid internal project-stage links are expanded to the canonical
 -- HTTPS app origin. The outgoing URL never comes from a user-provided host.
 if v_row.event_type in ('project_task','project_stage')
   and v_row.target_link ~ '^/app/projetos/[0-9a-fA-F-]{36}(/etapas/[0-9a-fA-F-]{36})?$' then
   v_body:=v_body||E'\n\n'||
    case when v_row.target_link like '%/etapas/%' then 'Abrir etapa: '
         else 'Acompanhar projeto: ' end||
    'https://playsistem-oficial.playmomentsstudios.workers.dev'||v_row.target_link;
 end if;
 update public.whatsapp_message_outbox set status='sending_auto' where id=v_row.id;
 insert into public.whatsapp_bridge_attempts(outbox_id,instance_id,destination_phone,test_mode)
 values(v_row.id,p_instance,v_target,cfg.wa_bridge_test_only) returning id into v_attempt;
 return jsonb_build_object('attempt_id',v_attempt,'outbox_id',v_row.id,
  'phone',v_target,'message',v_body,'test_only',cfg.wa_bridge_test_only);
end $$;
