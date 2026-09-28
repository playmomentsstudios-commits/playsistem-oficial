alter table public.product_rentals add column if not exists picked_up_at timestamptz;
alter table public.product_rentals add column if not exists returned_at timestamptz;

create or replace function public.request_product_rental(p_product_id uuid,p_start_date date,p_end_date date,p_quantity integer default 1,p_notes text default null)
returns uuid language plpgsql security definer set search_path=public as $$
declare v_product public.products%rowtype; v_id uuid; v_days integer; v_reserved integer;
begin
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
grant execute on function public.request_product_rental(uuid,date,date,integer,text) to authenticated;

create or replace function public.admin_update_product_rental_status(p_rental_id uuid,p_status text)
returns public.product_rentals language plpgsql security definer set search_path=public as $$
declare v_role text; v_row public.product_rentals%rowtype; v_current text;
begin
 select role into v_role from public.profiles where id=auth.uid() and status='active';
 if v_role not in ('admin','staff') then raise exception 'Acesso negado.'; end if;
 select status into v_current from public.product_rentals where id=p_rental_id for update;
 if not found then raise exception 'Reserva nao encontrada.'; end if;
 if not ((v_current='confirmed' and p_status in ('checked_out','cancelled')) or (v_current='checked_out' and p_status='completed') or (v_current in ('pending','awaiting_payment') and p_status='cancelled')) then raise exception 'Transicao invalida.'; end if;
 update public.product_rentals set status=p_status,
 picked_up_at=case when p_status='checked_out' then coalesce(picked_up_at,now()) else picked_up_at end,
 returned_at=case when p_status='completed' then coalesce(returned_at,now()) else returned_at end,
 updated_at=now() where id=p_rental_id returning * into v_row;
 return v_row;
end $$;
grant execute on function public.admin_update_product_rental_status(uuid,text) to authenticated;
