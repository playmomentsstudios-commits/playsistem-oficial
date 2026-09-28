alter table public.product_rentals drop constraint if exists product_rentals_status_check;
alter table public.product_rentals add constraint product_rentals_status_check check(status in ('pending','awaiting_payment','confirmed','checked_out','cancelled','completed'));
create or replace function public.admin_update_product_rental_status(p_rental_id uuid,p_status text)
returns public.product_rentals language plpgsql security definer set search_path=public as $$
declare v_role text; v_row public.product_rentals%rowtype;
begin
 select role into v_role from public.profiles where id=auth.uid() and status='active';
 if v_role not in ('admin','staff') then raise exception 'Acesso negado.'; end if;
 if p_status not in ('confirmed','checked_out','completed','cancelled') then raise exception 'Status inválido.'; end if;
 update public.product_rentals set status=p_status,updated_at=now() where id=p_rental_id returning * into v_row;
 if not found then raise exception 'Reserva não encontrada.'; end if;
 return v_row;
end $$;
grant execute on function public.admin_update_product_rental_status(uuid,text) to authenticated;
drop policy if exists product_rentals_staff_read on public.product_rentals;
create policy product_rentals_staff_read on public.product_rentals for select to authenticated using(
 customer_id=auth.uid() or exists(select 1 from public.profiles p where p.id=auth.uid() and p.status='active' and p.role in ('admin','staff'))
);
