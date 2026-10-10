-- Only the private bridge service may record a resolved WhatsApp phone JID.
create or replace function public.wa_bridge_register_destination(
 p_instance uuid,p_attempt uuid,p_jid text
) returns boolean language plpgsql security invoker set search_path='' as $$
declare v_phone text; v_jidphone text;
begin
 if p_jid is null or p_jid !~ '^55[0-9]{10,11}@s\.whatsapp\.net$' then return false; end if;
 v_jidphone:=split_part(p_jid,'@',1);
 select destination_phone into v_phone from public.whatsapp_bridge_attempts
  where id=p_attempt and instance_id=p_instance and status='claimed' for update;
 if v_phone is null then return false; end if;
 if v_jidphone<>v_phone and not (
  v_phone ~ '^55[0-9]{2}9[0-9]{8}$'
  and v_jidphone ~ '^55[0-9]{10}$'
  and left(v_jidphone,4)=left(v_phone,4)
  and substring(v_jidphone from 5)=substring(v_phone from 6)
 ) then return false; end if;
 update public.whatsapp_bridge_attempts set destination_jid=p_jid
  where id=p_attempt and instance_id=p_instance and status='claimed';
 return found;
end $$;
revoke all on function public.wa_bridge_register_destination(uuid,uuid,text) from public,anon,authenticated;
grant execute on function public.wa_bridge_register_destination(uuid,uuid,text) to service_role;
