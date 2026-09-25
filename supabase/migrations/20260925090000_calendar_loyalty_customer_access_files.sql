-- Calendário, arquivos por tarefa, caminho do cliente, Play Cash e controle de acesso.
-- Aplicar somente depois das migrations já existentes até 20260925080000.

alter table public.client_files
  add column if not exists task_id uuid references public.tasks(id) on delete set null;

create index if not exists client_files_project_task_idx
  on public.client_files(project_id, task_id, created_at desc);

create or replace function public.validate_client_file_task()
returns trigger
language plpgsql
set search_path=public
as $$
declare task_project uuid;
begin
  if new.task_id is null then
    return new;
  end if;

  select project_id into task_project
  from public.tasks
  where id=new.task_id;

  if task_project is null then
    raise exception 'Task not found' using errcode='23503';
  end if;

  if new.project_id is null then
    new.project_id := task_project;
  elsif new.project_id <> task_project then
    raise exception 'Task does not belong to selected project' using errcode='23514';
  end if;

  return new;
end;
$$;

drop trigger if exists client_files_validate_task on public.client_files;
create trigger client_files_validate_task
before insert or update of task_id, project_id
on public.client_files
for each row execute function public.validate_client_file_task();

alter table public.profiles
  add column if not exists status_reason_code text,
  add column if not exists status_changed_at timestamptz,
  add column if not exists status_changed_by uuid references public.profiles(id) on delete set null;

create table if not exists public.customer_status_history (
  id uuid primary key default gen_random_uuid(),
  customer_id uuid not null references public.profiles(id) on delete cascade,
  previous_status text,
  new_status text not null,
  reason_code text,
  changed_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now()
);

alter table public.customer_status_history enable row level security;

drop policy if exists customer_status_history_staff_read on public.customer_status_history;
create policy customer_status_history_staff_read
on public.customer_status_history
for select to authenticated
using (public.current_user_is_staff_or_admin());

grant select on public.customer_status_history to authenticated;

create or replace function public.current_user_is_active_customer()
returns boolean
language sql
stable
security definer
set search_path=public
as $$
  select exists (
    select 1 from public.profiles
    where id=auth.uid()
      and role='customer'
      and status='active'
  );
$$;

revoke all on function public.current_user_is_active_customer() from public;
grant execute on function public.current_user_is_active_customer() to authenticated;

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
  if not public.current_user_is_staff_or_admin() then
    raise exception 'Staff access required' using errcode='42501';
  end if;

  if p_status not in ('active','inactive','blocked') then
    raise exception 'Invalid customer status' using errcode='22023';
  end if;

  if p_status <> 'active' and p_reason_code not in (
    'payment_pending',
    'information_incomplete',
    'terms_violation',
    'prolonged_inactivity',
    'customer_request',
    'security_review',
    'platform_misuse',
    'commercial_relationship_ended',
    'administrative_other'
  ) then
    raise exception 'A standardized reason is required' using errcode='22023';
  end if;

  select status into previous_status
  from public.profiles
  where id=p_customer_id and role='customer'
  for update;

  if not found then
    raise exception 'Customer not found' using errcode='P0002';
  end if;

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

revoke all on function public.admin_set_customer_status(uuid,text,text) from public;
grant execute on function public.admin_set_customer_status(uuid,text,text) to authenticated;

-- Bloqueia acesso operacional de clientes inativos mesmo se ainda houver sessão JWT válida.
drop policy if exists orders_read on public.orders;
create policy orders_read on public.orders for select to authenticated
using (
  public.current_user_is_staff_or_admin()
  or (customer_id=auth.uid() and public.current_user_is_active_customer())
);

drop policy if exists quotes_read on public.quotes;
create policy quotes_read on public.quotes for select to authenticated
using (
  public.current_user_is_staff_or_admin()
  or (customer_id=auth.uid() and public.current_user_is_active_customer())
);

drop policy if exists projects_read on public.projects;
create policy projects_read on public.projects for select to authenticated
using (
  public.current_user_is_staff_or_admin()
  or (customer_id=auth.uid() and public.current_user_is_active_customer())
);

drop policy if exists project_stages_read on public.project_stages;
create policy project_stages_read on public.project_stages for select to authenticated
using (
  public.current_user_is_staff_or_admin()
  or (
    public.current_user_is_active_customer()
    and client_visible
    and exists (
      select 1 from public.projects p
      where p.id=project_id and p.customer_id=auth.uid()
    )
  )
);

