-- Piloto QR local: biblioteca não oficial, sem garantia de disponibilidade ou ausência de bloqueios.
-- Toda a automação começa DESATIVADA; teste inicial envia somente ao WhatsApp de teste.
alter table public.app_settings
 add column if not exists wa_bridge_auto_enabled boolean not null default false,
 add column if not exists wa_bridge_test_only boolean not null default true,
 add column if not exists wa_bridge_daily_limit integer not null default 10,
 add column if not exists wa_bridge_sender_phone text not null default '5564981294186',
 add column if not exists wa_bridge_test_phone text not null default '5564981294186',
 add column if not exists wa_bridge_auto_started_at timestamptz;
alter table public.app_settings drop constraint if exists wa_bridge_limit_check;
alter table public.app_settings add constraint wa_bridge_limit_check
 check (wa_bridge_daily_limit between 0 and 10);
alter table public.app_settings drop constraint if exists wa_bridge_sender_check;
alter table public.app_settings add constraint wa_bridge_sender_check
 check (wa_bridge_sender_phone ~ '^55[0-9]{10,11}$' and wa_bridge_test_phone ~ '^55[0-9]{10,11}$');
alter table public.user_preferences add column if not exists wa_automatic_opt_in boolean not null default false;

create table if not exists public.whatsapp_bridge_state(
 id boolean primary key default true check (id=true),
 requested_mode text not null default 'stopped' check(requested_mode in ('stopped','connect','disconnect')),
 status text not null default 'offline'
  check(status in ('offline','connecting','qr_ready','connected','error','logged_out')),
 instance_id uuid,
 heartbeat_at timestamptz,
 connected_phone text,
 qr_data_url text,
 qr_updated_at timestamptz,
 last_error text,
 updated_at timestamptz not null default now()
);
insert into public.whatsapp_bridge_state(id) values(true) on conflict(id) do nothing;
alter table public.whatsapp_bridge_state enable row level security;
revoke all on public.whatsapp_bridge_state from anon,authenticated;
grant select on public.whatsapp_bridge_state to authenticated;
drop policy if exists whatsapp_bridge_admin_read on public.whatsapp_bridge_state;
create policy whatsapp_bridge_admin_read on public.whatsapp_bridge_state
 for select to authenticated using(public.current_user_is_admin());

alter table public.whatsapp_message_outbox drop constraint if exists whatsapp_message_outbox_status_check;
alter table public.whatsapp_message_outbox add constraint whatsapp_message_outbox_status_check
 check(status in ('ready_manual','missing_phone','historical','opened_manual','reported_sent',
 'sending_auto','sent_auto','failed_auto'));

create table if not exists public.whatsapp_bridge_attempts(
 id uuid primary key default gen_random_uuid(),
 outbox_id uuid not null references public.whatsapp_message_outbox(id) on delete cascade,
 instance_id uuid not null,
 destination_phone text not null,
 test_mode boolean not null,
 status text not null default 'claimed' check(status in ('claimed','sent','failed')),
 provider_message_id text,
 error_reason text,
 claimed_at timestamptz not null default now(),
 completed_at timestamptz
);
create index if not exists wa_bridge_attempts_claimed_idx on public.whatsapp_bridge_attempts(claimed_at desc);
alter table public.whatsapp_bridge_attempts enable row level security;
revoke all on public.whatsapp_bridge_attempts from anon,authenticated;
grant select on public.whatsapp_bridge_attempts to authenticated;
drop policy if exists wa_bridge_attempts_admin_read on public.whatsapp_bridge_attempts;
create policy wa_bridge_attempts_admin_read on public.whatsapp_bridge_attempts
 for select to authenticated using(public.current_user_is_admin());

