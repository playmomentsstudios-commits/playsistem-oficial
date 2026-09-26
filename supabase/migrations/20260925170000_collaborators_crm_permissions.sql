-- Collaborators, granular permissions and CRM-style conversation assignment.
-- Requires previous migrations through 20260925160000.

create table if not exists public.staff_profiles (
  user_id uuid primary key references public.profiles(id) on delete cascade,
  job_title text not null default 'Colaborador',
  department text not null default 'operations'
    check (department in ('commercial','design','video','audio','web','support','finance','operations','custom')),
  permissions text[] not null default '{}',
  active boolean not null default true,
  color text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  updated_by uuid references public.profiles(id) on delete set null
);

insert into public.staff_profiles(user_id,job_title,department,permissions,active)
select id,'Colaborador','operations',array['*']::text[],true
from public.profiles
where role='staff'
on conflict(user_id) do nothing;

alter table public.conversations
  add column if not exists assigned_to uuid references public.profiles(id) on delete set null,
  add column if not exists assigned_by uuid references public.profiles(id) on delete set null,
  add column if not exists assigned_at timestamptz,
  add column if not exists status text not null default 'open'
    check (status in ('open','pending','resolved')),
  add column if not exists priority text not null default 'normal'
    check (priority in ('low','normal','high','urgent')),
  add column if not exists tags text[] not null default '{}';

create index if not exists conversations_assigned_to_idx
  on public.conversations(assigned_to,updated_at desc);
create index if not exists conversations_status_idx
  on public.conversations(status,updated_at desc);

create table if not exists public.conversation_assignment_history (
  id uuid primary key default gen_random_uuid(),
  conversation_id uuid not null references public.conversations(id) on delete cascade,
  from_user_id uuid references public.profiles(id) on delete set null,
  to_user_id uuid references public.profiles(id) on delete set null,
  transferred_by uuid not null references public.profiles(id) on delete cascade,
  note text,
  created_at timestamptz not null default now()
);

create index if not exists conversation_assignment_history_conversation_idx
  on public.conversation_assignment_history(conversation_id,created_at desc);

alter table public.staff_profiles enable row level security;
alter table public.conversation_assignment_history enable row level security;

create or replace function public.current_user_is_admin()
returns boolean
language sql
stable
security definer
set search_path=public
as $$
  select exists(
    select 1 from public.profiles
    where id=auth.uid() and role='admin' and status='active'
  );
$$;

create or replace function public.current_user_has_permission(p_permission text)
returns boolean
language sql
stable
security definer
set search_path=public
as $$
  select exists(
    select 1
    from public.profiles p
    where p.id=auth.uid()
      and p.status='active'
      and (
        p.role='admin'
        or (
          p.role='staff'
          and exists(
            select 1
            from public.staff_profiles sp
            where sp.user_id=p.id
              and sp.active
              and ('*'=any(sp.permissions) or p_permission=any(sp.permissions))
          )
        )
      )
  );
$$;

revoke all on function public.current_user_is_admin() from public;
revoke all on function public.current_user_has_permission(text) from public;
grant execute on function public.current_user_is_admin() to authenticated;
grant execute on function public.current_user_has_permission(text) to authenticated;

drop policy if exists staff_profiles_read on public.staff_profiles;
create policy staff_profiles_read
on public.staff_profiles for select to authenticated
using (public.current_user_is_staff_or_admin());

drop policy if exists staff_profiles_admin_write on public.staff_profiles;
create policy staff_profiles_admin_write
on public.staff_profiles for all to authenticated
using (public.current_user_is_admin())
with check (public.current_user_is_admin());

drop policy if exists conversation_assignment_history_read on public.conversation_assignment_history;
create policy conversation_assignment_history_read
on public.conversation_assignment_history for select to authenticated
using (
  public.current_user_is_admin()
  or public.current_user_has_permission('conversations.view_all')
  or exists(
    select 1 from public.conversations c
    where c.id=conversation_id and c.assigned_to=auth.uid()
  )
);

grant select on public.staff_profiles,public.conversation_assignment_history to authenticated;
grant insert,update,delete on public.staff_profiles to authenticated;

create or replace function public.admin_save_collaborator(
  p_user_id uuid,
  p_job_title text,
  p_department text,
  p_permissions text[],
  p_active boolean default true
)
returns void
language plpgsql
security definer
set search_path=public
as $$
begin
  if not public.current_user_is_admin() then
    raise exception 'Administrator access required' using errcode='42501';
  end if;

  if p_department not in ('commercial','design','video','audio','web','support','finance','operations','custom') then
    raise exception 'Invalid department' using errcode='22023';
  end if;

  update public.profiles
  set role='staff'
  where id=p_user_id and role<>'admin';

  if not found and not exists(select 1 from public.profiles where id=p_user_id and role='admin') then
    raise exception 'User not found' using errcode='P0002';
  end if;

  insert into public.staff_profiles(user_id,job_title,department,permissions,active,updated_by,updated_at)
  values(
    p_user_id,
    coalesce(nullif(btrim(p_job_title),''),'Colaborador'),
    p_department,
    coalesce(p_permissions,'{}'::text[]),
    p_active,
    auth.uid(),
    now()
  )
  on conflict(user_id) do update set
    job_title=excluded.job_title,
    department=excluded.department,
    permissions=excluded.permissions,
    active=excluded.active,
    updated_by=excluded.updated_by,
    updated_at=now();
