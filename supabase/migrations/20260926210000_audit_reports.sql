-- Operational audit trail and reporting RPC.

create table if not exists public.audit_logs (
  id uuid primary key default gen_random_uuid(),
  actor_user_id uuid references public.profiles(id) on delete set null,
  actor_role text,
  action text not null check(action in ('insert','update','delete')),
  table_name text not null,
  record_id text,
  old_data jsonb,
  new_data jsonb,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create index if not exists audit_logs_created_at_idx on public.audit_logs(created_at desc);
create index if not exists audit_logs_actor_idx on public.audit_logs(actor_user_id,created_at desc);
create index if not exists audit_logs_table_idx on public.audit_logs(table_name,created_at desc);

alter table public.audit_logs enable row level security;

drop policy if exists audit_logs_admin_read on public.audit_logs;
create policy audit_logs_admin_read
on public.audit_logs for select to authenticated
using (public.current_user_is_admin());

grant select on public.audit_logs to authenticated;

create or replace function public.capture_audit_log()
returns trigger
language plpgsql
security definer
set search_path=public
as $$
declare
  actor uuid:=auth.uid();
  role_name text;
  row_old jsonb;
  row_new jsonb;
  record text;
begin
  if actor is not null then
    select role into role_name from public.profiles where id=actor;
  else
    role_name:='system';
  end if;

  if tg_op='INSERT' then
    row_new:=to_jsonb(new);
    record:=coalesce(row_new->>'id',row_new->>'customer_id',row_new->>'user_id');
  elsif tg_op='UPDATE' then
    row_old:=to_jsonb(old);
    row_new:=to_jsonb(new);
    if row_old=row_new then return new; end if;
    record:=coalesce(row_new->>'id',row_new->>'customer_id',row_new->>'user_id');
  elsif tg_op='DELETE' then
    row_old:=to_jsonb(old);
    record:=coalesce(row_old->>'id',row_old->>'customer_id',row_old->>'user_id');
  end if;

  insert into public.audit_logs(
    actor_user_id,actor_role,action,table_name,record_id,old_data,new_data
  )
  values(
    actor,coalesce(role_name,'unknown'),lower(tg_op),tg_table_name,record,row_old,row_new
  );

  if tg_op='DELETE' then return old; end if;
  return new;
end;
$$;

do $$
declare
  t text;
begin
  foreach t in array array[
    'products',
    'orders',
    'quotes',
    'payments',
    'projects',
    'tasks',
    'client_files',
    'staff_profiles',
    'customer_crm',
    'conversations'
  ] loop
    execute format('drop trigger if exists %I_audit_log on public.%I',t,t);
    execute format(
      'create trigger %I_audit_log after insert or update or delete on public.%I for each row execute function public.capture_audit_log()',
      t,t
    );
  end loop;
end $$;

create or replace function public.operational_report(
  p_start_date date,
  p_end_date date
)
returns jsonb
language plpgsql
security definer
set search_path=public
as $$
declare
  start_ts timestamptz:=p_start_date::timestamptz;
  end_ts timestamptz:=(p_end_date+1)::timestamptz;
  result jsonb;
begin
  if p_start_date is null or p_end_date is null or p_end_date<p_start_date then
    raise exception 'Invalid report period' using errcode='22023';
  end if;

  if not (
    public.current_user_is_admin()
    or public.current_user_has_permission('reports.view')
  ) then
    raise exception 'Reports permission required' using errcode='42501';
  end if;

  select jsonb_build_object(
    'summary',jsonb_build_object(
      'new_customers',(
        select count(*) from public.profiles
        where role='customer' and created_at>=start_ts and created_at<end_ts
      ),
      'orders',(
        select count(*) from public.orders
        where created_at>=start_ts and created_at<end_ts
      ),
      'orders_total',coalesce((
        select sum(total) from public.orders
        where created_at>=start_ts and created_at<end_ts and status<>'cancelled'
      ),0),
      'paid_revenue',coalesce((
        select sum(amount) from public.payments
        where status='paid' and coalesce(paid_at,updated_at)>=start_ts and coalesce(paid_at,updated_at)<end_ts
      ),0),
      'pending_revenue',coalesce((
        select sum(amount) from public.payments
        where status in ('pending','awaiting_confirmation') and created_at<end_ts
      ),0),
      'quotes',(
        select count(*) from public.quotes
        where created_at>=start_ts and created_at<end_ts
      ),
      'accepted_quotes',(
        select count(*) from public.quotes
        where status='accepted' and updated_at>=start_ts and updated_at<end_ts
      ),
      'projects_completed',(
        select count(*) from public.projects
        where status='completed' and updated_at>=start_ts and updated_at<end_ts
      ),
      'projects_overdue',(
        select count(*) from public.projects
        where due_date is not null and due_date<p_end_date and status not in ('completed','cancelled')
      ),
      'tasks_completed',(
        select count(*) from public.tasks
        where status='completed' and coalesce(completed_at,updated_at)>=start_ts and coalesce(completed_at,updated_at)<end_ts
      ),
      'tasks_overdue',(
        select count(*) from public.tasks
        where due_date is not null and due_date<p_end_date and status not in ('completed','cancelled')
      ),
      'avg_order_ticket',coalesce((
        select avg(total)::bigint from public.orders
        where created_at>=start_ts and created_at<end_ts and status<>'cancelled'
      ),0)
    ),
    'sales_by_month',coalesce((
      select jsonb_agg(row_to_json(x) order by x.month)
      from (
        select
          to_char(date_trunc('month',created_at),'YYYY-MM') as month,
          count(*)::int as orders,
          coalesce(sum(total),0)::bigint as total
        from public.orders
        where created_at>=start_ts and created_at<end_ts and status<>'cancelled'
        group by 1
      ) x
    ),'[]'::jsonb),
    'top_items',coalesce((
      select jsonb_agg(row_to_json(x) order by x.total desc)
      from (
        select
          oi.name_snapshot as name,
          sum(oi.quantity)::int as quantity,
          sum(oi.total_price)::bigint as total
        from public.order_items oi
        join public.orders o on o.id=oi.order_id
        where o.created_at>=start_ts and o.created_at<end_ts and o.status<>'cancelled'
        group by oi.name_snapshot
        order by total desc
        limit 10
      ) x
    ),'[]'::jsonb),
    'project_statuses',coalesce((
      select jsonb_agg(row_to_json(x))
      from (
        select status,count(*)::int as count
        from public.projects
        where created_at<end_ts
        group by status
        order by status
      ) x
    ),'[]'::jsonb),
    'task_productivity',coalesce((
      select jsonb_agg(row_to_json(x) order by x.completed desc,x.assignee)
      from (
        select
          coalesce(nullif(trim(coalesce(p.first_name,'')||' '||coalesce(p.last_name,'')),''),p.email,'Sem responsável') as assignee,
          count(*) filter(where t.status='completed' and coalesce(t.completed_at,t.updated_at)>=start_ts and coalesce(t.completed_at,t.updated_at)<end_ts)::int as completed,
          count(*) filter(where t.due_date is not null and t.due_date<p_end_date and t.status not in ('completed','cancelled'))::int as overdue
        from public.tasks t
        left join public.profiles p on p.id=t.assigned_to
        where t.created_at<end_ts
        group by p.id,p.first_name,p.last_name,p.email
      ) x
    ),'[]'::jsonb)
  ) into result;

  return result;
end;
$$;

revoke all on function public.operational_report(date,date) from public;
grant execute on function public.operational_report(date,date) to authenticated;
