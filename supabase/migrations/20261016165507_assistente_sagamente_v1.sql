-- Assistente Sagamente v1 — eventos internos e resumos agendáveis.
-- Esta migração é aditiva. Não altera a Central WhatsApp, as compras nem os fluxos da RKC.
-- Desligado por padrão: nenhum evento é capturado/enviado até habilitação explícita.
create table if not exists public.sagamente_assistant_settings (
  id boolean primary key default true check (id),
  enabled boolean not null default false,
  internal_notifications boolean not null default true,
  whatsapp_notifications boolean not null default false,
  timezone text not null default 'America/Sao_Paulo',
  digest_times text[] not null default '{}'::text[],
  updated_at timestamptz not null default now(),
  constraint valid_digest_times check (
    array_position(digest_times,null) is null
    and array_to_string(digest_times, ',') ~ '^([01][0-9]|2[0-3]):[0-5][0-9](,([01][0-9]|2[0-3]):[0-5][0-9])*$'
    or cardinality(digest_times) = 0
  )
);
insert into public.sagamente_assistant_settings (id) values (true)
on conflict (id) do nothing;

create table if not exists public.sagamente_assistant_events (
  id uuid primary key default gen_random_uuid(),
  event_key text not null unique,
  event_type text not null,
  source_table text not null,
  source_id uuid,
  title text not null,
  message text not null,
  target_link text not null default '/admin',
  status text not null default 'pending'
    check (status in ('pending','internal_sent')),
  created_at timestamptz not null default now(),
  processed_at timestamptz
);
create index if not exists sagamente_assistant_pending_idx
  on public.sagamente_assistant_events(created_at)
  where processed_at is null;

alter table public.sagamente_assistant_settings enable row level security;
alter table public.sagamente_assistant_events enable row level security;
revoke all on public.sagamente_assistant_settings from anon;
revoke all on public.sagamente_assistant_events from anon;
revoke all on public.sagamente_assistant_events from authenticated;

create policy "sagamente_assistant_settings_admin_select"
on public.sagamente_assistant_settings for select to authenticated
using (exists (select 1 from public.profiles p where p.id = (select auth.uid()) and p.role = 'admin'));
create policy "sagamente_assistant_settings_admin_update"
on public.sagamente_assistant_settings for update to authenticated
using (exists (select 1 from public.profiles p where p.id = (select auth.uid()) and p.role = 'admin'))
with check (exists (select 1 from public.profiles p where p.id = (select auth.uid()) and p.role = 'admin'));
create policy "sagamente_assistant_events_admin_select"
on public.sagamente_assistant_events for select to authenticated
using (exists (select 1 from public.profiles p where p.id = (select auth.uid()) and p.role = 'admin'));
grant select, update on public.sagamente_assistant_settings to authenticated;
grant select on public.sagamente_assistant_events to authenticated;

create or replace function public.sagamente_assistant_capture()
returns trigger language plpgsql security definer set search_path = public, pg_temp as $$
declare
  v_event_type text;
  v_title text;
  v_message text;
  v_source_id uuid;
begin
  if not exists (
    select 1 from public.sagamente_assistant_settings
    where id = true and enabled = true
  ) then
    return new;
  end if;

  v_source_id := new.id;
  if tg_table_name = 'profiles' then
    if tg_op = 'INSERT' and new.role = 'customer' then
      v_event_type := 'customer_registered';
      v_title := 'Novo cadastro de cliente';
      v_message := 'Um novo cliente foi cadastrado na Sagamente.';
    elsif tg_op = 'UPDATE' and new.role = 'customer'
      and old.status is distinct from new.status then
      v_event_type := 'customer_status';
      v_title := 'Cadastro atualizado';
      v_message := 'Status do cadastro alterado para: ' || new.status;
    end if;
  elsif tg_table_name = 'tasks' then
    if tg_op = 'INSERT' then
      v_event_type := 'task_created';
      v_title := 'Nova tarefa no Play Sistem';
      v_message := 'Tarefa cadastrada: ' || left(new.title, 200);
    elsif old.status is distinct from new.status then
      v_event_type := 'task_status';
      v_title := 'Status de tarefa atualizado';
      v_message := left(new.title, 160) || ' — ' || new.status;
    end if;
  elsif tg_table_name = 'task_checklist_items' then
    if (tg_op = 'UPDATE' and old.completed is distinct from new.completed)
      or (tg_op = 'INSERT' and new.completed = true) then
      v_event_type := 'checklist_updated';
      v_title := 'Checklist atualizado';
      v_message := left(new.title, 160) || case when new.completed then ' — concluído' else ' — reaberto' end;
    end if;
  elsif tg_table_name = 'project_stages' then
    if tg_op = 'UPDATE' and old.status is distinct from new.status then
      v_event_type := 'project_stage_status';
      v_title := 'Etapa do projeto atualizada';
      v_message := left(new.name, 160) || ' — ' || new.status;
    end if;
  elsif tg_table_name = 'academy_work_purchases' then
    if (tg_op = 'UPDATE' and old.status is distinct from new.status)
       or tg_op = 'INSERT' then
      if new.status in ('paid', 'fulfilled') then
        v_event_type := 'academy_purchase_' || new.status;
        v_title := 'Compra na Academia';
        v_message := 'Pedido confirmado com status: ' || new.status;
      end if;
    end if;
  elsif tg_table_name = 'academy_library_grants' then
    if tg_op = 'INSERT' and new.active = true then
      v_event_type := 'academy_access_granted';
      v_title := 'Acesso liberado na Academia';
      v_message := 'Um acesso ao acervo foi liberado.';
    end if;
  end if;

  if v_event_type is not null then
    insert into public.sagamente_assistant_events
      (event_key, event_type, source_table, source_id, title, message)
    values (
      'sagamente:' || tg_table_name || ':' || v_source_id::text || ':' || v_event_type
        || ':' || txid_current()::text,
      v_event_type, tg_table_name, v_source_id, v_title, v_message
    )
    on conflict (event_key) do nothing;
  end if;
  return new;