drop policy if exists tasks_read on public.tasks;
create policy tasks_read on public.tasks for select to authenticated
using (
  public.current_user_is_staff_or_admin()
  or (
    public.current_user_is_active_customer()
    and client_visible
    and exists (
      select 1 from public.projects p
      where p.id=project_id and p.customer_id=auth.uid()
    )
  )
);

drop policy if exists checklist_read on public.task_checklist_items;
create policy checklist_read on public.task_checklist_items for select to authenticated
using (
  public.current_user_is_staff_or_admin()
  or (
    public.current_user_is_active_customer()
    and exists (
      select 1
      from public.tasks t
      join public.projects p on p.id=t.project_id
      where t.id=task_id
        and t.client_visible
        and p.customer_id=auth.uid()
    )
  )
);

drop policy if exists task_links_read on public.task_links;
create policy task_links_read on public.task_links for select to authenticated
using (
  public.current_user_is_staff_or_admin()
  or (
    public.current_user_is_active_customer()
    and client_visible
    and exists (
      select 1
      from public.tasks t
      join public.projects p on p.id=t.project_id
      where t.id=task_id
        and t.client_visible
        and p.customer_id=auth.uid()
    )
  )
);

drop policy if exists payments_read on public.payments;
create policy payments_read on public.payments for select to authenticated
using (
  public.current_user_is_staff_or_admin()
  or (customer_id=auth.uid() and public.current_user_is_active_customer())
);

drop policy if exists payment_receipts_read on public.payment_receipts;
create policy payment_receipts_read on public.payment_receipts for select to authenticated
using (
  public.current_user_is_staff_or_admin()
  or (customer_id=auth.uid() and public.current_user_is_active_customer())
);

drop policy if exists client_files_read on public.client_files;
create policy client_files_read on public.client_files for select to authenticated
using (
  public.current_user_is_staff_or_admin()
  or (
    customer_id=auth.uid()
    and client_visible
    and public.current_user_is_active_customer()
  )
);

drop policy if exists notifications_own_read on public.notifications;
create policy notifications_own_read on public.notifications for select to authenticated
using (
  user_id=auth.uid()
  and (
    public.current_user_is_active_customer()
    or public.current_user_is_staff_or_admin()
  )
);

drop policy if exists client_file_objects_customer_read on storage.objects;
create policy client_file_objects_customer_read on storage.objects for select to authenticated
using (
  bucket_id='client-files'
  and public.current_user_is_active_customer()
  and exists (
    select 1 from public.client_files f
    where f.storage_path=name
      and f.customer_id=auth.uid()
      and f.client_visible
  )
);

-- Play Cash: 5% por padrão (R$ 0,50 a cada R$ 10,00 em serviços pagos).
create table if not exists public.loyalty_settings (
  id boolean primary key default true check (id),
  cashback_basis_points integer not null default 500
    check (cashback_basis_points between 0 and 10000),
  silver_threshold integer,
  gold_threshold integer,
  updated_by uuid references public.profiles(id) on delete set null,
  updated_at timestamptz not null default now(),
  check (silver_threshold is null or silver_threshold >= 0),
  check (gold_threshold is null or gold_threshold >= 0),
  check (gold_threshold is null or silver_threshold is null or gold_threshold > silver_threshold)
);

insert into public.loyalty_settings(id)
values(true)
on conflict (id) do nothing;

create table if not exists public.customer_loyalty (
  customer_id uuid primary key references public.profiles(id) on delete cascade,
  level text not null default 'bronze' check (level in ('bronze','silver','gold')),
  lifetime_service_spend integer not null default 0,
  generated_cash integer not null default 0,
  unlocked_cash integer not null default 0,
  used_cash integer not null default 0,
  updated_at timestamptz not null default now(),
  check (lifetime_service_spend >= 0),
  check (generated_cash >= 0),
  check (unlocked_cash >= 0),
  check (used_cash >= 0)
);

alter table public.loyalty_settings enable row level security;
alter table public.customer_loyalty enable row level security;

drop policy if exists loyalty_settings_read on public.loyalty_settings;
create policy loyalty_settings_read
on public.loyalty_settings
for select to authenticated
using (true);

