-- Commerce events advance CRM from actual customer actions, without allowing stage regression.
create or replace function public.sync_customer_crm_from_order()
returns trigger
language plpgsql
security definer
set search_path=public
as $$
declare
  v_stage text;
  v_note text;
begin
  if new.customer_id is null then return new; end if;

  insert into public.customer_crm(customer_id,stage,source,last_contact_at,internal_notes)
  values(new.customer_id,'new_contact','Checkout',now(),'Pedido criado pelo cliente: '||new.id::text)
  on conflict(customer_id) do nothing;

  select stage into v_stage from public.customer_crm where customer_id=new.customer_id for update;
  v_note:='Pedido '||new.id::text||' · status: '||coalesce(new.status,'não informado');

  -- Creating an order is stronger intent than browsing: early leads move to negotiation.
  if tg_op='INSERT' and v_stage in ('new_contact','in_service','quote') then
    update public.customer_crm set stage='negotiation',source=coalesce(nullif(source,''),'Checkout'),
      next_action='Acompanhar pagamento do pedido',last_contact_at=now(),
      internal_notes=case when coalesce(internal_notes,'') like '%'||v_note||'%' then internal_notes else concat_ws(E'\n',nullif(internal_notes,''),v_note) end,
      updated_at=now()
    where customer_id=new.customer_id;
    if v_stage is distinct from 'negotiation' then
      insert into public.customer_crm_history(customer_id,from_stage,to_stage,note)
      values(new.customer_id,v_stage,'negotiation','Avanço automático: pedido criado pelo cliente.');
    end if;
  else
    update public.customer_crm set last_contact_at=now(),
      internal_notes=case when coalesce(internal_notes,'') like '%'||v_note||'%' then internal_notes else concat_ws(E'\n',nullif(internal_notes,''),v_note) end,
      updated_at=now()
    where customer_id=new.customer_id;
  end if;
  return new;
end;
$$;

drop trigger if exists trg_sync_customer_crm_from_order on public.orders;
create trigger trg_sync_customer_crm_from_order
after insert on public.orders
for each row execute function public.sync_customer_crm_from_order();

create or replace function public.sync_customer_crm_from_payment()
returns trigger
language plpgsql
security definer
set search_path=public
as $$
declare
  v_customer uuid;
  v_stage text;
  v_paid boolean;
begin
  select customer_id into v_customer from public.orders where id=new.order_id;
  if v_customer is null then return new; end if;
  select stage into v_stage from public.customer_crm where customer_id=v_customer for update;
  v_paid:=lower(coalesce(new.status,'')) in ('paid','received','confirmed','approved');

  if v_paid and v_stage in ('new_contact','in_service','quote','negotiation') then
    update public.customer_crm set stage='won',next_action='Iniciar atendimento/produção do pedido',
      last_contact_at=now(),updated_at=now() where customer_id=v_customer;
    insert into public.customer_crm_history(customer_id,from_stage,to_stage,note)
    values(v_customer,v_stage,'won','Avanço automático: pagamento confirmado.');
  end if;
  return new;
end;
$$;

drop trigger if exists trg_sync_customer_crm_from_payment on public.payments;
create trigger trg_sync_customer_crm_from_payment
after insert or update of status on public.payments
for each row execute function public.sync_customer_crm_from_payment();
