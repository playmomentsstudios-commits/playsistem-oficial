create or replace function public.sync_rental_operational_notifications()
returns integer
language plpgsql
security definer
set search_path=public
as $$
declare v_count integer:=0;
begin
  if not (public.rental_staff_has_permission('sales.view') or public.rental_staff_has_permission('sales.manage')) then
    raise exception 'Acesso negado.';
  end if;

  with alerts as (
    select r.id rental_id,p.name product_name,
      case
        when r.status='checked_out' and r.end_date<current_date then 'Devolucao atrasada'
        when r.status='checked_out' and r.end_date=current_date then 'Devolucao hoje'
        when r.status='confirmed' and r.start_date=current_date then 'Retirada hoje'
        when r.status='confirmed' and r.start_date=current_date+1 then 'Retirada amanha'
        when r.status='awaiting_payment' and r.start_date<=current_date+1 then 'Pagamento pendente antes da retirada'
      end title,
      case
        when r.status='checked_out' and r.end_date<current_date then p.name||' deveria ter sido devolvido em '||to_char(r.end_date,'DD/MM/YYYY')||'.'
        when r.status='checked_out' and r.end_date=current_date then p.name||' tem devolucao prevista para hoje.'
        when r.status='confirmed' and r.start_date=current_date then p.name||' tem retirada prevista para hoje.'
        when r.status='confirmed' and r.start_date=current_date+1 then p.name||' tem retirada prevista para amanha.'
        else p.name||' ainda aguarda pagamento e a retirada esta proxima.'
      end message
    from public.product_rentals r join public.products p on p.id=r.product_id
    where (r.status='checked_out' and r.end_date<=current_date)
       or (r.status='confirmed' and r.start_date between current_date and current_date+1)
       or (r.status='awaiting_payment' and r.start_date<=current_date+1)
  ), recipients as (
    select p.id
    from public.profiles p
    where p.status='active' and (
      p.role='admin'
      or (p.role='staff' and exists(
        select 1 from public.staff_profiles s
        where s.user_id=p.id and s.active=true
          and (
            'sales.view'=any(coalesce(s.permissions,'{}'::text[]))
            or 'sales.manage'=any(coalesce(s.permissions,'{}'::text[]))
            or '*'=any(coalesce(s.permissions,'{}'::text[]))
          )
      ))
    )
  ), inserted as (
    insert into public.notifications(user_id,title,message,link)
    select u.id,a.title,a.message,'/admin/locacoes'
    from alerts a cross join recipients u
    where a.title is not null and not exists(
      select 1 from public.notifications n
      where n.user_id=u.id and n.title=a.title and n.message=a.message
        and n.link='/admin/locacoes' and n.created_at::date=current_date
    )
    returning 1
  )
  select count(*) into v_count from inserted;
  return v_count;
end $$;
grant execute on function public.sync_rental_operational_notifications() to authenticated;
