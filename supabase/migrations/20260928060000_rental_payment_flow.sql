-- Connect rentals to the existing order/payment pipeline.
alter table public.product_rentals add column if not exists order_id uuid references public.orders(id) on delete set null;
create unique index if not exists product_rentals_order_unique on public.product_rentals(order_id) where order_id is not null;

create or replace function public.checkout_product_rental(p_rental_id uuid)
returns uuid
language plpgsql security definer set search_path=public
as $$
declare v_rental public.product_rentals%rowtype; v_product public.products%rowtype; v_order_id uuid; v_order_number text;
begin
 select * into v_rental from public.product_rentals where id=p_rental_id and customer_id=auth.uid() for update;
 if not found then raise exception 'Reserva não encontrada.'; end if;
 if v_rental.status not in ('pending','awaiting_payment') then raise exception 'Esta reserva não pode ser enviada para pagamento.'; end if;
 if v_rental.order_id is not null then return v_rental.order_id; end if;
 select * into v_product from public.products where id=v_rental.product_id;
 if not found then raise exception 'Produto não encontrado.'; end if;
 v_order_number:='LOC-'||upper(substr(replace(v_rental.id::text,'-',''),1,10));
 insert into public.orders(customer_id,order_number,status,payment_status,subtotal,total)
 values(auth.uid(),v_order_number,'pending','pending',v_rental.total_amount,v_rental.total_amount)
 returning id into v_order_id;
 insert into public.order_items(order_id,product_id,name,quantity,unit_price,total_price)
 values(v_order_id,v_product.id,v_product.name||' · Locação '||to_char(v_rental.start_date,'DD/MM/YYYY')||'–'||to_char(v_rental.end_date,'DD/MM/YYYY'),v_rental.quantity,v_rental.daily_price*v_rental.days,v_rental.total_amount);
 update public.product_rentals set order_id=v_order_id,status='awaiting_payment',updated_at=now() where id=v_rental.id;
 return v_order_id;
end; $$;
grant execute on function public.checkout_product_rental(uuid) to authenticated;

create or replace function public.sync_rental_from_payment()
returns trigger language plpgsql security definer set search_path=public
as $$
begin
 if lower(coalesce(new.status,'')) in ('paid','received','confirmed','approved') then
   update public.product_rentals set status='confirmed',updated_at=now()
   where order_id=new.order_id and status='awaiting_payment';
 end if;
 return new;
end; $$;
drop trigger if exists trg_sync_rental_from_payment on public.payments;
create trigger trg_sync_rental_from_payment after insert or update of status on public.payments
for each row execute function public.sync_rental_from_payment();
