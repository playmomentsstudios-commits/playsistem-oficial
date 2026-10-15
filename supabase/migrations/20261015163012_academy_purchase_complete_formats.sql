-- Require every purchased format before marking delivery complete.
create or replace function public.academy_fulfill_verified_purchase(p_purchase_id uuid)
returns text language plpgsql security definer set search_path='' as $$
declare v_order public.academy_work_purchases%rowtype;
 v_verified_at timestamptz;
 v_formats integer;
 v_item record;
 v_count integer:=0;
begin
 select * into v_order from public.academy_work_purchases where id=p_purchase_id for update;
 if not found then return 'not_found'; end if;
 if v_order.status='fulfilled' then return 'already_fulfilled'; end if;
 if v_order.status not in ('paid_waiting_email') then return 'not_paid'; end if;
 select u.email_confirmed_at into v_verified_at from auth.users u
 where u.id=v_order.user_id and lower(u.email)=lower(v_order.buyer_email);
 if v_verified_at is null then return 'waiting_email'; end if;
 select count(distinct i.format) into v_formats from public.academy_library_items i
 where i.work_id=v_order.work_id and i.status in ('published','private_beta')
 and (case when v_order.requested_format='combo' then i.format in ('ebook','audiobook')
   else v_order.requested_format=i.format end);
 -- Keep the payment retryable without blocking confirmation of the user's email.
 if v_formats<>(case when v_order.requested_format='combo' then 2 else 1 end) then
  return 'waiting_content';
 end if;
 for v_item in
  select i.id from public.academy_library_items i
  where i.work_id=v_order.work_id
    and i.status in ('published','private_beta')
    and (case when v_order.requested_format='combo' then i.format in ('ebook','audiobook')
      else v_order.requested_format=i.format end)
 loop
  insert into public.academy_library_grants(item_id,user_id,source,active)
  values(v_item.id,v_order.user_id,'purchase',true)
  on conflict(item_id,user_id) do update set active=true
   -- Never demote a manual/grant provenance when extending a real purchase.
   ,source=case when public.academy_library_grants.source='purchase' then 'purchase'
       else public.academy_library_grants.source end;
  v_count:=v_count+1;
 end loop;
 if v_count<>(case when v_order.requested_format='combo' then 2 else 1 end) then
  raise exception 'Purchased formats unavailable to fulfill purchase %',p_purchase_id;
 end if;
 update public.academy_work_purchases
 set status='fulfilled',fulfilled_at=now(),updated_at=now()
 where id=p_purchase_id;
 return 'fulfilled';
end $$;
revoke all on function public.academy_fulfill_verified_purchase(uuid) from public,anon,authenticated;
grant execute on function public.academy_fulfill_verified_purchase(uuid) to service_role;

