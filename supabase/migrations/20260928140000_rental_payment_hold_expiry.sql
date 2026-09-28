alter table public.product_rentals add column if not exists payment_hold_expires_at timestamptz;

create or replace function public.release_expired_rental_holds()
returns integer language plpgsql security definer set search_path=public as $$
declare v_count integer;
begin
 update public.product_rentals
 set status='cancelled',updated_at=now()
 where status='awaiting_payment'
   and payment_hold_expires_at is not null
   and payment_hold_expires_at<=now();
 get diagnostics v_count=row_count;
 return v_count;
end $$;

create or replace function public.checkout_product_rental(p_rental_id uuid)
returns uuid language plpgsql security definer set search_path=public as $$
declare v_rental public.product_rentals%rowtype; v_product public.products%rowtype; v_order_id uuid; v_order_number text;
begin
 perform public.release_expired_rental_holds();
 select * into v_rental from public.product_rentals where id=p_rental_id and customer_id=auth.uid() for update;
 if not found then raise exception 'Reserva nao encontrada.'; end if;
 if v_rental.status not in ('pending','awaiting_payment') then raise exception 'Esta reserva nao pode ser enviada para pagamento.'; end if;
 if v_rental.order_id is not null then return v_rental.order_id; end if;
 select * into v_product from public.products where id=v_rental.product_id;
 if not found then raise exception 'Produto nao encontrado.'; end if;
 v_order_number:='LOC-'||upper(substr(replace(v_rental.id::text,'-',''),1,10));
 insert into public.orders(customer_id,order_number,status,payment_status,subtotal,total)
 values(auth.uid(),v_order_number,'pending','pending',v_rental.total_amount,v_rental.total_amount)
 returning id into v_order_id;
 insert into public.order_items(order_id,product_id,name,quantity,unit_price,total_price)
 values(v_order_id,v_product.id,v_product.name||' - Locacao '||to_char(v_rental.start_date,'DD/MM/YYYY')||'-'||to_char(v_rental.end_date,'DD/MM/YYYY'),v_rental.quantity,v_rental.daily_price*v_rental.days,v_rental.total_amount);
 update public.product_rentals set order_id=v_order_id,status='awaiting_payment',
 payment_hold_expires_at=least(now()+interval '30 minutes',v_rental.start_date::timestamp),
 updated_at=now() where id=v_rental.id;
 return v_order_id;
end $$;

create or replace function public.request_product_rental(p_product_id uuid,p_start_date date,p_end_date date,p_quantity integer default 1,p_notes text default null)
returns uuid language plpgsql security definer set search_path=public as $$
declare v_product public.products%rowtype; v_id uuid; v_days integer; v_reserved integer;
begin
 perform public.release_expired_rental_holds();
 if auth.uid() is null then raise exception 'Usuario nao autenticado.'; end if;
 if p_end_date<p_start_date or p_start_date<current_date then raise exception 'Periodo invalido.'; end if;
 if p_quantity<1 then raise exception 'Quantidade invalida.'; end if;
 select * into v_product from public.products where id=p_product_id and active=true and status='published' for update;
 if not found then raise exception 'Produto indisponivel.'; end if;
 if v_product.commercial_mode not in ('rental','sale_and_rental') or v_product.rental_daily_price is null then raise exception 'Produto nao disponivel para locacao.'; end if;
 select coalesce(sum(quantity),0) into v_reserved from public.product_rentals
 where product_id=p_product_id and status in ('pending','awaiting_payment','confirmed','checked_out')
 and start_date<=p_end_date and end_date>=p_start_date;
 if v_product.inventory_tracked and v_reserved+p_quantity>v_product.stock then raise exception 'Sem disponibilidade para este periodo.'; end if;
 v_days:=(p_end_date-p_start_date)+1;
 insert into public.product_rentals(customer_id,product_id,start_date,end_date,days,quantity,daily_price,total_amount,notes)
 values(auth.uid(),p_product_id,p_start_date,p_end_date,v_days,p_quantity,v_product.rental_daily_price,v_product.rental_daily_price*v_days*p_quantity,p_notes)
 returning id into v_id; return v_id;
end $$;

create or replace function public.sync_rental_from_payment()
returns trigger language plpgsql security definer set search_path=public as $$
begin
 if lower(coalesce(new.status,'')) in ('paid','received','confirmed','approved') then
   update public.product_rentals set status='confirmed',payment_hold_expires_at=null,updated_at=now()
   where order_id=new.order_id and status='awaiting_payment'
     and (payment_hold_expires_at is null or payment_hold_expires_at>now());
 end if;
 return new;
end $$;
