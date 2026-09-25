-- Play Moments operational portal: services, orders, quotes, projects, payments, files and notifications.
-- Apply after 20260925050000_chat_attachments.sql.

create sequence if not exists public.order_number_seq start 1;
create sequence if not exists public.quote_number_seq start 1;

create table if not exists public.services (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  slug text not null unique,
  short_description text,
  description text not null default '',
  category text,
  price_type text not null default 'quote' check (price_type in ('fixed','starting_at','quote')),
  price integer check (price is null or price >= 0),
  starting_price integer check (starting_price is null or starting_price >= 0),
  active boolean not null default true,
  featured boolean not null default false,
  status text not null default 'draft' check (status in ('draft','published','archived')),
  created_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.orders (
  id uuid primary key default gen_random_uuid(),
  order_number text not null unique default ('PM-' || lpad(nextval('public.order_number_seq')::text, 6, '0')),
  customer_id uuid not null references public.profiles(id) on delete restrict,
  status text not null default 'pending' check (status in ('pending','awaiting_payment','paid','processing','in_production','ready','completed','cancelled')),
  payment_status text not null default 'pending' check (payment_status in ('pending','awaiting_confirmation','paid','rejected','cancelled','refunded')),
  subtotal integer not null default 0 check (subtotal >= 0),
  total integer not null default 0 check (total >= 0),
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.order_items (
  id uuid primary key default gen_random_uuid(),
  order_id uuid not null references public.orders(id) on delete cascade,
  item_type text not null check (item_type in ('product','service','rental','other')),
  product_id uuid references public.products(id) on delete set null,
  service_id uuid references public.services(id) on delete set null,
  name_snapshot text not null,
  quantity integer not null default 1 check (quantity > 0),
  unit_price integer not null default 0 check (unit_price >= 0),
  total_price integer not null default 0 check (total_price >= 0),
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create table if not exists public.quotes (
  id uuid primary key default gen_random_uuid(),
  quote_number text not null unique default ('ORC-' || lpad(nextval('public.quote_number_seq')::text, 6, '0')),
  customer_id uuid not null references public.profiles(id) on delete restrict,
  title text not null,
  description text,
  status text not null default 'draft' check (status in ('draft','sent','viewed','accepted','rejected','expired')),
  valid_until date,
  subtotal integer not null default 0 check (subtotal >= 0),
  total integer not null default 0 check (total >= 0),
  notes text,
  created_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.quote_items (
  id uuid primary key default gen_random_uuid(),
  quote_id uuid not null references public.quotes(id) on delete cascade,
  description text not null,
  quantity integer not null default 1 check (quantity > 0),
  unit_price integer not null default 0 check (unit_price >= 0),
  total_price integer not null default 0 check (total_price >= 0),
  created_at timestamptz not null default now()
);

create table if not exists public.projects (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  description text,
  project_type text not null default 'other' check (project_type in ('internal','product','service','website','design','audiovisual','other')),
  customer_id uuid references public.profiles(id) on delete set null,
  product_id uuid references public.products(id) on delete set null,
  service_id uuid references public.services(id) on delete set null,
  order_id uuid references public.orders(id) on delete set null,
  quote_id uuid references public.quotes(id) on delete set null,
  status text not null default 'planning' check (status in ('planning','active','paused','review','completed','cancelled')),
  priority text not null default 'medium' check (priority in ('low','medium','high','urgent')),
  start_date date,
  due_date date,
  drive_folder_url text,
  created_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.project_stages (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references public.projects(id) on delete cascade,
  name text not null,
  description text,
  position integer not null default 0,
  status text not null default 'pending' check (status in ('pending','in_progress','completed')),
  client_visible boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.tasks (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references public.projects(id) on delete cascade,
  stage_id uuid references public.project_stages(id) on delete set null,
  title text not null,
  description text,
  status text not null default 'pending' check (status in ('pending','in_progress','review','completed','cancelled')),
  priority text not null default 'medium' check (priority in ('low','medium','high','urgent')),
  start_date date,
  due_date date,
  completed_at timestamptz,
  created_by uuid references public.profiles(id) on delete set null,
  assigned_to uuid references public.profiles(id) on delete set null,
  client_visible boolean not null default false,
  position integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.task_checklist_items (
  id uuid primary key default gen_random_uuid(),
  task_id uuid not null references public.tasks(id) on delete cascade,
  title text not null,
  completed boolean not null default false,
  position integer not null default 0,
  created_at timestamptz not null default now()
);

create table if not exists public.task_links (
  id uuid primary key default gen_random_uuid(),
  task_id uuid not null references public.tasks(id) on delete cascade,
  label text not null,
  url text not null,
  link_type text not null default 'other' check (link_type in ('drive','document','reference','other')),
  created_at timestamptz not null default now()
);

create table if not exists public.payments (
  id uuid primary key default gen_random_uuid(),
  customer_id uuid not null references public.profiles(id) on delete restrict,
  order_id uuid references public.orders(id) on delete set null,
  quote_id uuid references public.quotes(id) on delete set null,
  amount integer not null check (amount >= 0),
  method text not null default 'pix_manual' check (method in ('pix_manual','pix_gateway','card')),
  status text not null default 'pending' check (status in ('pending','awaiting_confirmation','paid','rejected','cancelled','refunded')),
  provider text not null default 'manual',
  provider_reference text,
  due_date date,
  paid_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.payment_settings (
  id boolean primary key default true check (id),
  pix_key_type text,
  pix_key text,
  beneficiary_name text,
  bank_name text,
  instructions text,
  updated_by uuid references public.profiles(id) on delete set null,
  updated_at timestamptz not null default now()
);
insert into public.payment_settings(id) values (true) on conflict (id) do nothing;

create table if not exists public.payment_receipts (
  id uuid primary key default gen_random_uuid(),
  payment_id uuid not null references public.payments(id) on delete cascade,
  customer_id uuid not null references public.profiles(id) on delete cascade,
  storage_path text not null,
  file_name text not null,
  mime_type text not null,
  status text not null default 'pending' check (status in ('pending','approved','rejected')),
  admin_note text,
  uploaded_at timestamptz not null default now(),
  reviewed_at timestamptz,
  reviewed_by uuid references public.profiles(id) on delete set null
);

create table if not exists public.client_files (
  id uuid primary key default gen_random_uuid(),
  customer_id uuid not null references public.profiles(id) on delete cascade,
  project_id uuid references public.projects(id) on delete set null,
  order_id uuid references public.orders(id) on delete set null,
  uploaded_by uuid references public.profiles(id) on delete set null,
  name text not null,
  storage_path text,
  external_url text,
  file_type text,
  client_visible boolean not null default true,
  created_at timestamptz not null default now(),
  check (storage_path is not null or external_url is not null)
);

create table if not exists public.notifications (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  type text not null,
  title text not null,
  message text not null,
  link text,
  read_at timestamptz,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create table if not exists public.announcements (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  content text not null,
  audience text not null default 'customers' check (audience in ('all','customers','staff')),
  active boolean not null default true,
  published_at timestamptz not null default now(),
  expires_at timestamptz,
  created_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now()
);

alter table public.conversations add column if not exists subject text;
alter table public.conversations add column if not exists status text not null default 'open';
alter table public.conversations add column if not exists updated_at timestamptz not null default now();
alter table public.messages add column if not exists read_at timestamptz;

create index if not exists orders_customer_idx on public.orders(customer_id, created_at desc);
create index if not exists quotes_customer_idx on public.quotes(customer_id, created_at desc);
create index if not exists projects_customer_idx on public.projects(customer_id, updated_at desc);
create index if not exists tasks_project_idx on public.tasks(project_id, status, due_date);
create index if not exists payments_customer_idx on public.payments(customer_id, created_at desc);
create index if not exists notifications_user_unread_idx on public.notifications(user_id, read_at, created_at desc);
create index if not exists client_files_customer_idx on public.client_files(customer_id, created_at desc);

create or replace function public.set_operational_updated_at()
returns trigger language plpgsql as $$
begin new.updated_at = now(); return new; end;
$$;

do $$ declare t text;
begin
  foreach t in array array['services','orders','quotes','projects','project_stages','tasks','payments'] loop
    execute format('drop trigger if exists %I_operational_updated_at on public.%I', t, t);
    execute format('create trigger %I_operational_updated_at before update on public.%I for each row execute function public.set_operational_updated_at()', t, t);
  end loop;
end $$;

alter table public.services enable row level security;
alter table public.orders enable row level security;
alter table public.order_items enable row level security;
alter table public.quotes enable row level security;
alter table public.quote_items enable row level security;
alter table public.projects enable row level security;
alter table public.project_stages enable row level security;
alter table public.tasks enable row level security;
alter table public.task_checklist_items enable row level security;
alter table public.task_links enable row level security;
alter table public.payments enable row level security;
alter table public.payment_settings enable row level security;
alter table public.payment_receipts enable row level security;
alter table public.client_files enable row level security;
alter table public.notifications enable row level security;
alter table public.announcements enable row level security;

-- Public catalog of services.
create policy services_public_read on public.services for select to anon, authenticated
using (active and status = 'published');
create policy services_staff_all on public.services for all to authenticated
using (public.current_user_is_staff_or_admin()) with check (public.current_user_is_staff_or_admin());

-- Customer-owned business data + staff access.
create policy orders_read on public.orders for select to authenticated
using (customer_id = auth.uid() or public.current_user_is_staff_or_admin());
create policy orders_customer_insert on public.orders for insert to authenticated
with check (customer_id = auth.uid() and exists (select 1 from public.profiles p where p.id=auth.uid() and p.role='customer' and p.status='active'));
create policy orders_staff_write on public.orders for update to authenticated
using (public.current_user_is_staff_or_admin()) with check (public.current_user_is_staff_or_admin());

create policy order_items_read on public.order_items for select to authenticated
using (exists (select 1 from public.orders o where o.id=order_id and (o.customer_id=auth.uid() or public.current_user_is_staff_or_admin())));
create policy order_items_customer_insert on public.order_items for insert to authenticated
with check (exists (select 1 from public.orders o where o.id=order_id and o.customer_id=auth.uid()));
create policy order_items_staff_write on public.order_items for all to authenticated
using (public.current_user_is_staff_or_admin()) with check (public.current_user_is_staff_or_admin());

create policy quotes_read on public.quotes for select to authenticated
using (customer_id=auth.uid() or public.current_user_is_staff_or_admin());
create policy quotes_customer_insert on public.quotes for insert to authenticated with check (customer_id=auth.uid());
create policy quotes_customer_decide on public.quotes for update to authenticated
using (customer_id=auth.uid() and status in ('sent','viewed'))
with check (customer_id=auth.uid() and status in ('accepted','rejected','viewed'));
create policy quotes_staff_write on public.quotes for all to authenticated
using (public.current_user_is_staff_or_admin()) with check (public.current_user_is_staff_or_admin());
create policy quote_items_read on public.quote_items for select to authenticated
using (exists (select 1 from public.quotes q where q.id=quote_id and (q.customer_id=auth.uid() or public.current_user_is_staff_or_admin())));
create policy quote_items_staff_write on public.quote_items for all to authenticated
using (public.current_user_is_staff_or_admin()) with check (public.current_user_is_staff_or_admin());

create policy projects_read on public.projects for select to authenticated
using (customer_id=auth.uid() or public.current_user_is_staff_or_admin());
create policy projects_staff_write on public.projects for all to authenticated
using (public.current_user_is_staff_or_admin()) with check (public.current_user_is_staff_or_admin());

create policy project_stages_read on public.project_stages for select to authenticated
using (public.current_user_is_staff_or_admin() or (client_visible and exists (select 1 from public.projects p where p.id=project_id and p.customer_id=auth.uid())));
create policy project_stages_staff_write on public.project_stages for all to authenticated
using (public.current_user_is_staff_or_admin()) with check (public.current_user_is_staff_or_admin());

create policy tasks_read on public.tasks for select to authenticated
using (public.current_user_is_staff_or_admin() or (client_visible and exists (select 1 from public.projects p where p.id=project_id and p.customer_id=auth.uid())));
create policy tasks_staff_write on public.tasks for all to authenticated
using (public.current_user_is_staff_or_admin()) with check (public.current_user_is_staff_or_admin());

create policy checklist_read on public.task_checklist_items for select to authenticated
using (exists (select 1 from public.tasks t where t.id=task_id));
create policy checklist_staff_write on public.task_checklist_items for all to authenticated
using (public.current_user_is_staff_or_admin()) with check (public.current_user_is_staff_or_admin());
create policy task_links_read on public.task_links for select to authenticated
using (exists (select 1 from public.tasks t where t.id=task_id));
create policy task_links_staff_write on public.task_links for all to authenticated
using (public.current_user_is_staff_or_admin()) with check (public.current_user_is_staff_or_admin());

create policy payments_read on public.payments for select to authenticated
using (customer_id=auth.uid() or public.current_user_is_staff_or_admin());
create policy payments_customer_insert on public.payments for insert to authenticated with check (customer_id=auth.uid());
create policy payments_staff_write on public.payments for all to authenticated
using (public.current_user_is_staff_or_admin()) with check (public.current_user_is_staff_or_admin());

create policy payment_settings_read on public.payment_settings for select to authenticated using (true);
create policy payment_settings_staff_write on public.payment_settings for all to authenticated
using (public.current_user_is_staff_or_admin()) with check (public.current_user_is_staff_or_admin());

create policy payment_receipts_read on public.payment_receipts for select to authenticated
using (customer_id=auth.uid() or public.current_user_is_staff_or_admin());
create policy payment_receipts_customer_insert on public.payment_receipts for insert to authenticated
with check (customer_id=auth.uid() and exists (select 1 from public.payments p where p.id=payment_id and p.customer_id=auth.uid()));
create policy payment_receipts_staff_update on public.payment_receipts for update to authenticated
using (public.current_user_is_staff_or_admin()) with check (public.current_user_is_staff_or_admin());

create policy client_files_read on public.client_files for select to authenticated
using (public.current_user_is_staff_or_admin() or (customer_id=auth.uid() and client_visible));
create policy client_files_staff_write on public.client_files for all to authenticated
using (public.current_user_is_staff_or_admin()) with check (public.current_user_is_staff_or_admin());

create policy notifications_own_read on public.notifications for select to authenticated using (user_id=auth.uid());
create policy notifications_own_update on public.notifications for update to authenticated
using (user_id=auth.uid()) with check (user_id=auth.uid());
create policy notifications_staff_insert on public.notifications for insert to authenticated
with check (public.current_user_is_staff_or_admin());

create policy announcements_customer_read on public.announcements for select to authenticated
using (active and (expires_at is null or expires_at > now()) and (
  public.current_user_is_staff_or_admin() or audience in ('all','customers')
));
create policy announcements_staff_write on public.announcements for all to authenticated
using (public.current_user_is_staff_or_admin()) with check (public.current_user_is_staff_or_admin());

grant select on public.services to anon, authenticated;
grant select, insert, update, delete on public.services to authenticated;
grant select, insert, update on public.orders, public.order_items, public.quotes, public.quote_items, public.projects, public.project_stages, public.tasks, public.task_checklist_items, public.task_links, public.payments, public.payment_settings, public.payment_receipts, public.client_files, public.notifications, public.announcements to authenticated;
grant delete on public.order_items, public.quote_items, public.project_stages, public.tasks, public.task_checklist_items, public.task_links, public.client_files, public.announcements to authenticated;
grant update (read_at) on public.messages to authenticated;

drop policy if exists messages_mark_read on public.messages;
create policy messages_mark_read on public.messages for update to authenticated
using (sender_id <> auth.uid() and exists (select 1 from public.conversations where id=conversation_id))
with check (sender_id <> auth.uid() and exists (select 1 from public.conversations where id=conversation_id));

-- Private receipt uploads and client delivery files.
insert into storage.buckets(id,name,public,file_size_limit)
values ('payment-receipts','payment-receipts',false,15728640),
       ('client-files','client-files',false,52428800)
on conflict (id) do update set public=false, file_size_limit=excluded.file_size_limit;

create policy payment_receipt_objects_insert on storage.objects for insert to authenticated
with check (bucket_id='payment-receipts' and split_part(name,'/',1)=auth.uid()::text);
create policy payment_receipt_objects_read on storage.objects for select to authenticated
using (bucket_id='payment-receipts' and (
  split_part(name,'/',1)=auth.uid()::text or public.current_user_is_staff_or_admin()
));
create policy client_file_objects_staff on storage.objects for all to authenticated
using (bucket_id='client-files' and public.current_user_is_staff_or_admin())
with check (bucket_id='client-files' and public.current_user_is_staff_or_admin());
create policy client_file_objects_customer_read on storage.objects for select to authenticated
using (bucket_id='client-files' and exists (
  select 1 from public.client_files f where f.storage_path=name and f.customer_id=auth.uid() and f.client_visible
));

-- Secure creation helpers for purchases and service requests.
create or replace function public.create_product_order(p_product_id uuid)
returns uuid language plpgsql security definer set search_path=public
as $$
declare p public.products%rowtype; oid uuid; amount integer;
begin
  if not exists (select 1 from public.profiles where id=auth.uid() and role='customer' and status='active') then
    raise exception 'Customer access required' using errcode='42501';
  end if;
  select * into p from public.products where id=p_product_id and active and status='published';
  if not found or p.commercial_mode not in ('sale','sale_and_rental') or p.sale_price is null then
    raise exception 'Product unavailable' using errcode='22023';
  end if;
  if p.stock <= 0 then raise exception 'Product out of stock' using errcode='22023'; end if;
  amount := coalesce(p.promotional_price,p.sale_price);
  insert into public.orders(customer_id,status,payment_status,subtotal,total)
  values(auth.uid(),'awaiting_payment','pending',amount,amount) returning id into oid;
  insert into public.order_items(order_id,item_type,product_id,name_snapshot,quantity,unit_price,total_price)
  values(oid,'product',p.id,p.name,1,amount,amount);
  insert into public.payments(customer_id,order_id,amount,method,status,provider)
  values(auth.uid(),oid,amount,'pix_manual','pending','manual');
  return oid;
end $$;
revoke all on function public.create_product_order(uuid) from public;
grant execute on function public.create_product_order(uuid) to authenticated;

create or replace function public.request_service(p_service_id uuid)
returns uuid language plpgsql security definer set search_path=public
as $$
declare s public.services%rowtype; result_id uuid; amount integer;
begin
  if not exists (select 1 from public.profiles where id=auth.uid() and role='customer' and status='active') then
    raise exception 'Customer access required' using errcode='42501';
  end if;
  select * into s from public.services where id=p_service_id and active and status='published';
  if not found then raise exception 'Service unavailable' using errcode='22023'; end if;
  if s.price_type='fixed' and s.price is not null then
    amount:=s.price;
    insert into public.orders(customer_id,status,payment_status,subtotal,total)
      values(auth.uid(),'awaiting_payment','pending',amount,amount) returning id into result_id;
    insert into public.order_items(order_id,item_type,service_id,name_snapshot,quantity,unit_price,total_price)
      values(result_id,'service',s.id,s.name,1,amount,amount);
    insert into public.payments(customer_id,order_id,amount,method,status,provider)
      values(auth.uid(),result_id,amount,'pix_manual','pending','manual');
  else
    insert into public.quotes(customer_id,title,description,status,created_by)
      values(auth.uid(),s.name,'Solicitação enviada pelo portal.','draft',auth.uid()) returning id into result_id;
  end if;
  return result_id;
end $$;
revoke all on function public.request_service(uuid) from public;
grant execute on function public.request_service(uuid) to authenticated;

create or replace function public.review_payment_receipt(p_receipt_id uuid, p_status text, p_note text default null)
returns void language plpgsql security definer set search_path=public
as $$
declare r public.payment_receipts%rowtype;
begin
  if not public.current_user_is_staff_or_admin() then raise exception 'Staff access required' using errcode='42501'; end if;
  if p_status not in ('approved','rejected') then raise exception 'Invalid status' using errcode='22023'; end if;
  update public.payment_receipts set status=p_status,admin_note=p_note,reviewed_at=now(),reviewed_by=auth.uid()
    where id=p_receipt_id returning * into r;
  if not found then raise exception 'Receipt not found'; end if;
  if p_status='approved' then
    update public.payments set status='paid',paid_at=now() where id=r.payment_id;
    update public.orders set payment_status='paid',status=case when status='awaiting_payment' then 'paid' else status end
      where id=(select order_id from public.payments where id=r.payment_id);
    insert into public.notifications(user_id,type,title,message,link)
      values(r.customer_id,'payment_confirmed','Pagamento recebido','Seu comprovante foi aprovado e o pagamento foi confirmado.','/app/pagamentos');
  else
    update public.payments set status='rejected' where id=r.payment_id;
    insert into public.notifications(user_id,type,title,message,link)
      values(r.customer_id,'payment_rejected','Comprovante precisa de revisão',coalesce(p_note,'Envie um novo comprovante para análise.'),'/app/pagamentos');
  end if;
end $$;
revoke all on function public.review_payment_receipt(uuid,text,text) from public;
grant execute on function public.review_payment_receipt(uuid,text,text) to authenticated;

-- Message notifications + unread support.
create or replace function public.notify_new_message()
returns trigger language plpgsql security definer set search_path=public
as $$
declare cid uuid; sender_role text;
begin
  select customer_id into cid from public.conversations where id=new.conversation_id;
  select role into sender_role from public.profiles where id=new.sender_id;
  update public.conversations set updated_at=now() where id=new.conversation_id;
  if sender_role='customer' then
    insert into public.notifications(user_id,type,title,message,link,metadata)
      select id,'new_message','Nova mensagem','Um cliente enviou uma nova mensagem.','/admin/conversas',jsonb_build_object('conversation_id',new.conversation_id)
      from public.profiles where role in ('admin','staff') and status='active';
  elsif cid is not null then
    insert into public.notifications(user_id,type,title,message,link,metadata)
      values(cid,'new_message','Nova mensagem','A equipe Play Moments enviou uma nova mensagem.','/app/conversas',jsonb_build_object('conversation_id',new.conversation_id));
  end if;
  return new;
end $$;
drop trigger if exists messages_notify on public.messages;
create trigger messages_notify after insert on public.messages for each row execute function public.notify_new_message();

create or replace function public.notify_payment_receipt()
returns trigger language plpgsql security definer set search_path=public
as $$
begin
  update public.payments set status='awaiting_confirmation' where id=new.payment_id;
  insert into public.notifications(user_id,type,title,message,link,metadata)
    select id,'payment_receipt','Novo comprovante','Um cliente enviou comprovante de pagamento.','/admin/pagamentos',jsonb_build_object('payment_id',new.payment_id)
    from public.profiles where role in ('admin','staff') and status='active';
  return new;
end $$;
drop trigger if exists payment_receipts_notify on public.payment_receipts;
create trigger payment_receipts_notify after insert on public.payment_receipts for each row execute function public.notify_payment_receipt();

-- Realtime delivery for the main communication tables.
do $$ begin
  alter publication supabase_realtime add table public.messages;
exception when duplicate_object then null; end $$;
do $$ begin
  alter publication supabase_realtime add table public.notifications;
exception when duplicate_object then null; end $$;
do $$ begin
  alter publication supabase_realtime add table public.projects;
exception when duplicate_object then null; end $$;

-- Harden customer writes: purchases/requests use SECURITY DEFINER helpers instead of raw inserts.
drop policy if exists orders_customer_insert on public.orders;
drop policy if exists order_items_customer_insert on public.order_items;
drop policy if exists quotes_customer_insert on public.quotes;
drop policy if exists quotes_customer_decide on public.quotes;
drop policy if exists payments_customer_insert on public.payments;

-- Customers may only mark their own notifications as read, not rewrite notification contents.
revoke update on public.notifications from authenticated;
grant update (read_at) on public.notifications to authenticated;

create or replace function public.decide_quote(p_quote_id uuid, p_status text)
returns void language plpgsql security definer set search_path=public
as $$
begin
  if p_status not in ('accepted','rejected') then
    raise exception 'Invalid quote decision' using errcode='22023';
  end if;
  update public.quotes
    set status=p_status
  where id=p_quote_id
    and customer_id=auth.uid()
    and status in ('sent','viewed');
  if not found then
    raise exception 'Quote not available' using errcode='42501';
  end if;
  insert into public.notifications(user_id,type,title,message,link,metadata)
    select id,'quote_decision','Orçamento respondido',
      case when p_status='accepted' then 'O cliente aceitou um orçamento.' else 'O cliente recusou um orçamento.' end,
      '/admin/orcamentos',jsonb_build_object('quote_id',p_quote_id,'status',p_status)
    from public.profiles
    where role in ('admin','staff') and status='active';
end $$;
revoke all on function public.decide_quote(uuid,text) from public;
grant execute on function public.decide_quote(uuid,text) to authenticated;
