-- Custo zero: alertas prioritarios somente no inbox/Push interno.
-- WhatsApp e apenas um link manual; nenhum gateway ou remetente automatico.
alter table public.app_settings
 add column if not exists priority_alerts_enabled boolean not null default true,
 add column if not exists priority_daily_limit integer not null default 10,
 add column if not exists priority_payment_confirmed boolean not null default true,
 add column if not exists priority_project_created boolean not null default true,
 add column if not exists priority_project_completed boolean not null default true,
 add column if not exists priority_whatsapp_phone text not null default '5564981294186',
 add column if not exists priority_whatsapp_mode text not null default 'manual';

do $
begin
 if not exists(select 1 from pg_constraint where conname='priority_alert_daily_limit_valid' and conrelid='public.app_settings'::regclass) then
  alter table public.app_settings add constraint priority_alert_daily_limit_valid check (priority_daily_limit between 0 and 10);
 end if;
 if not exists(select 1 from pg_constraint where conname='priority_alert_phone_valid' and conrelid='public.app_settings'::regclass) then
  alter table public.app_settings add constraint priority_alert_phone_valid check (priority_whatsapp_phone ~ '^55[0-9]{10,11}

create table if not exists public.priority_alert_log (
 event_key text primary key,
 event_type text not null check (event_type in ('payment_confirmed','project_created','project_completed')),
 record_id uuid not null,
 admin_user_id uuid not null references public.profiles(id) on delete cascade,
 title text not null,
 message text not null,
 link text not null,
 created_at timestamptz not null default now()
);
create index if not exists priority_alert_log_created_at_idx on public.priority_alert_log(created_at desc);
alter table public.priority_alert_log enable row level security;
revoke all on public.priority_alert_log from anon,authenticated;
grant select on public.priority_alert_log to authenticated;
drop policy if exists priority_alert_log_admin_read on public.priority_alert_log;
create policy priority_alert_log_admin_read on public.priority_alert_log
 for select to authenticated using (public.current_user_is_admin());

create or replace function public.emit_zero_cost_priority_alert(
 p_key text,p_event text,p_record_id uuid,p_title text,p_message text,p_link text
) returns void language plpgsql security definer set search_path = '' as $$
declare
 cfg public.app_settings%rowtype;
 v_admin uuid;
 v_today_count integer;
begin
 -- Serializa os eventos concorrentes; nao duplica nem ultrapassa o teto diario.
 select * into cfg from public.app_settings where id=true for update;
 if not found or not cfg.priority_alerts_enabled or cfg.priority_daily_limit=0 then return; end if;
 if p_event='payment_confirmed' and (not cfg.priority_payment_confirmed or not cfg.commercial_notifications) then return; end if;
 if p_event='project_created' and not cfg.priority_project_created then return; end if;
 if p_event='project_completed' and not cfg.priority_project_completed then return; end if;
 if not cfg.internal_operation_notifications then return; end if;
 if exists (select 1 from public.priority_alert_log where event_key=p_key) then return; end if;
 select count(*) into v_today_count from public.priority_alert_log
  where (created_at at time zone 'America/Sao_Paulo')::date=(now() at time zone 'America/Sao_Paulo')::date;
 if v_today_count>=cfg.priority_daily_limit then return; end if;
 select id into v_admin from public.profiles
  where role='admin' and status='active'
  order by created_at,id limit 1;
 if v_admin is null then return; end if;
 insert into public.priority_alert_log(event_key,event_type,record_id,admin_user_id,title,message,link)
 values(p_key,p_event,p_record_id,v_admin,p_title,p_message,p_link)
 on conflict (event_key) do nothing;
 if not found then return; end if;
 insert into public.notifications(user_id,type,title,message,link,metadata)
 values(v_admin,
   case p_event when 'payment_confirmed' then 'payment_confirmed_priority'
        when 'project_created' then 'project_created_priority'
        else 'project_completed_priority' end,
   p_title,p_message,p_link,
   jsonb_build_object('priority',true,'event_type',p_event,'record_id',p_record_id));
 -- O trigger de notifications existente coloca no Push quando inscrito.
end;
$$;
revoke all on function public.emit_zero_cost_priority_alert(text,text,uuid,text,text,text) from public,anon,authenticated;

create or replace function public.priority_payment_confirmed_trigger()
returns trigger language plpgsql security definer set search_path='' as $$
begin
 if tg_op='UPDATE' then
  if old.status is not distinct from new.status then return new; end if;
 end if;
 if new.status='paid'
   and new.provider in ('asaas','asaas_checkout')
   and new.environment='production' then
  perform public.emit_zero_cost_priority_alert(
   'payment:paid:'||new.id::text,'payment_confirmed',new.id,
   'Pagamento confirmado',
   'Pagamento de R$ '||replace(to_char(new.amount/100.0,'FM999999990D00'),'.',',')||
    ' confirmado pelo Asaas.',
   '/admin/pagamentos');
 end if;
 return new;
end; $$;
revoke all on function public.priority_payment_confirmed_trigger() from public,anon,authenticated;
drop trigger if exists payments_zero_cost_priority_alert on public.payments;
create trigger payments_zero_cost_priority_alert
 after insert or update of status on public.payments
 for each row execute function public.priority_payment_confirmed_trigger();

create or replace function public.priority_project_trigger()
returns trigger language plpgsql security definer set search_path='' as $$
begin
 if tg_op='INSERT' then
  perform public.emit_zero_cost_priority_alert(
   'project:created:'||new.id::text,'project_created',new.id,
   'Novo projeto criado',
   'Projeto "'||left(new.title,110)||'" criado na Sagamente.',
   '/admin/projetos/'||new.id::text);
 elsif new.status='completed' and old.status is distinct from new.status then
  perform public.emit_zero_cost_priority_alert(
   'project:completed:'||new.id::text,'project_completed',new.id,
   'Projeto concluído',
   'Projeto "'||left(new.title,110)||'" foi concluído.',
   '/admin/projetos/'||new.id::text);
 end if;
 return new;
end; $$;
revoke all on function public.priority_project_trigger() from public,anon,authenticated;
drop trigger if exists projects_zero_cost_priority_alert on public.projects;
create trigger projects_zero_cost_priority_alert
 after insert or update of status on public.projects
 for each row execute function public.priority_project_trigger();
);
 end if;
 if not exists(select 1 from pg_constraint where conname='priority_whatsapp_manual_only' and conrelid='public.app_settings'::regclass) then
  alter table public.app_settings add constraint priority_whatsapp_manual_only check (priority_whatsapp_mode = 'manual');
 end if;
