-- Rental reservation foundation: date-aware availability and server-side price calculation.
create table if not exists public.product_rentals(
 id uuid primary key default gen_random_uuid(),
 customer_id uuid not null references public.profiles(id) on delete restrict,
 product_id uuid not null references public.products(id) on delete restrict,
 start_date date not null,
 end_date date not null,
 days integer not null check(days>0),
 quantity integer not null default 1 check(quantity>0),
 daily_price integer not null check(daily_price>=0),
 total_amount integer not null check(total_amount>=0),
 status text not null default 'pending' check(status in ('pending','awaiting_payment','confirmed','cancelled','completed')),
 notes text,
 created_at timestamptz not null default now(),
 updated_at timestamptz not null default now(),
 constraint product_rentals_dates check(end_date>=start_date)
);
create index if not exists product_rentals_availability_idx on public.product_rentals(product_id,start_date,end_date,status);
alter table public.product_rentals enable row level security;
drop policy if exists product_rentals_customer_read on public.product_rentals;
create policy product_rentals_customer_read on public.product_rentals for select to authenticated using(customer_id=auth.uid() or public.current_user_is_admin());
grant select on public.product_rentals to authenticated;

create or replace function public.request_product_rental(p_product_id uuid,p_start_date date,p_end_date date,p_quantity integer default 1,p_notes text default null)
returns uuid
language plpgsql security definer set search_path=public
as $$
declare
 v_product public.products%rowtype; v_id uuid; v_days integer; v_reserved integer;
begin
 if auth.uid() is null then raise exception 'Usuário não autenticado.'; end if;
 if p_end_date<p_start_date or p_start_date<current_date then raise exception 'Período de locação inválido.'; end if;
 if p_quantity<1 then raise exception 'Quantidade inválida.'; end if;
 select * into v_product from public.products where id=p_product_id and active=true and status='published' for update;
 if not found then raise exception 'Produto indisponível.'; end if;
 if v_product.commercial_mode not in ('rental','sale_and_rental') or v_product.rental_daily_price is null then raise exception 'Produto não disponível para locação.'; end if;
 select coalesce(sum(quantity),0) into v_reserved from public.product_rentals
 where product_id=p_product_id and status in ('pending','awaiting_payment','confirmed')
 and start_date<=p_end_date and end_date>=p_start_date;
 if v_product.inventory_tracked and v_reserved+p_quantity>v_product.stock then raise exception 'Sem disponibilidade para este período.'; end if;
 v_days:=(p_end_date-p_start_date)+1;
 insert into public.product_rentals(customer_id,product_id,start_date,end_date,days,quantity,daily_price,total_amount,notes)
 values(auth.uid(),p_product_id,p_start_date,p_end_date,v_days,p_quantity,v_product.rental_daily_price,v_product.rental_daily_price*v_days*p_quantity,p_notes)
 returning id into v_id;
 return v_id;
end; $$;
grant execute on function public.request_product_rental(uuid,date,date,integer,text) to authenticated;
