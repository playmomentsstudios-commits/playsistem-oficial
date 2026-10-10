-- Botão de teste isolado: apenas admins, somente telefone de teste e canal explicitamente ativado.
create or replace function public.wa_bridge_prepare_test()
returns uuid language plpgsql security definer set search_path='' as $$
declare cfg public.app_settings%rowtype; bridge public.whatsapp_bridge_state%rowtype; v_admin uuid; v_notice uuid; v_outbox uuid;
begin
 if not public.current_user_is_admin() then raise exception 'Somente administradores' using errcode='42501'; end if;
 select * into cfg from public.app_settings where id=true;
 select * into bridge from public.whatsapp_bridge_state where id=true;
 if not cfg.wa_bridge_test_only or not cfg.wa_bridge_auto_enabled
 or bridge.status<>'connected' or bridge.heartbeat_at<now()-interval '35 seconds'
 or bridge.connected_phone is distinct from cfg.wa_bridge_sender_phone
 or bridge.requested_mode<>'connect' then
   raise exception 'Conecte a conta correta e ative o modo piloto antes de testar' using errcode='22023';
 end if;
 v_admin:=auth.uid();
 insert into public.notifications(user_id,type,title,message,link,metadata)
 values(v_admin,'wa_bridge_test','Teste do WhatsApp Sagamente',
  'Este aviso é um teste do sistema QR Code da Sagamente. Não envolve clientes.',
  '/admin/whatsapp',jsonb_build_object('whatsapp_bridge_test',true))
 returning id into v_notice;
 insert into public.whatsapp_message_outbox(notification_id,recipient_user_id,recipient_name,destination_phone,event_type,title,message_body,target_link,status,source)
 values(v_notice,v_admin,'Administrador - teste',cfg.wa_bridge_test_phone,
  'wa_bridge_test','Teste WhatsApp Sagamente',
  'SAGAMENTE — teste do WhatsApp via QR Code. Nenhum cliente foi contatado.',
  '/admin/whatsapp','ready_manual','live')
 returning id into v_outbox;
 return v_outbox;
end $$;
revoke all on function public.wa_bridge_prepare_test() from public,anon;
grant execute on function public.wa_bridge_prepare_test() to authenticated;