end;
$$;

revoke all on function public.admin_save_collaborator(uuid,text,text,text[],boolean) from public;
grant execute on function public.admin_save_collaborator(uuid,text,text,text[],boolean) to authenticated;

create or replace function public.assign_conversation(
  p_conversation_id uuid,
  p_assignee uuid,
  p_note text default null
)
returns void
language plpgsql
security definer
set search_path=public
as $$
declare
  previous_assignee uuid;
  assignee_name text;
begin
  if not (
    public.current_user_is_admin()
    or public.current_user_has_permission('conversations.transfer')
  ) then
    raise exception 'Conversation transfer permission required' using errcode='42501';
  end if;

  if p_assignee is not null and not exists(
    select 1
    from public.profiles p
    left join public.staff_profiles sp on sp.user_id=p.id
    where p.id=p_assignee
      and p.status='active'
      and (
        p.role='admin'
        or (p.role='staff' and coalesce(sp.active,false))
      )
  ) then
    raise exception 'Invalid collaborator' using errcode='22023';
  end if;

  select assigned_to into previous_assignee
  from public.conversations
  where id=p_conversation_id
  for update;

  if not found then
    raise exception 'Conversation not found' using errcode='P0002';
  end if;

  update public.conversations
  set assigned_to=p_assignee,
      assigned_by=auth.uid(),
      assigned_at=case when p_assignee is null then null else now() end,
      updated_at=now()
  where id=p_conversation_id;

  insert into public.conversation_assignment_history(
    conversation_id,from_user_id,to_user_id,transferred_by,note
  )
  values(p_conversation_id,previous_assignee,p_assignee,auth.uid(),nullif(btrim(coalesce(p_note,'')),''));

  if p_assignee is not null and p_assignee<>auth.uid() then
    select trim(coalesce(first_name,'')||' '||coalesce(last_name,'')) into assignee_name
    from public.profiles where id=p_assignee;

    insert into public.notifications(user_id,type,title,message,link,metadata)
    values(
      p_assignee,
      'conversation_assigned',
      'Atendimento direcionado',
      'Uma conversa foi direcionada para você.',
      '/admin/conversas',
      jsonb_build_object('conversation_id',p_conversation_id,'assigned_to',p_assignee)
    );
  end if;
end;
$$;

revoke all on function public.assign_conversation(uuid,uuid,text) from public;
grant execute on function public.assign_conversation(uuid,uuid,text) to authenticated;

create or replace function public.update_conversation_crm(
  p_conversation_id uuid,
  p_status text default null,
  p_priority text default null,
  p_tags text[] default null
)
returns void
language plpgsql
security definer
set search_path=public
as $$
begin
  if not (
    public.current_user_is_admin()
    or public.current_user_has_permission('conversations.manage')
    or exists(
      select 1 from public.conversations
      where id=p_conversation_id and assigned_to=auth.uid()
    )
  ) then
    raise exception 'Conversation management permission required' using errcode='42501';
  end if;

  if p_status is not null and p_status not in ('open','pending','resolved') then
    raise exception 'Invalid conversation status' using errcode='22023';
  end if;
  if p_priority is not null and p_priority not in ('low','normal','high','urgent') then
    raise exception 'Invalid conversation priority' using errcode='22023';
  end if;

  update public.conversations
  set
    status=coalesce(p_status,status),
    priority=coalesce(p_priority,priority),
    tags=coalesce(p_tags,tags),
    updated_at=now()
  where id=p_conversation_id;
end;
$$;

revoke all on function public.update_conversation_crm(uuid,text,text,text[]) from public;
grant execute on function public.update_conversation_crm(uuid,text,text,text[]) to authenticated;

-- Conversations: admin sees all; collaborators see all only with permission,
-- otherwise they see conversations explicitly assigned to them.
drop policy if exists conversations_read on public.conversations;
create policy conversations_read
on public.conversations for select to authenticated
using (
  (customer_id=auth.uid() and public.current_user_is_active_customer())
  or public.current_user_is_admin()
  or public.current_user_has_permission('conversations.view_all')
  or (
    assigned_to=auth.uid()
    and public.current_user_has_permission('conversations.access')
  )
);

