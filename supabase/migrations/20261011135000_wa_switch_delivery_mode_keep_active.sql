-- Atomic administrator-only delivery-mode switch.
-- Preserve an already-enabled bridge only when the operator explicitly confirms.
-- Existing eligibility, test-gate, connected-device and daily-limit checks remain intact.
create or replace function public.wa_bridge_save_delivery_mode(
  p_mode text,
  p_customer_id uuid default null,
  p_keep_enabled boolean default false
) returns text language plpgsql security definer set search_path='' as $$
declare
  v_was_enabled boolean;
  v_result text;
begin
  if not public.current_user_is_admin() then
    raise exception 'Somente administradores.' using errcode='42501';
  end if;
  select wa_bridge_auto_enabled into v_was_enabled
  from public.app_settings where id=true for update;
  if not found then raise exception 'Configurações de envio não encontradas.' using errcode='22023'; end if;
  if p_keep_enabled and not coalesce(v_was_enabled,false) then
    raise exception 'Os envios estão pausados. Ative-os separadamente antes de manter essa opção.' using errcode='22023';
  end if;
  -- Pauses temporarily within this single transaction and validates mode and customer.
  perform public.wa_bridge_set_delivery_mode(p_mode,p_customer_id);
  if p_keep_enabled then
    -- Reuses existing safeguards for phone, heartbeat, opt-in and pilot gate.
    perform public.wa_bridge_admin_control('enable');
    v_result:='Modo atualizado; envios permanecem ativos para novas notificações.';
  else
    v_result:='Modo atualizado; envios permanecem pausados.';
  end if;
  return v_result;
end $$;
revoke all on function public.wa_bridge_save_delivery_mode(text,uuid,boolean) from public,anon;
grant execute on function public.wa_bridge_save_delivery_mode(text,uuid,boolean) to authenticated;
