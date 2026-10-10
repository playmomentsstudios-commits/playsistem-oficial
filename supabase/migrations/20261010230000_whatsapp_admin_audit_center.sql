-- SAGAMENTE | Auditoria WhatsApp sem prometer entrega não verificada.
-- Nenhum envio HTTP ou integração com API de WhatsApp é feito neste pacote.
alter table public.app_settings
 add column if not exists wa_prepare_project_status boolean not null default true,
 add column if not exists wa_prepare_task_status boolean not null default true,
 add column if not exists wa_prepare_stage_status boolean not null default false,
 add column if not exists wa_prepare_file_updates boolean not null default false,
 add column if not exists wa_prepare_file_review boolean not null default true,
 add column if not exists wa_prepare_priority_events boolean not null default true;

create table if not exists public.whatsapp_message_outbox (
 id uuid primary key default gen_random_uuid(),
 notification_id uuid not null unique references public.notifications(id) on delete cascade,
 recipient_user_id uuid not null references public.profiles(id) on delete cascade,
 recipient_name text not null default '',
 destination_phone text,
 event_type text not null,
 title text not null,
 message_body text not null,
 target_link text,
 status text not null default 'ready_manual'
   check (status in ('ready_manual','missing_phone','historical','opened_manual','reported_sent')),
 source text not null default 'live' check (source in ('live','historical')),
 created_at timestamptz not null default now(),
 opened_at timestamptz,
 reported_at timestamptz,
 opened_by uuid references auth.users(id),
 reported_by uuid references auth.users(id)
);
create index if not exists whatsapp_message_outbox_created_idx
 on public.whatsapp_message_outbox(created_at desc);
create index if not exists whatsapp_message_outbox_recipient_idx
 on public.whatsapp_message_outbox(recipient_user_id,created_at desc);
alter table public.whatsapp_message_outbox enable row level security;
revoke all on public.whatsapp_message_outbox from anon,authenticated;
grant select on public.whatsapp_message_outbox to authenticated;
drop policy if exists wa_outbox_admin_read on public.whatsapp_message_outbox;
create policy wa_outbox_admin_read on public.whatsapp_message_outbox
 for select to authenticated using (public.current_user_is_admin());

create or replace function app_private.wa_capture_notification(p_id uuid,p_historical boolean default false)
returns void language plpgsql security definer set search_path='' as $$
declare
 n public.notifications%rowtype;
 cfg public.app_settings%rowtype;
 v_phone text;
 v_raw text;
 v_name text;
 v_allowed boolean := false;
begin
 select * into n from public.notifications where id=p_id;
 if not found then return; end if;
 select * into cfg from public.app_settings where id=true;
 if not found then return; end if;
 v_allowed := case
  when n.type in ('project_status','project_updated') then cfg.wa_prepare_project_status
  when n.type='project_task' then cfg.wa_prepare_task_status
  when n.type='project_stage' then cfg.wa_prepare_stage_status
  when n.type in ('file_available','file_received') then cfg.wa_prepare_file_updates
  when n.type='file_review_requested' then cfg.wa_prepare_file_review
  when n.type in ('payment_confirmed_priority','project_created_priority','project_completed_priority') then cfg.wa_prepare_priority_events
  else false end;
 if not v_allowed then return; end if;
 select regexp_replace(coalesce(p.phone,''),'[^0-9]','','g'),
   btrim(concat_ws(' ',nullif(p.first_name,''),nullif(p.last_name,'')))
 into v_raw,v_name from public.profiles p where p.id=n.user_id;
 if not found then return; end if;
 if n.type in ('payment_confirmed_priority','project_created_priority','project_completed_priority') then
   v_raw := regexp_replace(coalesce(cfg.priority_whatsapp_phone,''),'[^0-9]','','g');
 end if;
 v_phone := case
  when v_raw ~ '^55[0-9]{10,11}$' then v_raw
  when v_raw ~ '^[0-9]{10,11}$' then '55'||v_raw
  else null end;
 insert into public.whatsapp_message_outbox
 (notification_id,recipient_user_id,recipient_name,destination_phone,event_type,title,
  message_body,target_link,status,source,created_at)
 values (n.id,n.user_id,coalesce(nullif(v_name,''),'Destinatário'),v_phone,n.type,n.title,
  'SAGAMENTE — '||n.title||E'\n\n'||n.message,
  n.link,
  case when p_historical then 'historical'
       when v_phone is null then 'missing_phone'
       else 'ready_manual' end,
  case when p_historical then 'historical' else 'live' end,
  n.created_at)
 on conflict (notification_id) do nothing;