-- Catalog access.
drop policy if exists "categories_public_read" on public.product_categories;
create policy "categories_public_read"
on public.product_categories for select to anon,authenticated
using (
  active=true
  or public.current_user_is_admin()
  or public.current_user_has_permission('catalog.view')
  or public.current_user_has_permission('catalog.manage')
);

drop policy if exists "categories_admin_insert" on public.product_categories;
create policy "categories_admin_insert"
on public.product_categories for insert to authenticated
with check (public.current_user_is_admin() or public.current_user_has_permission('catalog.manage'));

drop policy if exists "categories_admin_update" on public.product_categories;
create policy "categories_admin_update"
on public.product_categories for update to authenticated
using (public.current_user_is_admin() or public.current_user_has_permission('catalog.manage'))
with check (public.current_user_is_admin() or public.current_user_has_permission('catalog.manage'));

drop policy if exists "categories_admin_delete" on public.product_categories;
create policy "categories_admin_delete"
on public.product_categories for delete to authenticated
using (public.current_user_is_admin() or public.current_user_has_permission('catalog.manage'));

drop policy if exists "products_public_read" on public.products;
create policy "products_public_read"
on public.products for select to anon,authenticated
using (
  (active=true and status='published')
  or public.current_user_is_admin()
  or public.current_user_has_permission('catalog.view')
  or public.current_user_has_permission('catalog.manage')
);

drop policy if exists "products_admin_insert" on public.products;
create policy "products_admin_insert"
on public.products for insert to authenticated
with check (public.current_user_is_admin() or public.current_user_has_permission('catalog.manage'));

drop policy if exists "products_admin_update" on public.products;
create policy "products_admin_update"
on public.products for update to authenticated
using (public.current_user_is_admin() or public.current_user_has_permission('catalog.manage'))
with check (public.current_user_is_admin() or public.current_user_has_permission('catalog.manage'));

drop policy if exists "products_admin_delete" on public.products;
create policy "products_admin_delete"
on public.products for delete to authenticated
using (public.current_user_is_admin() or public.current_user_has_permission('catalog.manage'));

drop policy if exists "product_images_public_read" on public.product_images;
create policy "product_images_public_read"
on public.product_images for select to anon,authenticated
using (
  exists(
    select 1 from public.products p
    where p.id=product_images.product_id
      and (
        (p.active=true and p.status='published')
        or public.current_user_is_admin()
        or public.current_user_has_permission('catalog.view')
        or public.current_user_has_permission('catalog.manage')
      )
  )
);

drop policy if exists "product_images_admin_insert" on public.product_images;
create policy "product_images_admin_insert"
on public.product_images for insert to authenticated
with check (public.current_user_is_admin() or public.current_user_has_permission('catalog.manage'));

drop policy if exists "product_images_admin_update" on public.product_images;
create policy "product_images_admin_update"
on public.product_images for update to authenticated
using (public.current_user_is_admin() or public.current_user_has_permission('catalog.manage'))
with check (public.current_user_is_admin() or public.current_user_has_permission('catalog.manage'));

drop policy if exists "product_images_admin_delete" on public.product_images;
create policy "product_images_admin_delete"
on public.product_images for delete to authenticated
using (public.current_user_is_admin() or public.current_user_has_permission('catalog.manage'));

drop policy if exists services_staff_all on public.services;
create policy services_staff_all
on public.services for all to authenticated
using (public.current_user_is_admin() or public.current_user_has_permission('catalog.manage'))
with check (public.current_user_is_admin() or public.current_user_has_permission('catalog.manage'));

-- Sales and quotes.
drop policy if exists orders_read on public.orders;
create policy orders_read
on public.orders for select to authenticated
using (
  customer_id=auth.uid()
  or public.current_user_is_admin()
  or public.current_user_has_permission('sales.view')
  or public.current_user_has_permission('sales.manage')
);

drop policy if exists orders_staff_write on public.orders;
create policy orders_staff_write
on public.orders for update to authenticated
using (public.current_user_is_admin() or public.current_user_has_permission('sales.manage'))
with check (public.current_user_is_admin() or public.current_user_has_permission('sales.manage'));

drop policy if exists order_items_read on public.order_items;
create policy order_items_read
on public.order_items for select to authenticated
using (
  exists(
    select 1 from public.orders o
    where o.id=order_id
      and (
        o.customer_id=auth.uid()
        or public.current_user_is_admin()
        or public.current_user_has_permission('sales.view')
        or public.current_user_has_permission('sales.manage')
      )
  )
);

drop policy if exists order_items_staff_write on public.order_items;
create policy order_items_staff_write
on public.order_items for all to authenticated
using (public.current_user_is_admin() or public.current_user_has_permission('sales.manage'))
with check (public.current_user_is_admin() or public.current_user_has_permission('sales.manage'));

