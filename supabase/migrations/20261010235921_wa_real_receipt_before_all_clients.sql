-- Do not unlock all-client mode merely because sendMessage returned an id.
-- A real single-client receipt is required first.
create or replace function public.wa_bridge_require_real_receipt_for_expansion()
returns trigger language plpgsql security definer set search_path='' as $$
begin
 if new.wa_bridge_delivery_mode='consented_clients'
  and not exists(
   select 1 from public.whatsapp_bridge_attempts
   where test_mode=false and status='sent'
    and ack_status in ('delivered','read')
  ) then
   raise exception 'A entrega ao primeiro cliente ainda não foi confirmada pelo WhatsApp. Mantenha o modo de cliente individual.'
     using errcode='22023';
 end if;
 return new;
end $$;
drop trigger if exists wa_bridge_guard_expand_clients on public.app_settings;
create trigger wa_bridge_guard_expand_clients
 before update of wa_bridge_delivery_mode,wa_bridge_auto_enabled on public.app_settings
 for each row execute function public.wa_bridge_require_real_receipt_for_expansion();
revoke all on function public.wa_bridge_require_real_receipt_for_expansion() from public,anon,authenticated;
