-- Loyalty recalculation writes a customer's stored balance and is called by
-- SECURITY DEFINER triggers for paid orders and loyalty-settings changes.
-- Keep those owner-level calls and service_role access; remove the public RPC surface.
revoke execute on function public.recalculate_customer_loyalty(uuid) from public, anon, authenticated;