drop policy if exists quotes_read on public.quotes;
create policy quotes_read
on public.quotes for select to authenticated
using (
  customer_id=auth.uid()
  or public.current_user_is_admin()
  or public.current_user_has_permission('quotes.view')
  or public.current_user_has_permission('quotes.manage')
);

drop policy if exists quotes_staff_write on public.quotes;
create policy quotes_staff_write
on public.quotes for all to authenticated
using (public.current_user_is_admin() or public.current_user_has_permission('quotes.manage'))
with check (public.current_user_is_admin() or public.current_user_has_permission('quotes.manage'));

drop policy if exists quote_items_read on public.quote_items;
create policy quote_items_read
on public.quote_items for select to authenticated
using (
  exists(
    select 1 from public.quotes q
    where q.id=quote_id
      and (
        q.customer_id=auth.uid()
        or public.current_user_is_admin()
        or public.current_user_has_permission('quotes.view')
        or public.current_user_has_permission('quotes.manage')
      )
  )
);

drop policy if exists quote_items_staff_write on public.quote_items;
create policy quote_items_staff_write
on public.quote_items for all to authenticated
using (public.current_user_is_admin() or public.current_user_has_permission('quotes.manage'))
with check (public.current_user_is_admin() or public.current_user_has_permission('quotes.manage'));

-- Project and file access for production collaborators.
drop policy if exists projects_read on public.projects;
create policy projects_read
on public.projects for select to authenticated
using (
  customer_id=auth.uid()
  or public.current_user_is_admin()
  or public.current_user_has_permission('projects.view')
  or public.current_user_has_permission('projects.manage')
);

drop policy if exists projects_staff_write on public.projects;
create policy projects_staff_write
on public.projects for all to authenticated
using (public.current_user_is_admin() or public.current_user_has_permission('projects.manage'))
with check (public.current_user_is_admin() or public.current_user_has_permission('projects.manage'));

drop policy if exists client_files_read on public.client_files;
create policy client_files_read
on public.client_files for select to authenticated
using (
  (customer_id=auth.uid() and client_visible)
  or public.current_user_is_admin()
  or public.current_user_has_permission('files.view')
  or public.current_user_has_permission('files.manage')
);

drop policy if exists client_files_staff_write on public.client_files;
create policy client_files_staff_write
on public.client_files for all to authenticated
using (public.current_user_is_admin() or public.current_user_has_permission('files.manage'))
with check (public.current_user_is_admin() or public.current_user_has_permission('files.manage'));

-- Payment access.
drop policy if exists payments_read on public.payments;
create policy payments_read
on public.payments for select to authenticated
using (
  customer_id=auth.uid()
  or public.current_user_is_admin()
  or public.current_user_has_permission('payments.view')
  or public.current_user_has_permission('payments.manage')
);

drop policy if exists payments_staff_write on public.payments;
create policy payments_staff_write
on public.payments for all to authenticated
using (public.current_user_is_admin() or public.current_user_has_permission('payments.manage'))
with check (public.current_user_is_admin() or public.current_user_has_permission('payments.manage'));

-- Keep unread counts aligned with CRM assignment rules.
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
      (c.customer_id=auth.uid() and public.current_user_is_active_customer())
      or public.current_user_is_admin()
      or public.current_user_has_permission('conversations.view_all')
      or (
        c.assigned_to=auth.uid()
        and public.current_user_has_permission('conversations.access')
      )
    );
$$;

-- Notify the responsible collaborator instead of every staff member.
create or replace function public.notify_new_message()
returns trigger
language plpgsql
security definer
set search_path=public
as $$
declare
  cid uuid;
  sender_role text;
  assignee uuid;
begin
  select customer_id,assigned_to into cid,assignee
  from public.conversations where id=new.conversation_id;

  select role into sender_role
  from public.profiles where id=new.sender_id;

  update public.conversations set updated_at=now() where id=new.conversation_id;

  if sender_role='customer' then
    insert into public.notifications(user_id,type,title,message,link,metadata)
      select distinct p.id,'new_message','Nova mensagem','Um cliente enviou uma nova mensagem.',
        '/admin/conversas',jsonb_build_object('conversation_id',new.conversation_id)
      from public.profiles p
      left join public.staff_profiles sp on sp.user_id=p.id
      where p.status='active'
        and (
          p.role='admin'
          or p.id=assignee
          or (
            assignee is null
            and p.role='staff'
            and sp.active
            and ('*'=any(sp.permissions) or 'conversations.view_all'=any(sp.permissions))
          )
        );
  elsif cid is not null then
    insert into public.notifications(user_id,type,title,message,link,metadata)
    values(
      cid,'new_message','Nova mensagem','A equipe Play Moments enviou uma nova mensagem.',
      '/app/conversas',jsonb_build_object('conversation_id',new.conversation_id)
    );
  end if;

  return new;
end;
$$;