end $;

create table if not exists public.priority_alert_log (
 event_key text primary key,
 event_type text not null check (event_type in ('payment_confirmed','project_created','project_completed')),
 record_id uuid not null,
 admin_user_id uuid not null references public.profiles(id) on delete cascade,
 title text not null,
 message text not null,
 link text not null,
 created_at timestamptz not null default now()
);
create index if not exists priority_alert_log_created_at_idx on public.priority_alert_log(created_at desc);
alter table public.priority_alert_log enable row level security;
revoke all on public.priority_alert_log from anon,authenticated;
grant select on public.priority_alert_log to authenticated;
create policy priority_alert_log_admin_read on public.priority_alert_log
 for select to authenticated using (public.current_user_is_admin());

create or replace function public.emit_zero_cost_priority_alert(
 p_key text,p_event text,p_record_id uuid,p_title text,p_message text,p_link text
) returns void language plpgsql security definer set search_path = '' as $$
declare
 cfg public.app_settings%rowtype;
 v_admin uuid;
 v_today_count integer;
begin
 -- Serializa os eventos concorrentes; nao duplica nem ultrapassa o teto diario.
 select * into cfg from public.app_settings where id=true for update;
 if not found or not cfg.priority_alerts_enabled or cfg.priority_daily_limit=0 then return; end if;
 if p_event='payment_confirmed' and (not cfg.priority_payment_confirmed or not cfg.commercial_notifications) then return; end if;
 if p_event='project_created' and not cfg.priority_project_created then return; end if;
 if p_event='project_completed' and not cfg.priority_project_completed then return; end if;
 if not cfg.internal_operation_notifications then return; end if;
 if exists (select 1 from public.priority_alert_log where event_key=p_key) then return; end if;
 select count(*) into v_today_count from public.priority_alert_log
  where (created_at at time zone 'America/Sao_Paulo')::date=(now() at time zone 'America/Sao_Paulo')::date;
 if v_today_count>=cfg.priority_daily_limit then return; end if;
 select id into v_admin from public.profiles
  where role='admin' and status='active'
  order by created_at,id limit 1;
 if v_admin is null then return; end if;
 insert into public.priority_alert_log(event_key,event_type,record_id,admin_user_id,title,message,link)
 values(p_key,p_event,p_record_id,v_admin,p_title,p_message,p_link)
 on conflict (event_key) do nothing;
 if not found then return; end if;
 insert into public.notifications(user_id,type,title,message,link,metadata)
 values(v_admin,
   case p_event when 'payment_confirmed' then 'payment_confirmed_priority'
        when 'project_created' then 'project_created_priority'
        else 'project_completed_priority' end,
   p_title,p_message,p_link,
   jsonb_build_object('priority',true,'event_type',p_event,'record_id',p_record_id));
 -- O trigger de notifications existente coloca no Push quando inscrito.