end;
$$;
revoke all on function public.sagamente_assistant_capture() from public;

create trigger sagamente_assistant_profiles
after insert or update on public.profiles
for each row execute function public.sagamente_assistant_capture();
create trigger sagamente_assistant_tasks
after insert or update on public.tasks
for each row execute function public.sagamente_assistant_capture();
create trigger sagamente_assistant_checklists
after insert or update on public.task_checklist_items
for each row execute function public.sagamente_assistant_capture();
create trigger sagamente_assistant_project_stages
after update on public.project_stages
for each row execute function public.sagamente_assistant_capture();
create trigger sagamente_assistant_academy_purchases
after insert or update on public.academy_work_purchases
for each row execute function public.sagamente_assistant_capture();
create trigger sagamente_assistant_academy_grants
after insert on public.academy_library_grants
for each row execute function public.sagamente_assistant_capture();

-- Ponto de execução único para futuros cron jobs. Somente gera avisos internos.
-- Não envia WhatsApp, não move tarefas e não altera cadastros ou compras.
create or replace function public.sagamente_assistant_tick()
returns jsonb language plpgsql security definer set search_path = public, pg_temp as $$
declare
  cfg public.sagamente_assistant_settings%rowtype;
  event_row record;
  admin_row record;
  v_now_local timestamp;
  v_time text;
  v_key text;
  v_processed integer := 0;
  v_recipients integer;
  v_tasks_pending integer;
  v_tasks_overdue integer;
  v_tasks_in_progress integer;
begin
  select * into cfg from public.sagamente_assistant_settings where id = true;
  if not found or not cfg.enabled then
    return jsonb_build_object('status','disabled','internal_sent',0);
  end if;

  v_now_local := now() at time zone cfg.timezone;
  v_time := to_char(v_now_local, 'HH24:MI');
  if v_time = any(cfg.digest_times) then
    v_key := 'sagamente:digest:' || to_char(v_now_local,'YYYY-MM-DD') || ':' || v_time;
    select count(*) into v_tasks_pending from public.tasks where status='pending';
    select count(*) into v_tasks_in_progress from public.tasks where status='in_progress';
    select count(*) into v_tasks_overdue from public.tasks
      where status not in ('completed','cancelled') and due_date < v_now_local::date;
    insert into public.sagamente_assistant_events
      (event_key,event_type,source_table,title,message)
    values (
      v_key,'daily_digest','tasks','Resumo diário — Sagamente',
      format('Pendentes: %s | Em andamento: %s | Atrasadas: %s',
             v_tasks_pending,v_tasks_in_progress,v_tasks_overdue)
    )
    on conflict (event_key) do nothing;
  end if;

  if not cfg.internal_notifications then
    return jsonb_build_object('status','internal_paused','internal_sent',0);
  end if;

  for event_row in
    select id,title,message,target_link,event_type
    from public.sagamente_assistant_events
    where processed_at is null
    order by created_at,id
    limit 50 for update skip locked
  loop
    v_recipients := 0;
    for admin_row in select id from public.profiles where role='admin' and status='active'
    loop
      insert into public.notifications(id,user_id,type,title,message,link,metadata)
      values (gen_random_uuid(),admin_row.id,'system',event_row.title,
              event_row.message,event_row.target_link,
              jsonb_build_object('source','assistente_sagamente',
                                 'assistant_event_id',event_row.id,
                                 'event_type',event_row.event_type));
      v_recipients := v_recipients + 1;
    end loop;
    if v_recipients > 0 then
      update public.sagamente_assistant_events
      set processed_at=now(),status='internal_sent' where id=event_row.id;
      v_processed := v_processed + 1;
    end if;
  end loop;
  return jsonb_build_object('status','ok','internal_sent',v_processed);
end;
$$;
revoke all on function public.sagamente_assistant_tick() from public, anon, authenticated;
grant execute on function public.sagamente_assistant_tick() to service_role;

-- Agendar SOMENTE após configurar horários e habilitar o assistente, por exemplo:
-- SELECT cron.schedule('sagamente-assistant-minute', '* * * * *',
--                      $$select public.sagamente_assistant_tick();$$);
