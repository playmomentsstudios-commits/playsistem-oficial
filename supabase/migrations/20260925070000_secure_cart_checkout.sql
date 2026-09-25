-- Complete the production checkout without trusting prices from the browser.
-- Previous migrations through 20260925060000 are already applied in production.

create or replace function public.create_cart_order(p_items jsonb)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  item jsonb;
  p public.products%rowtype;
  qty integer;
  unit_amount integer;
  line_total integer;
  order_total integer := 0;
  order_uuid uuid;
begin
  if auth.uid() is null or not exists (
    select 1 from public.profiles
    where id = auth.uid() and role = 'customer' and status = 'active'
  ) then
    raise exception 'Customer access required' using errcode = '42501';
  end if;

  if p_items is null
     or jsonb_typeof(p_items) <> 'array'
     or jsonb_array_length(p_items) = 0
     or jsonb_array_length(p_items) > 50 then
    raise exception 'Invalid cart' using errcode = '22023';
  end if;

  insert into public.orders(customer_id,status,payment_status,subtotal,total)
  values(auth.uid(),'awaiting_payment','pending',0,0)
  returning id into order_uuid;

  for item in select value from jsonb_array_elements(p_items)
  loop
    begin
      qty := (item->>'quantity')::integer;
    exception when others then
      raise exception 'Invalid quantity' using errcode = '22023';
    end;

    if qty is null or qty < 1 or qty > 99 then
      raise exception 'Invalid quantity' using errcode = '22023';
    end if;

    select * into p
    from public.products
    where id = (item->>'product_id')::uuid
      and active = true
      and status = 'published'
      and commercial_mode in ('sale','sale_and_rental')
      and sale_price is not null
    for update;

    if not found then
      raise exception 'Product unavailable' using errcode = '22023';
    end if;

    if p.stock < qty then
      raise exception 'Insufficient stock for %', p.name using errcode = '22023';
    end if;

    unit_amount := coalesce(p.promotional_price,p.sale_price);
    line_total := unit_amount * qty;
    order_total := order_total + line_total;

    insert into public.order_items(
      order_id,item_type,product_id,name_snapshot,quantity,unit_price,total_price
    ) values (
      order_uuid,'product',p.id,p.name,qty,unit_amount,line_total
    );

    update public.products set stock = stock - qty where id = p.id;
  end loop;

  update public.orders
  set subtotal = order_total, total = order_total
  where id = order_uuid;

  insert into public.payments(customer_id,order_id,amount,method,status,provider)
  values(auth.uid(),order_uuid,order_total,'pix_manual','pending','manual');

  insert into public.notifications(user_id,type,title,message,link,metadata)
    select id,'order_created','Novo pedido',
      'Um cliente realizou um novo pedido.',
      '/admin/pedidos/'||order_uuid::text,
      jsonb_build_object('order_id',order_uuid)
    from public.profiles
    where role in ('admin','staff') and status='active';

  return order_uuid;
end
$$;

revoke all on function public.create_cart_order(jsonb) from public;
grant execute on function public.create_cart_order(jsonb) to authenticated;