drop policy if exists loyalty_settings_staff_write on public.loyalty_settings;
create policy loyalty_settings_staff_write
on public.loyalty_settings
for update to authenticated
using (public.current_user_is_staff_or_admin())
with check (public.current_user_is_staff_or_admin());

drop policy if exists customer_loyalty_read on public.customer_loyalty;
create policy customer_loyalty_read
on public.customer_loyalty
for select to authenticated
using (
  public.current_user_is_staff_or_admin()
  or (
    customer_id=auth.uid()
    and public.current_user_is_active_customer()
  )
);

grant select on public.loyalty_settings, public.customer_loyalty to authenticated;
grant update (
  cashback_basis_points,
  silver_threshold,
  gold_threshold,
  updated_by,
  updated_at
) on public.loyalty_settings to authenticated;

create or replace function public.recalculate_customer_loyalty(p_customer_id uuid)
returns void
language plpgsql
security definer
set search_path=public
as $$
declare
  spend_cents integer := 0;
  generated_cents integer := 0;
  unlocked_cents integer := 0;
  current_level text := 'bronze';
  cfg public.loyalty_settings%rowtype;
  existing_used integer := 0;
begin
  select * into cfg from public.loyalty_settings where id=true;

  select coalesce(sum(oi.total_price),0)::integer
  into spend_cents
  from public.orders o
  join public.order_items oi on oi.order_id=o.id
  where o.customer_id=p_customer_id
    and o.payment_status='paid'
    and oi.item_type='service';

  generated_cents := floor(spend_cents::numeric * cfg.cashback_basis_points / 10000)::integer;

  if cfg.gold_threshold is not null and spend_cents >= cfg.gold_threshold then
    current_level := 'gold';
    unlocked_cents := generated_cents;
  elsif cfg.silver_threshold is not null and spend_cents >= cfg.silver_threshold then
    current_level := 'silver';
    unlocked_cents := floor(cfg.silver_threshold::numeric * cfg.cashback_basis_points / 10000)::integer;
  else
    current_level := 'bronze';
    unlocked_cents := 0;
  end if;

  select coalesce(used_cash,0)
  into existing_used
  from public.customer_loyalty
  where customer_id=p_customer_id;

  existing_used := least(coalesce(existing_used,0), unlocked_cents);

  insert into public.customer_loyalty(
    customer_id,level,lifetime_service_spend,generated_cash,unlocked_cash,used_cash,updated_at
  )
  values(
    p_customer_id,current_level,spend_cents,generated_cents,unlocked_cents,existing_used,now()
  )
  on conflict (customer_id) do update set
    level=excluded.level,
    lifetime_service_spend=excluded.lifetime_service_spend,
    generated_cash=excluded.generated_cash,
    unlocked_cash=excluded.unlocked_cash,
    used_cash=least(public.customer_loyalty.used_cash,excluded.unlocked_cash),
    updated_at=now();
end;
$$;

revoke all on function public.recalculate_customer_loyalty(uuid) from public;

create or replace function public.refresh_order_customer_loyalty()
returns trigger
language plpgsql
security definer
set search_path=public
as $$
begin
  perform public.recalculate_customer_loyalty(new.customer_id);
  return new;
end;
$$;

drop trigger if exists orders_refresh_loyalty on public.orders;
create trigger orders_refresh_loyalty
after insert or update of payment_status
on public.orders
for each row execute function public.refresh_order_customer_loyalty();

create or replace function public.refresh_all_customer_loyalty()
returns trigger
language plpgsql
security definer
set search_path=public
as $$
declare customer_record record;
begin
  for customer_record in
    select id from public.profiles where role='customer'
  loop
    perform public.recalculate_customer_loyalty(customer_record.id);
  end loop;
  return new;
end;
$$;

drop trigger if exists loyalty_settings_refresh_all on public.loyalty_settings;
create trigger loyalty_settings_refresh_all
after update of cashback_basis_points, silver_threshold, gold_threshold
on public.loyalty_settings
for each row execute function public.refresh_all_customer_loyalty();

insert into public.customer_loyalty(customer_id)
select id
from public.profiles
where role='customer'
on conflict (customer_id) do nothing;

do $$
declare customer_record record;
begin
  for customer_record in
    select id from public.profiles where role='customer'
  loop
    perform public.recalculate_customer_loyalty(customer_record.id);
  end loop;
end;
$$;