end $$;
revoke all on function app_private.wa_capture_notification(uuid,boolean) from public,anon,authenticated;

create or replace function public.wa_enqueue_notification_trigger()
returns trigger language plpgsql security definer set search_path='' as $$
begin
 perform app_private.wa_capture_notification(new.id,false);
 return new;
end $$;
revoke all on function public.wa_enqueue_notification_trigger() from public,anon,authenticated;
drop trigger if exists notifications_whatsapp_outbox on public.notifications;
create trigger notifications_whatsapp_outbox
 after insert on public.notifications
 for each row execute function public.wa_enqueue_notification_trigger();

-- Os registros antigos ficam visíveis para auditoria, sem fingir que foram preparados ou enviados.
do $$
declare historical_notice record;
begin
 for historical_notice in
  select id from public.notifications
  where created_at >= now()-interval '14 days'
  order by created_at asc
 loop
  perform app_private.wa_capture_notification(historical_notice.id,true);
 end loop;
end $$;

create or replace function public.wa_mark_manual_action(p_outbox_id uuid,p_action text)
returns text language plpgsql security definer set search_path='' as $$
declare v_status text;
begin
 if not public.current_user_is_admin() then
  raise exception 'Somente administradores podem registrar ações do WhatsApp.' using errcode='42501';
 end if;
 if p_action not in ('opened','reported_sent') then
  raise exception 'Ação desconhecida.' using errcode='22023';
 end if;
 select status into v_status from public.whatsapp_message_outbox
  where id=p_outbox_id for update;
 if not found then raise exception 'Registro não encontrado.'; end if;
 if v_status in ('missing_phone','historical') then
  raise exception 'O aviso não está preparado para envio manual.' using errcode='22023';
 end if;
 if p_action='opened' then
  if v_status='ready_manual' then
   update public.whatsapp_message_outbox
   set status='opened_manual',opened_at=now(),opened_by=auth.uid()
   where id=p_outbox_id;
  end if;
 elsif p_action='reported_sent' then
  if v_status not in ('opened_manual','reported_sent') then
   raise exception 'Abra o WhatsApp antes de registrar o envio manual.' using errcode='22023';
  end if;
  if v_status='opened_manual' then
   update public.whatsapp_message_outbox
   set status='reported_sent',reported_at=now(),reported_by=auth.uid()
   where id=p_outbox_id;
  end if;
 end if;
 return 'ok';
end $$;
revoke all on function public.wa_mark_manual_action(uuid,text) from public,anon;
grant execute on function public.wa_mark_manual_action(uuid,text) to authenticated;

create or replace function public.wa_daily_dashboard()
returns jsonb language sql stable security definer set search_path='' as $$
 with rows as (
  select *,
    (created_at at time zone 'America/Sao_Paulo')::date =
    (now() at time zone 'America/Sao_Paulo')::date as today,
    (opened_at at time zone 'America/Sao_Paulo')::date =
    (now() at time zone 'America/Sao_Paulo')::date as opened_today,
    (reported_at at time zone 'America/Sao_Paulo')::date =
    (now() at time zone 'America/Sao_Paulo')::date as reported_today
  from public.whatsapp_message_outbox
 )
 select case when public.current_user_is_admin() then
  jsonb_build_object(
    'prepared_today',count(*) filter (where today and source='live'),
    'historical_total',count(*) filter (where source='historical'),
    'missing_phone_today',count(*) filter (where today and status='missing_phone'),
    'opened_today',count(*) filter (where opened_today),
    'reported_today',count(*) filter (where reported_today),
    'provider_sent_today',0,
    'provider_delivered_today',0,
    'total_records',count(*)
  )
 else '{}'::jsonb end from rows;
$$;
revoke all on function public.wa_daily_dashboard() from public,anon;
grant execute on function public.wa_daily_dashboard() to authenticated;
