-- Projetos e produtividade: visibilidade de links, histórico e notificações.
-- As migrations anteriores já estão aplicadas em produção.

alter table public.task_links
  add column if not exists client_visible boolean not null default false;

create table if not exists public.task_activity_logs (
  id uuid primary key default gen_random_uuid(),
  task_id uuid not null references public.tasks(id) on delete cascade,
  user_id uuid references public.profiles(id) on delete set null,
  action text not null,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

alter table public.task_activity_logs enable row level security;

drop policy if exists task_activity_staff_read on public.task_activity_logs;
create policy task_activity_staff_read
on public.task_activity_logs
for select
to authenticated
using (public.current_user_is_staff_or_admin());

drop policy if exists task_activity_staff_insert on public.task_activity_logs;
create policy task_activity_staff_insert
on public.task_activity_logs
for insert
to authenticated
with check (public.current_user_is_staff_or_admin());

grant select, insert on public.task_activity_logs to authenticated;

create index if not exists task_activity_task_created_idx
on public.task_activity_logs(task_id, created_at desc);

drop policy if exists task_links_read on public.task_links;
create policy task_links_read
on public.task_links
for select
to authenticated
using (
  public.current_user_is_staff_or_admin()
  or (
    client_visible
    and exists (
      select 1
      from public.tasks t
      join public.projects p on p.id = t.project_id
      where t.id = task_id
        and t.client_visible
        and p.customer_id = auth.uid()
    )
  )
);

create or replace function public.log_task_change()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if tg_op = 'INSERT' then
    insert into public.task_activity_logs(task_id,user_id,action,metadata)
    values(
      new.id,
      auth.uid(),
      'created',
      jsonb_build_object(
        'status', new.status,
        'priority', new.priority,
        'assigned_to', new.assigned_to
      )
    );
    return new;
  end if;

  if old.status is distinct from new.status then
    insert into public.task_activity_logs(task_id,user_id,action,metadata)
    values(
      new.id,
      auth.uid(),
      'status_changed',
      jsonb_build_object('from',old.status,'to',new.status)
    );
  end if;

  if old.assigned_to is distinct from new.assigned_to then
    insert into public.task_activity_logs(task_id,user_id,action,metadata)
    values(
      new.id,
      auth.uid(),
      'assignee_changed',
      jsonb_build_object('from',old.assigned_to,'to',new.assigned_to)
    );
  end if;

  if old.due_date is distinct from new.due_date then
    insert into public.task_activity_logs(task_id,user_id,action,metadata)
    values(
      new.id,
      auth.uid(),
      'due_date_changed',
      jsonb_build_object('from',old.due_date,'to',new.due_date)
    );
  end if;

  return new;
end;
$$;

drop trigger if exists tasks_activity_log on public.tasks;
create trigger tasks_activity_log
after insert or update on public.tasks
for each row execute function public.log_task_change();

create or replace function public.notify_project_stage_change()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  customer_uuid uuid;
  project_title text;
begin
  if new.client_visible and (
    tg_op = 'INSERT'
    or old.status is distinct from new.status
    or old.name is distinct from new.name
  ) then
    select customer_id,title
    into customer_uuid,project_title
    from public.projects
    where id = new.project_id;

    if customer_uuid is not null then
      insert into public.notifications(user_id,type,title,message,link,metadata)
      values(
        customer_uuid,
        'project_stage',
        'Etapa do projeto atualizada',
        'A etapa "' || new.name || '" do projeto "' || project_title || '" foi atualizada.',
        '/app/projetos/' || new.project_id::text,
        jsonb_build_object(
          'project_id',new.project_id,
          'stage_id',new.id,
          'status',new.status
        )
      );
    end if;
  end if;

  return new;
end;
$$;

drop trigger if exists project_stages_notify_change on public.project_stages;
create trigger project_stages_notify_change
after insert or update on public.project_stages
for each row execute function public.notify_project_stage_change();
