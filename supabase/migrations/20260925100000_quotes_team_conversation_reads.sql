-- Orçamentos profissionais, gestão de equipe e leitura individual de conversas.
-- Requer migrations anteriores até 20260925090000 já aplicadas.

alter table public.quotes
  add column if not exists converted_order_id uuid references public.orders(id) on delete set null,
  add column if not exists converted_project_id uuid references public.projects(id) on delete set null;

create or replace function public.recalculate_quote_totals()
returns trigger
language plpgsql
security definer
set search_path=public
as $$
declare
  target_quote uuid;
  new_total integer;
begin
  target_quote := coalesce(new.quote_id, old.quote_id);

  select coalesce(sum(total_price),0)::integer
  into new_total
  from public.quote_items
  where quote_id=target_quote;

  update public.quotes
  set subtotal=new_total,total=new_total
  where id=target_quote;

  return coalesce(new,old);
end;
$$;

drop trigger if exists quote_items_recalculate_totals on public.quote_items;
create trigger quote_items_recalculate_totals
after insert or update or delete on public.quote_items
for each row execute function public.recalculate_quote_totals();

create or replace function public.admin_convert_quote(
  p_quote_id uuid,
  p_create_project boolean default true
)
returns jsonb
language plpgsql
security definer
set search_path=public
as $$
declare
  q public.quotes%rowtype;
  order_uuid uuid;
  project_uuid uuid;
begin
  if not public.current_user_is_staff_or_admin() then
    raise exception 'Staff access required' using errcode='42501';
  end if;

  select * into q
  from public.quotes
  where id=p_quote_id
  for update;

  if not found then
    raise exception 'Quote not found' using errcode='P0002';
  end if;

  if q.status <> 'accepted' then
    raise exception 'Only accepted quotes can be converted' using errcode='22023';
  end if;

  if q.converted_order_id is not null then
    return jsonb_build_object(
      'order_id',q.converted_order_id,
      'project_id',q.converted_project_id,
      'already_converted',true
    );
  end if;

  insert into public.orders(
    customer_id,status,payment_status,subtotal,total,notes
  )
  values(
    q.customer_id,'awaiting_payment','pending',q.subtotal,q.total,
    'Gerado a partir do orçamento '||q.quote_number
  )
  returning id into order_uuid;

  insert into public.order_items(
    order_id,item_type,name_snapshot,quantity,unit_price,total_price
  )
  select
    order_uuid,'service',description,quantity,unit_price,total_price
  from public.quote_items
  where quote_id=q.id;

  if q.total > 0 then
    insert into public.payments(
      customer_id,order_id,quote_id,amount,method,status,provider
    )
    values(
      q.customer_id,order_uuid,q.id,q.total,'pix_manual','pending','manual'
    );
  end if;

  if p_create_project then
    insert into public.projects(
      title,description,project_type,customer_id,order_id,quote_id,status,priority,created_by
    )
    values(
      q.title,q.description,'service',q.customer_id,order_uuid,q.id,'planning','medium',auth.uid()
    )
    returning id into project_uuid;
  end if;

  update public.quotes
  set converted_order_id=order_uuid,
      converted_project_id=project_uuid
  where id=q.id;

  insert into public.notifications(user_id,type,title,message,link,metadata)
  values(
    q.customer_id,
    'quote_converted',
    'Orçamento convertido em pedido',
    'Seu orçamento '||q.quote_number||' foi convertido em pedido.',
    '/app/pedidos/'||order_uuid::text,
    jsonb_build_object('quote_id',q.id,'order_id',order_uuid,'project_id',project_uuid)
  );

  return jsonb_build_object(
    'order_id',order_uuid,
    'project_id',project_uuid,
    'already_converted',false
  );
end;
$$;

revoke all on function public.admin_convert_quote(uuid,boolean) from public;
grant execute on function public.admin_convert_quote(uuid,boolean) to authenticated;

create or replace function public.admin_set_member_role(
  p_user_id uuid,
  p_role text
)
returns void
language plpgsql
security definer
set search_path=public
as $$
declare
  caller_role text;
  target_role text;
begin
  select role into caller_role
  from public.profiles
  where id=auth.uid() and status='active';

  if caller_role <> 'admin' then
    raise exception 'Administrator access required' using errcode='42501';
  end if;

  if p_role not in ('customer','staff','admin') then
    raise exception 'Invalid role' using errcode='22023';
  end if;

  select role into target_role
  from public.profiles
  where id=p_user_id
  for update;

  if not found then
    raise exception 'User not found' using errcode='P0002';
  end if;

  if p_user_id=auth.uid() and p_role<>'admin' then
    raise exception 'You cannot remove your own administrator role' using errcode='22023';
  end if;

  update public.profiles
  set role=p_role
  where id=p_user_id;
end;
$$;

revoke all on function public.admin_set_member_role(uuid,text) from public;
grant execute on function public.admin_set_member_role(uuid,text) to authenticated;

create table if not exists public.conversation_reads (
  conversation_id uuid not null references public.conversations(id) on delete cascade,
  user_id uuid not null references public.profiles(id) on delete cascade,
  last_read_at timestamptz not null default now(),
  primary key(conversation_id,user_id)
);

alter table public.conversation_reads enable row level security;

drop policy if exists conversation_reads_own on public.conversation_reads;
create policy conversation_reads_own
on public.conversation_reads
for all
to authenticated
using (user_id=auth.uid())
with check (
  user_id=auth.uid()
  and exists (
    select 1
    from public.conversations c
    where c.id=conversation_id
      and (
        public.current_user_is_staff_or_admin()
        or (c.customer_id=auth.uid() and public.current_user_is_active_customer())
      )
  )
);

grant select,insert,update on public.conversation_reads to authenticated;

create or replace function public.mark_conversation_read_v2(p_conversation_id uuid)
returns void
language plpgsql
security definer
set search_path=public
as $$
begin
  if not exists (
    select 1
    from public.conversations c
    where c.id=p_conversation_id
      and (
        public.current_user_is_staff_or_admin()
        or (c.customer_id=auth.uid() and public.current_user_is_active_customer())
      )
  ) then
    raise exception 'Conversation access denied' using errcode='42501';
  end if;

  insert into public.conversation_reads(conversation_id,user_id,last_read_at)
  values(p_conversation_id,auth.uid(),now())
  on conflict(conversation_id,user_id)
  do update set last_read_at=excluded.last_read_at;
end;
$$;

revoke all on function public.mark_conversation_read_v2(uuid) from public;
grant execute on function public.mark_conversation_read_v2(uuid) to authenticated;

create or replace function public.unread_message_count()
returns integer
language sql
stable
security definer
set search_path=public
as $$
  select count(*)::integer
  from public.messages m
  join public.conversations c on c.id=m.conversation_id
  left join public.conversation_reads r
    on r.conversation_id=c.id and r.user_id=auth.uid()
  where m.sender_id<>auth.uid()
    and m.created_at>coalesce(r.last_read_at,'epoch'::timestamptz)
    and (
      public.current_user_is_staff_or_admin()
      or (c.customer_id=auth.uid() and public.current_user_is_active_customer())
    );
$$;

revoke all on function public.unread_message_count() from public;
grant execute on function public.unread_message_count() to authenticated;
