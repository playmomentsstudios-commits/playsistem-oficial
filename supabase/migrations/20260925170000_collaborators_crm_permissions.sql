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


-- Keep project submodules aligned with project permissions.
drop policy if exists project_stages_read on public.project_stages;
create policy project_stages_read
on public.project_stages for select to authenticated
using (
  public.current_user_is_admin()
  or public.current_user_has_permission('projects.view')
  or public.current_user_has_permission('projects.manage')
  or (
    client_visible
    and exists(select 1 from public.projects p where p.id=project_id and p.customer_id=auth.uid())
  )
);

drop policy if exists project_stages_staff_write on public.project_stages;
create policy project_stages_staff_write
on public.project_stages for all to authenticated
using (public.current_user_is_admin() or public.current_user_has_permission('projects.manage'))
with check (public.current_user_is_admin() or public.current_user_has_permission('projects.manage'));

drop policy if exists tasks_read on public.tasks;
create policy tasks_read
on public.tasks for select to authenticated
using (
  public.current_user_is_admin()
  or public.current_user_has_permission('projects.view')
  or public.current_user_has_permission('projects.manage')
  or (
    client_visible
    and exists(select 1 from public.projects p where p.id=project_id and p.customer_id=auth.uid())
  )
);

drop policy if exists tasks_staff_write on public.tasks;
create policy tasks_staff_write
on public.tasks for all to authenticated
using (public.current_user_is_admin() or public.current_user_has_permission('projects.manage'))
with check (public.current_user_is_admin() or public.current_user_has_permission('projects.manage'));

drop policy if exists checklist_staff_write on public.task_checklist_items;
create policy checklist_staff_write
on public.task_checklist_items for all to authenticated
using (public.current_user_is_admin() or public.current_user_has_permission('projects.manage'))
with check (public.current_user_is_admin() or public.current_user_has_permission('projects.manage'));

drop policy if exists task_links_staff_write on public.task_links;
create policy task_links_staff_write
on public.task_links for all to authenticated
using (public.current_user_is_admin() or public.current_user_has_permission('projects.manage'))
with check (public.current_user_is_admin() or public.current_user_has_permission('projects.manage'));

-- Payment receipt access follows finance permissions.
drop policy if exists payment_receipts_read on public.payment_receipts;
create policy payment_receipts_read
on public.payment_receipts for select to authenticated
using (
  customer_id=auth.uid()
  or public.current_user_is_admin()
  or public.current_user_has_permission('payments.view')
  or public.current_user_has_permission('payments.manage')
);

drop policy if exists payment_receipts_staff_update on public.payment_receipts;
create policy payment_receipts_staff_update
on public.payment_receipts for update to authenticated
using (public.current_user_is_admin() or public.current_user_has_permission('payments.manage'))
with check (public.current_user_is_admin() or public.current_user_has_permission('payments.manage'));

-- Storage access must follow the same module permissions.
drop policy if exists client_file_objects_staff on storage.objects;
create policy client_file_objects_staff
on storage.objects for all to authenticated
using (
  bucket_id='client-files'
  and (public.current_user_is_admin() or public.current_user_has_permission('files.manage'))
)
with check (
  bucket_id='client-files'
  and (public.current_user_is_admin() or public.current_user_has_permission('files.manage'))
);

drop policy if exists product_image_objects_staff_insert on storage.objects;
create policy product_image_objects_staff_insert
on storage.objects for insert to authenticated
with check (
  bucket_id='product-images'
  and (public.current_user_is_admin() or public.current_user_has_permission('catalog.manage'))
);

drop policy if exists product_image_objects_staff_update on storage.objects;
create policy product_image_objects_staff_update
on storage.objects for update to authenticated
using (
  bucket_id='product-images'
  and (public.current_user_is_admin() or public.current_user_has_permission('catalog.manage'))
)
with check (
  bucket_id='product-images'
  and (public.current_user_is_admin() or public.current_user_has_permission('catalog.manage'))
);

drop policy if exists product_image_objects_staff_delete on storage.objects;
create policy product_image_objects_staff_delete
on storage.objects for delete to authenticated
using (
  bucket_id='product-images'
  and (public.current_user_is_admin() or public.current_user_has_permission('catalog.manage'))
);

-- Per-user read state obeys the same CRM assignment model.
drop policy if exists conversation_reads_own on public.conversation_reads;
create policy conversation_reads_own
on public.conversation_reads
for all to authenticated
using (user_id=auth.uid())
with check (
  user_id=auth.uid()
  and exists(
    select 1 from public.conversations c
    where c.id=conversation_id
      and (
        (c.customer_id=auth.uid() and public.current_user_is_active_customer())
        or public.current_user_is_admin()
        or public.current_user_has_permission('conversations.view_all')
        or (
          c.assigned_to=auth.uid()
          and public.current_user_has_permission('conversations.access')
        )
      )
  )
);

