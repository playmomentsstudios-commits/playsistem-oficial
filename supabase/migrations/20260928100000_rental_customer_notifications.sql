create or replace function public.sync_my_rental_notifications()
returns integer
language plpgsql
security definer
set search_path=public
as $$
declare v_count integer:=0; v_enabled boolean:=true;
begin
  if auth.uid() is null then raise exception 'Sessão não encontrada.'; end if;
  select coalesce(notify_portal,true) into v_enabled from public.user_preferences where user_id=auth.uid();
  if not coalesce(v_enabled,true) then return 0; end if;

  with alerts as (
    select r.id,p.name product_name,
      case
        when r.status='confirmed' and r.start_date=current_date then 'Sua retirada é hoje'
        when r.status='confirmed' and r.start_date=current_date+1 then 'Sua retirada é amanhã'
        when r.status='checked_out' and r.end_date=current_date then 'Sua devolução é hoje'
        when r.status='checked_out' and r.end_date<current_date then 'Devolução pendente'
        when r.status='awaiting_payment' and r.start_date<=current_date+1 then 'Pagamento pendente da locação'
      end title,
      case
        when r.status='confirmed' and r.start_date=current_date then p.name||' está previsto para retirada hoje.'
        when r.status='confirmed' and r.start_date=current_date+1 then p.name||' está previsto para retirada amanhã.'
        when r.status='checked_out' and r.end_date=current_date then p.name||' tem devolução prevista para hoje.'
        when r.status='checked_out' and r.end_date<current_date then p.name||' tinha devolução prevista para '||to_char(r.end_date,'DD/MM/YYYY')||'.'
        else 'Finalize o pagamento de '||p.name||' para confirmar sua locação.'
      end message
    from public.product_rentals r join public.products p on p.id=r.product_id
    where r.customer_id=auth.uid() and (
      (r.status='confirmed' and r.start_date between current_date and current_date+1)
      or (r.status='checked_out' and r.end_date<=current_date)
      or (r.status='awaiting_payment' and r.start_date<=current_date+1)
    )
  ), ins as (
    insert into public.notifications(user_id,title,message,link)
    select auth.uid(),a.title,a.message,'/app/pedidos'
    from alerts a
    where a.title is not null and not exists(
      select 1 from public.notifications n
      where n.user_id=auth.uid() and n.title=a.title and n.message=a.message
        and n.link='/app/pedidos' and n.created_at::date=current_date
    ) returning 1
  )
  select count(*) into v_count from ins;
  return v_count;
end $$;
grant execute on function public.sync_my_rental_notifications() to authenticated;