end;
$$;
revoke all on function public.emit_zero_cost_priority_alert(text,text,uuid,text,text,text) from public,anon,authenticated;

create or replace function public.priority_payment_confirmed_trigger()
returns trigger language plpgsql security definer set search_path='' as $$
begin
 if new.status='paid'
   and (tg_op='INSERT' or old.status is distinct from new.status)
   and new.provider in ('asaas','asaas_checkout')
   and new.environment='production' then
  perform public.emit_zero_cost_priority_alert(
   'payment:paid:'||new.id::text,'payment_confirmed',new.id,
   'Pagamento confirmado',
   'Pagamento de R$ '||replace(to_char(new.amount/100.0,'FM999999990D00'),'.',',')||
    ' confirmado pelo Asaas.',
   '/admin/pagamentos');
 end if;
 return new;
end; $$;
revoke all on function public.priority_payment_confirmed_trigger() from public,anon,authenticated;
drop trigger if exists payments_zero_cost_priority_alert on public.payments;
create trigger payments_zero_cost_priority_alert
 after insert or update of status on public.payments
 for each row execute function public.priority_payment_confirmed_trigger();

create or replace function public.priority_project_trigger()
returns trigger language plpgsql security definer set search_path='' as $$
begin
 if tg_op='INSERT' then
  perform public.emit_zero_cost_priority_alert(
   'project:created:'||new.id::text,'project_created',new.id,
   'Novo projeto criado',
   'Projeto "'||left(new.title,110)||'" criado na Sagamente.',
   '/admin/projetos/'||new.id::text);
 elsif new.status='completed' and old.status is distinct from new.status then
  perform public.emit_zero_cost_priority_alert(
   'project:completed:'||new.id::text,'project_completed',new.id,
   'Projeto concluído',
   'Projeto "'||left(new.title,110)||'" foi concluído.',
   '/admin/projetos/'||new.id::text);
 end if;
 return new;
end; $$;
revoke all on function public.priority_project_trigger() from public,anon,authenticated;
drop trigger if exists projects_zero_cost_priority_alert on public.projects;
create trigger projects_zero_cost_priority_alert
 after insert or update of status on public.projects
 for each row execute function public.priority_project_trigger();