create or replace function public.mark_conversation_read_v2(p_conversation_id uuid)
returns void
language plpgsql
security definer
set search_path=public
as $$
begin
  if not exists(
    select 1
    from public.conversations c
    where c.id=p_conversation_id
      and (
        (c.customer_id=auth.uid() and public.current_user_is_active_customer())
        or public.current_user_is_admin()
        or public.current_user_has_permission('conversations.view_all')
        or (
          c.assigned_to=auth.uid()
          and public.current_user_has_permission('conversations.access')
        )
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

-- When a collaborator is removed from staff, disable the collaborator profile too.
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
begin
  select role into caller_role
  from public.profiles
  where id=auth.uid() and status='active';

  if caller_role<>'admin' then
    raise exception 'Administrator access required' using errcode='42501';
  end if;

  if p_role not in ('customer','staff','admin') then
    raise exception 'Invalid role' using errcode='22023';
  end if;

  if p_user_id=auth.uid() and p_role<>'admin' then
    raise exception 'You cannot remove your own administrator role' using errcode='22023';
  end if;

  update public.profiles set role=p_role where id=p_user_id;
  if not found then raise exception 'User not found' using errcode='P0002'; end if;

  if p_role='customer' then
    update public.staff_profiles set active=false,updated_by=auth.uid(),updated_at=now()
    where user_id=p_user_id;
  elsif p_role='staff' then
    insert into public.staff_profiles(user_id,job_title,department,permissions,active,updated_by)
    values(p_user_id,'Colaborador','custom','{}'::text[],true,auth.uid())
    on conflict(user_id) do update set active=true,updated_by=auth.uid(),updated_at=now();
  end if;
end;
$$;


-- Security-definer operations must respect collaborator permissions too.
create or replace function public.admin_set_customer_status(
  p_customer_id uuid,
  p_status text,
  p_reason_code text default null
)
returns void
language plpgsql
security definer
set search_path=public
as $$
declare
  previous_status text;
begin
  if not (
    public.current_user_is_admin()
    or public.current_user_has_permission('customers.manage')
  ) then
    raise exception 'Customer management permission required' using errcode='42501';
  end if;

  if p_status not in ('active','inactive','blocked') then
    raise exception 'Invalid customer status' using errcode='22023';
  end if;

  if p_status<>'active' and p_reason_code not in (
    'payment_pending','information_incomplete','terms_violation','prolonged_inactivity',
    'customer_request','security_review','platform_misuse','commercial_relationship_ended','administrative_other'
  ) then
    raise exception 'A standardized reason is required' using errcode='22023';
  end if;

  select status into previous_status
  from public.profiles
  where id=p_customer_id and role='customer'
  for update;

  if not found then raise exception 'Customer not found' using errcode='P0002'; end if;

  update public.profiles
  set status=p_status,
      status_reason_code=case when p_status='active' then null else p_reason_code end,
      status_changed_at=now(),
      status_changed_by=auth.uid()
  where id=p_customer_id;

  insert into public.customer_status_history(
    customer_id,previous_status,new_status,reason_code,changed_by
  )
  values(
    p_customer_id,previous_status,p_status,
    case when p_status='active' then null else p_reason_code end,
    auth.uid()
  );
end;
$$;

create or replace function public.set_product_cover(p_product_id uuid,p_image_id uuid)
returns void
language plpgsql
security definer
set search_path=public
as $$
begin
  if not (
    public.current_user_is_admin()
    or public.current_user_has_permission('catalog.manage')
  ) then
    raise exception 'Catalog management permission required' using errcode='42501';
  end if;

  if not exists(
    select 1 from public.product_images
    where id=p_image_id and product_id=p_product_id
  ) then
    raise exception 'Image not found for product' using errcode='P0002';
  end if;

  update public.product_images set is_cover=false where product_id=p_product_id;
  update public.product_images set is_cover=true where id=p_image_id;
end;
$$;

create or replace function public.review_payment_receipt(
  p_receipt_id uuid,
  p_status text,
  p_note text default null
)
returns void
language plpgsql
security definer
set search_path=public
as $$
declare
  r public.payment_receipts%rowtype;
begin
  if not (
    public.current_user_is_admin()
    or public.current_user_has_permission('payments.manage')
  ) then
    raise exception 'Payment management permission required' using errcode='42501';
  end if;

  if p_status not in ('approved','rejected') then
    raise exception 'Invalid status' using errcode='22023';
  end if;

  update public.payment_receipts
  set status=p_status,admin_note=p_note,reviewed_at=now(),reviewed_by=auth.uid()
  where id=p_receipt_id
  returning * into r;

  if not found then raise exception 'Receipt not found'; end if;

  if p_status='approved' then
    update public.payments set status='paid',paid_at=now() where id=r.payment_id;
    update public.orders
    set payment_status='paid',
        status=case when status='awaiting_payment' then 'paid' else status end
    where id=(select order_id from public.payments where id=r.payment_id);

    insert into public.notifications(user_id,type,title,message,link)
    values(r.customer_id,'payment_confirmed','Pagamento recebido','Seu comprovante foi aprovado e o pagamento foi confirmado.','/app/pagamentos');
  else
    update public.payments set status='rejected' where id=r.payment_id;
    insert into public.notifications(user_id,type,title,message,link)
    values(r.customer_id,'payment_rejected','Comprovante precisa de revisão',coalesce(p_note,'Envie um novo comprovante para análise.'),'/app/pagamentos');
  end if;
end;
$$;

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
  if not (
    public.current_user_is_admin()
    or (
      public.current_user_has_permission('quotes.manage')
      and public.current_user_has_permission('sales.manage')
    )
  ) then
    raise exception 'Commercial management permission required' using errcode='42501';
  end if;

  select * into q from public.quotes where id=p_quote_id for update;
  if not found then raise exception 'Quote not found' using errcode='P0002'; end if;
  if q.status<>'accepted' then raise exception 'Only accepted quotes can be converted' using errcode='22023'; end if;

  if q.converted_order_id is not null then
    return jsonb_build_object(
      'order_id',q.converted_order_id,
      'project_id',q.converted_project_id,
      'already_converted',true
    );
  end if;

  insert into public.orders(customer_id,status,payment_status,subtotal,total,notes)
  values(q.customer_id,'awaiting_payment','pending',q.subtotal,q.total,'Gerado a partir do orçamento '||q.quote_number)
  returning id into order_uuid;

  insert into public.order_items(order_id,item_type,name_snapshot,quantity,unit_price,total_price)
  select order_uuid,'service',description,quantity,unit_price,total_price
  from public.quote_items where quote_id=q.id;

  if q.total>0 then
    insert into public.payments(customer_id,order_id,quote_id,amount,method,status,provider)
    values(q.customer_id,order_uuid,q.id,q.total,'pix_manual','pending','manual');
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
  set converted_order_id=order_uuid,converted_project_id=project_uuid
  where id=q.id;

  insert into public.notifications(user_id,type,title,message,link,metadata)
  values(
    q.customer_id,'quote_converted','Orçamento convertido em pedido',
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


-- Remaining administrative content follows module permissions.
drop policy if exists payment_settings_staff_write on public.payment_settings;
create policy payment_settings_staff_write
on public.payment_settings for all to authenticated
using (public.current_user_is_admin() or public.current_user_has_permission('payments.manage'))
with check (public.current_user_is_admin() or public.current_user_has_permission('payments.manage'));

drop policy if exists loyalty_settings_staff_write on public.loyalty_settings;
create policy loyalty_settings_staff_write
on public.loyalty_settings for all to authenticated
using (public.current_user_is_admin() or public.current_user_has_permission('payments.manage'))
with check (public.current_user_is_admin() or public.current_user_has_permission('payments.manage'));

drop policy if exists customer_status_history_staff_read on public.customer_status_history;
create policy customer_status_history_staff_read
on public.customer_status_history for select to authenticated
using (
  public.current_user_is_admin()
  or public.current_user_has_permission('customers.view')
  or public.current_user_has_permission('customers.manage')
);

drop policy if exists announcements_staff_write on public.announcements;
create policy announcements_staff_write
on public.announcements for all to authenticated
using (public.current_user_is_admin() or public.current_user_has_permission('community.manage'))
with check (public.current_user_is_admin() or public.current_user_has_permission('community.manage'));

drop policy if exists "staff manage site profile" on public.site_profile;
create policy "staff manage site profile"
on public.site_profile for all to authenticated
using (public.current_user_is_admin() or public.current_user_has_permission('site.manage'))
with check (public.current_user_is_admin() or public.current_user_has_permission('site.manage'));

drop policy if exists "staff manage portfolio categories" on public.portfolio_categories;
create policy "staff manage portfolio categories"
on public.portfolio_categories for all to authenticated
using (public.current_user_is_admin() or public.current_user_has_permission('site.manage'))
with check (public.current_user_is_admin() or public.current_user_has_permission('site.manage'));

drop policy if exists "staff manage portfolio items" on public.portfolio_items;
create policy "staff manage portfolio items"
on public.portfolio_items for all to authenticated
using (public.current_user_is_admin() or public.current_user_has_permission('site.manage'))
with check (public.current_user_is_admin() or public.current_user_has_permission('site.manage'));

drop policy if exists "staff insert site assets" on storage.objects;
create policy "staff insert site assets"
on storage.objects for insert to authenticated
with check (
  bucket_id='site-assets'
  and (public.current_user_is_admin() or public.current_user_has_permission('site.manage'))
);

drop policy if exists "staff update site assets" on storage.objects;
create policy "staff update site assets"
on storage.objects for update to authenticated
using (
  bucket_id='site-assets'
  and (public.current_user_is_admin() or public.current_user_has_permission('site.manage'))
)
with check (
  bucket_id='site-assets'
  and (public.current_user_is_admin() or public.current_user_has_permission('site.manage'))
);

drop policy if exists "staff delete site assets" on storage.objects;
create policy "staff delete site assets"
on storage.objects for delete to authenticated
using (
  bucket_id='site-assets'
  and (public.current_user_is_admin() or public.current_user_has_permission('site.manage'))
);
