-- Restore reserved product stock exactly once when an unpaid order is cancelled/rejected.
alter table public.orders
  add column if not exists stock_released_at timestamptz;

create or replace function public.release_order_stock(p_order_id uuid)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
declare
  o public.orders%rowtype;
  item record;
begin
  select * into o
  from public.orders
  where id = p_order_id
  for update;

  if not found then
    raise exception 'Order not found' using errcode = 'P0002';
  end if;

  if o.payment_status in ('paid','refunded') then
    return false;
  end if;

  if o.stock_released_at is not null then
    return false;
  end if;

  for item in
    select product_id, sum(quantity)::integer as quantity
    from public.order_items
    where order_id = p_order_id
      and item_type = 'product'
      and product_id is not null
    group by product_id
  loop
    update public.products
      set stock = stock + item.quantity
    where id = item.product_id;
  end loop;

  update public.orders
    set stock_released_at = now()
  where id = p_order_id;

  return true;
end
$$;

revoke all on function public.release_order_stock(uuid) from public;
grant execute on function public.release_order_stock(uuid) to service_role;

comment on column public.orders.stock_released_at is
  'Timestamp when reserved product stock was returned after an unpaid order ended.';
