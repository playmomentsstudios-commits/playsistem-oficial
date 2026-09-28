create or replace function public.sync_rental_operational_notifications()
returns integer
language plpgsql
security definer
set search_path=public
as $$
declare
  v_role text;
  v_count integer:=0;
begin
  select role into v_role from public.profiles where id=auth.uid() and status='active';
  if v_role not in ('admin','staff') then raise exception 'Acesso negado.'; end if;

  with alerts as (
    select r.id rental_id,p.name product_name,
      case
        when r.status='checked_out' and r.end_date<current_date then 'Devolução atrasada'
        when r.status='checked_out' and r.end_date=current_date then 'Devolução hoje'
        when r.status='confirmed' and r.start_date=current_date then 'Retirada hoje'
        when r.status='confirmed' and r.start_date=current_date+1 then 'Retirada amanhã'
        when r.status='awaiting_payment' and r.start_date<=current_date+1 then 'Pagamento pendente antes da retirada'
      end title,
      case
        when r.status='checked_out' and r.end_date<current_date then product_name||' deveria ter sido devolvido em '||to_char(r.end_date,'DD/MM/YYYY')||'.'
        when r.status='checked_out' and r.end_date=current_date then product_name||' tem devolução prevista para hoje.'
        when r.status='confirmed' and r.start_date=current_date then product_name||' tem retirada prevista para hoje.'
        when r.status='confirmed' and r.start_date=current_date+1 then product_name||' tem retirada prevista para amanhã.'
        else product_name||' ainda aguarda pagamento e a retirada está próxima.'
      end message
    from public.product_rentals r join public.products p on p.id=r.product_id
    where (r.status='checked_out' and r.end_date<=current_date)
       or (r.status='confirmed' and r.start_date between current_date and current_date+1)
       or (r.status='awaiting_payment' and r.start_date<=current_date+1)
  ), recipients as (
    select id from public.profiles where status='active' and role in ('admin','staff')
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