-- Somente administradores podem solicitar pareamento, pausa e habilitar o piloto.
create or replace function public.wa_bridge_admin_control(p_action text)
returns text language plpgsql security definer set search_path='' as $$
declare cfg public.app_settings%rowtype; bridge public.whatsapp_bridge_state%rowtype;
begin
 if not public.current_user_is_admin() then raise exception 'Acesso administrativo obrigatório' using errcode='42501'; end if;
 select * into cfg from public.app_settings where id=true for update;
 select * into bridge from public.whatsapp_bridge_state where id=true for update;
 if p_action='connect' then
  update public.whatsapp_bridge_state set requested_mode='connect',updated_at=now() where id=true;
  return 'Conexão solicitada; o serviço local deve estar ligado';
 elsif p_action='disconnect' then
  update public.app_settings set wa_bridge_auto_enabled=false where id=true;
  update public.whatsapp_bridge_state set requested_mode='disconnect',qr_data_url=null,updated_at=now() where id=true;
  return 'Desconexão solicitada';
 elsif p_action='disable' then
  update public.app_settings set wa_bridge_auto_enabled=false where id=true;
  return 'Envios automáticos pausados';
 elsif p_action='enable' then
  if bridge.status<>'connected' or bridge.heartbeat_at<now()-interval '35 seconds'
   or bridge.requested_mode<>'connect'
   or bridge.connected_phone is distinct from cfg.wa_bridge_sender_phone then
   raise exception 'Conecte o número comercial correto antes de habilitar o piloto' using errcode='22023';
  end if;
  update public.app_settings
    set wa_bridge_auto_enabled=true,wa_bridge_auto_started_at=now() where id=true;
  return 'Piloto ativado para eventos futuros';
 end if;
 raise exception 'Ação desconhecida' using errcode='22023';
end $$;
revoke all on function public.wa_bridge_admin_control(text) from public,anon;
grant execute on function public.wa_bridge_admin_control(text) to authenticated;

-- RPCs internas: NÃO acessíveis por sessões do painel.
create or replace function public.wa_bridge_worker_report(
 p_instance uuid,p_status text,p_qr text default null,p_phone text default null,p_error text default null
) returns boolean language plpgsql security invoker set search_path='' as $$
begin
 if p_status not in ('offline','connecting','qr_ready','connected','error','logged_out') then return false; end if;
 if p_qr is not null and (length(p_qr)>150000 or p_qr !~ '^data:image/png;base64,') then return false; end if;
 update public.whatsapp_bridge_state set
  instance_id=p_instance,status=p_status,heartbeat_at=now(),
  connected_phone=case when p_status='connected' then p_phone when p_status in ('offline','logged_out') then null else connected_phone end,
  qr_data_url=case when p_status='qr_ready' then p_qr else null end,
  qr_updated_at=case when p_status='qr_ready' then now() else null end,
  last_error=left(p_error,400),updated_at=now()
 where id=true and (instance_id=p_instance or instance_id is null or heartbeat_at<now()-interval '40 seconds');
 return found;
end $$;
revoke all on function public.wa_bridge_worker_report(uuid,text,text,text,text) from public,anon,authenticated;
grant execute on function public.wa_bridge_worker_report(uuid,text,text,text,text) to service_role;

create or replace function public.wa_bridge_claim(p_instance uuid)
returns jsonb language plpgsql security invoker set search_path='' as $$
declare cfg public.app_settings%rowtype; bridge public.whatsapp_bridge_state%rowtype;
 v_row public.whatsapp_message_outbox%rowtype;
 v_target text; v_attempt uuid; v_body text; v_used bigint;
begin
 select * into cfg from public.app_settings where id=true for update;
 select * into bridge from public.whatsapp_bridge_state where id=true;
 if not cfg.wa_bridge_auto_enabled or cfg.wa_bridge_daily_limit=0
  or bridge.instance_id is distinct from p_instance or bridge.status<>'connected'
  or bridge.requested_mode<>'connect' or bridge.heartbeat_at<now()-interval '35 seconds'
  or bridge.connected_phone is distinct from cfg.wa_bridge_sender_phone
  or cfg.wa_bridge_auto_started_at is null then return null; end if;
 select count(*) into v_used from public.whatsapp_bridge_attempts
 where (claimed_at at time zone 'America/Sao_Paulo')::date =
  (now() at time zone 'America/Sao_Paulo')::date;
 if v_used>=cfg.wa_bridge_daily_limit then return null; end if;
 select o.* into v_row from public.whatsapp_message_outbox o
 left join public.user_preferences pref on pref.user_id=o.recipient_user_id
 where o.status='ready_manual' and o.source='live'
  and o.created_at>=cfg.wa_bridge_auto_started_at
  and o.destination_phone is not null
  and (cfg.wa_bridge_test_only or coalesce(pref.wa_automatic_opt_in,false))
 order by o.created_at,o.id limit 1 for update of o skip locked;
 if not found then return null; end if;
 v_target:=case when cfg.wa_bridge_test_only then cfg.wa_bridge_test_phone else v_row.destination_phone end;
 v_body:=case when cfg.wa_bridge_test_only
   then '[TESTE SAGAMENTE - envio para o número de teste; destinatário original: '||
    v_row.recipient_name||' / '||v_row.destination_phone||']'||E'\n\n'
   else '' end||v_row.message_body;
 update public.whatsapp_message_outbox set status='sending_auto' where id=v_row.id;
 insert into public.whatsapp_bridge_attempts(outbox_id,instance_id,destination_phone,test_mode)
 values(v_row.id,p_instance,v_target,cfg.wa_bridge_test_only) returning id into v_attempt;
 return jsonb_build_object('attempt_id',v_attempt,'outbox_id',v_row.id,
  'phone',v_target,'message',v_body,'test_only',cfg.wa_bridge_test_only);
