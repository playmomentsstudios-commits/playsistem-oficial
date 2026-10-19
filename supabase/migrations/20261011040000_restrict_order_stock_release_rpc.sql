-- Keep order stock release behind the server-side service role.
-- The function changes inventory and has no caller identity guard.
revoke execute on function public.release_order_stock(uuid) from public, anon, authenticated;
