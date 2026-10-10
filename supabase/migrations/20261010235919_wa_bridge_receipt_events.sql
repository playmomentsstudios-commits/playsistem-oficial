alter table public.whatsapp_bridge_attempts
 add column if not exists ack_error_reason text;
alter table public.whatsapp_bridge_attempts
 drop constraint if exists wa_bridge_ack_status_valid;
alter table public.whatsapp_bridge_attempts
 add constraint wa_bridge_ack_status_valid
 check (ack_status in ('unconfirmed','server_ack','delivered','read','rejected'));

create or replace function public.wa_bridge_record_receipt(
 p_instance uuid,p_message_id text,p_code integer,p_note text default null
) returns boolean language plpgsql security invoker set search_path='' as $$
declare v_attempt uuid; v_outbox uuid; v_current text; v_next text;
begin
 if length(coalesce(p_message_id,''))<8 or length(p_message_id)>255
 or p_code not in (0,2,3,4,5) then return false; end if;
 select id,outbox_id,ack_status into v_attempt,v_outbox,v_current
 from public.whatsapp_bridge_attempts
 where instance_id=p_instance and provider_message_id=p_message_id
  and status='sent' and destination_jid is not null for update;
 if v_attempt is null then return false; end if;
 v_next:=case p_code when 0 then 'rejected' when 2 then 'server_ack'
   when 3 then 'delivered' else 'read' end;
 if v_current='rejected' or
    (v_current='read' and v_next<>'read') or
    (v_current='delivered' and v_next in ('server_ack','rejected'))
 then return true; end if;
 update public.whatsapp_bridge_attempts set
  ack_status=v_next,ack_at=now(),
  ack_error_reason=case when v_next='rejected' then left(coalesce(p_note,'Rejeição do WhatsApp'),250) else null end,
  status=case when v_next='rejected' then 'failed' else status end,
  error_reason=case when v_next='rejected' then left(coalesce(p_note,'Rejeição do WhatsApp'),250) else error_reason end
 where id=v_attempt;
 if v_next='rejected' then
  update public.whatsapp_message_outbox set status='failed_auto'
   where id=v_outbox and status='sent_auto';
 end if;
 return true;
end $$;
revoke all on function public.wa_bridge_record_receipt(uuid,text,integer,text) from public,anon,authenticated;
grant execute on function public.wa_bridge_record_receipt(uuid,text,integer,text) to service_role;

create or replace function public.wa_bridge_receipt_summary()
returns jsonb language sql stable security definer set search_path='' as $$
 select case when public.current_user_is_admin() then jsonb_build_object(
   'server_acked_today',count(*) filter(where ack_status='server_ack'),
   'delivered_today',count(*) filter(where ack_status='delivered'),
   'read_today',count(*) filter(where ack_status='read'),
   'unconfirmed_today',count(*) filter(where ack_status='unconfirmed' and status='sent'),
   'rejected_today',count(*) filter(where ack_status='rejected')
 ) else '{}'::jsonb end
 from public.whatsapp_bridge_attempts
 where (claimed_at at time zone 'America/Sao_Paulo')::date=
 (now() at time zone 'America/Sao_Paulo')::date;
$$;
revoke all on function public.wa_bridge_receipt_summary() from public,anon;
grant execute on function public.wa_bridge_receipt_summary() to authenticated;