end $$;
revoke all on function public.wa_bridge_claim(uuid) from public,anon,authenticated;
grant execute on function public.wa_bridge_claim(uuid) to service_role;

create or replace function public.wa_bridge_finish(
 p_instance uuid,p_attempt uuid,p_success boolean,p_msg_id text default null,p_error text default null
) returns boolean language plpgsql security invoker set search_path='' as $$
declare v_outbox uuid;
begin
 update public.whatsapp_bridge_attempts set
 status=case when p_success then 'sent' else 'failed' end,
 provider_message_id=case when p_success then left(p_msg_id,255) else null end,
 error_reason=case when not p_success then left(p_error,400) else null end,
 completed_at=now()
 where id=p_attempt and instance_id=p_instance and status='claimed'
 returning outbox_id into v_outbox;
 if v_outbox is null then return false; end if;
 update public.whatsapp_message_outbox
 set status=case when p_success then 'sent_auto' else 'failed_auto' end
 where id=v_outbox and status='sending_auto';
 return true;
end $$;
revoke all on function public.wa_bridge_finish(uuid,uuid,boolean,text,text) from public,anon,authenticated;
grant execute on function public.wa_bridge_finish(uuid,uuid,boolean,text,text) to service_role;

create or replace function public.wa_daily_dashboard()
returns jsonb language sql stable security definer set search_path='' as $$
 with r as (
 select *,
  (created_at at time zone 'America/Sao_Paulo')::date=(now() at time zone 'America/Sao_Paulo')::date as today,
  (opened_at at time zone 'America/Sao_Paulo')::date=(now() at time zone 'America/Sao_Paulo')::date as opened_today,
  (reported_at at time zone 'America/Sao_Paulo')::date=(now() at time zone 'America/Sao_Paulo')::date as reported_today
 from public.whatsapp_message_outbox
 ), attempts as (
 select
 count(*) filter(where (claimed_at at time zone 'America/Sao_Paulo')::date=(now() at time zone 'America/Sao_Paulo')::date) as today_count,
 count(*) filter(where status='sent' and (completed_at at time zone 'America/Sao_Paulo')::date=(now() at time zone 'America/Sao_Paulo')::date) as sent_count,
 count(*) filter(where status='failed' and (completed_at at time zone 'America/Sao_Paulo')::date=(now() at time zone 'America/Sao_Paulo')::date) as failed_count
 from public.whatsapp_bridge_attempts
 )
 select case when public.current_user_is_admin() then jsonb_build_object(
  'prepared_today',count(*) filter(where today and source='live'),
  'historical_total',count(*) filter(where source='historical'),
  'missing_phone_today',count(*) filter(where today and status='missing_phone'),
  'opened_today',count(*) filter(where opened_today),
  'reported_today',count(*) filter(where reported_today),
  'provider_sent_today',0,'provider_delivered_today',0,
  'bridge_attempts_today',(select today_count from attempts),
  'bridge_sent_today',(select sent_count from attempts),
  'bridge_failed_today',(select failed_count from attempts),
  'total_records',count(*)) else '{}'::jsonb end
 from r;
$$;
revoke all on function public.wa_daily_dashboard() from public,anon;
grant execute on function public.wa_daily_dashboard() to authenticated;
