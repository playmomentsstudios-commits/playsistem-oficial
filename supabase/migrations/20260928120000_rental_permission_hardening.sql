create or replace function public.rental_staff_has_permission(p_permission text)
returns boolean
language sql stable security definer set search_path=public
as $$
  select
    exists(select 1 from public.profiles p where p.id=auth.uid() and p.status='active' and p.role='admin')
    or exists(
      select 1
      from public.profiles p
      join public.staff_profiles s on s.user_id=p.id
      where p.id=auth.uid() and p.status='active' and p.role='staff' and s.active=true
        and (p_permission=any(coalesce(s.permissions,'{}'::text[])) or '*'=any(coalesce(s.permissions,'{}'::text[])))
    );
$$;
grant execute on function public.rental_staff_has_permission(text) to authenticated;

create or replace function public.admin_update_product_rental_status(p_rental_id uuid,p_status text)
returns public.product_rentals language plpgsql security definer set search_path=public as $$
declare v_row public.product_rentals%rowtype; v_current text;
begin
 if not public.rental_staff_has_permission('sales.manage') then raise exception 'Acesso negado.'; end if;
 select status into v_current from public.product_rentals where id=p_rental_id for update;
 if not found then raise exception 'Reserva nao encontrada.'; end if;
 if not ((v_current='confirmed' and p_status in ('checked_out','cancelled')) or (v_current='checked_out' and p_status='completed') or (v_current in ('pending','awaiting_payment') and p_status='cancelled')) then raise exception 'Transicao invalida.'; end if;
 update public.product_rentals set status=p_status,
 picked_up_at=case when p_status='checked_out' then coalesce(picked_up_at,now()) else picked_up_at end,
 returned_at=case when p_status='completed' then coalesce(returned_at,now()) else returned_at end,
 updated_at=now() where id=p_rental_id returning * into v_row;
 return v_row;
end $$;

drop policy if exists product_rentals_staff_read on public.product_rentals;
create policy product_rentals_staff_read on public.product_rentals for select to authenticated using(
 customer_id=auth.uid()
 or public.rental_staff_has_permission('sales.view')
 or public.rental_staff_has_permission('sales.manage')
);
