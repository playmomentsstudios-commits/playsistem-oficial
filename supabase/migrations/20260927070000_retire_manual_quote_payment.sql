-- Stage 6: keep quote conversion aligned with the authoritative Asaas payment flow.
-- The legacy function created a pix_manual/manual payment record, which was retired in Stage 4.
-- Quote conversion now creates the order/project only; the payment is created by the current Asaas flow.

create or replace function public.admin_convert_quote(
  p_quote_id uuid,
  p_create_project boolean default true
)
returns jsonb
language plpgsql
security definer
set search_path=public
as $$
declare
  q public.quotes%rowtype;
  order_uuid uuid;
  project_uuid uuid;
begin
  if not (
    public.current_user_is_admin()
    or (
      public.current_user_has_permission('quotes.manage')
      and public.current_user_has_permission('sales.manage')
    )
  ) then
    raise exception 'Commercial management permission required' using errcode='42501';
  end if;

  select * into q from public.quotes where id=p_quote_id for update;
  if not found then raise exception 'Quote not found' using errcode='P0002'; end if;
  if q.status<>'accepted' then raise exception 'Only accepted quotes can be converted' using errcode='22023'; end if;

  if q.converted_order_id is not null then
    return jsonb_build_object(
      'order_id',q.converted_order_id,
      'project_id',q.converted_project_id,
      'already_converted',true
    );
  end if;

  insert into public.orders(customer_id,status,payment_status,subtotal,total,notes)
  values(q.customer_id,'awaiting_payment','pending',q.subtotal,q.total,'Gerado a partir do orçamento '||q.quote_number)
  returning id into order_uuid;

  insert into public.order_items(order_id,item_type,name_snapshot,quantity,unit_price,total_price)
  select order_uuid,'service',description,quantity,unit_price,total_price
  from public.quote_items where quote_id=q.id;

  if p_create_project then
    insert into public.projects(
      title,description,project_type,customer_id,order_id,quote_id,status,priority,created_by
    )
    values(
      q.title,q.description,'service',q.customer_id,order_uuid,q.id,'planning','medium',auth.uid()
    )
    returning id into project_uuid;
  end if;

  update public.quotes
  set converted_order_id=order_uuid,converted_project_id=project_uuid
  where id=q.id;

  insert into public.notifications(user_id,type,title,message,link,metadata)
  values(
    q.customer_id,'quote_converted','Orçamento convertido em pedido',
    'Seu orçamento '||q.quote_number||' foi convertido em pedido.',
    '/app/pedidos/'||order_uuid::text,
    jsonb_build_object('quote_id',q.id,'order_id',order_uuid,'project_id',project_uuid)
  );

  return jsonb_build_object(
    'order_id',order_uuid,
    'project_id',project_uuid,
    'already_converted',false
  );
end;
$$;
