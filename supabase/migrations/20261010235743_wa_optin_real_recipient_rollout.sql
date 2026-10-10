-- Real-recipient rollout is *off* by default. It is opt-in only,
-- one customer at a time first; broader rollout needs an accepted trial.
alter table public.app_settings
  add column if not exists wa_bridge_delivery_mode text not null default 'self_test',
  add column if not exists wa_bridge_single_customer_id uuid references public.profiles(id);
alter table public.app_settings drop constraint if exists wa_bridge_delivery_mode_valid;
alter table public.app_settings add constraint wa_bridge_delivery_mode_valid check
  (wa_bridge_delivery_mode in ('self_test','single_client','consented_clients'));

alter table public.user_preferences
  add column if not exists wa_opt_in_phone text,
  add column if not exists wa_opt_in_at timestamptz;

-- Consent is bound to the subscriber's CURRENT registered telephone.
-- A changed phone invalidates the old consent until a fresh opt-in.
create or replace function public.wa_capture_customer_consent()
returns trigger language plpgsql security definer set search_path='' as $$
declare v_phone text; v_role text; v_status text;
begin
 if new.wa_automatic_opt_in is not true then
   new.wa_opt_in_phone:=null; new.wa_opt_in_at:=null;
 elsif tg_op='UPDATE' and old.wa_automatic_opt_in is true and old.wa_opt_in_at is not null then
   -- Do not let a preferences update silently reconsent for a changed telephone.
   new.wa_opt_in_phone:=old.wa_opt_in_phone;
   new.wa_opt_in_at:=old.wa_opt_in_at;
 else
   select role,status,regexp_replace(coalesce(phone,''),'[^0-9]','','g')
    into v_role,v_status,v_phone from public.profiles where id=new.user_id;
   if v_role is distinct from 'customer' or v_status is distinct from 'active'
     then raise exception 'O aceite deve ser realizado por uma conta de cliente ativa.' using errcode='22023'; end if;
   if v_phone ~ '^[0-9]{10,11}$' then v_phone:='55'||v_phone; end if;
   if v_phone !~ '^55[0-9]{10,11}$'
     then raise exception 'Atualize o telefone no seu perfil antes de ativar o WhatsApp.' using errcode='22023'; end if;
   new.wa_opt_in_phone:=v_phone;
   new.wa_opt_in_at:=now();
 end if;
 return new;
end $$;
drop trigger if exists user_preferences_wa_consent_guard on public.user_preferences;
create trigger user_preferences_wa_consent_guard
 before insert or update on public.user_preferences
 for each row execute function public.wa_capture_customer_consent();
revoke all on function public.wa_capture_customer_consent() from public,anon,authenticated;

-- Authenticated users cannot query arbitrary other customers; admins can list only consented ones.
create or replace function public.wa_bridge_customer_eligible(p_user_id uuid)
returns boolean language sql stable security definer set search_path='' as $$
select exists(
 select 1 from public.profiles p
 join public.user_preferences pref on pref.user_id=p.id
 where p.id=p_user_id and p.role='customer' and p.status='active'
   and pref.wa_automatic_opt_in=true and pref.wa_opt_in_at is not null
   and pref.wa_opt_in_phone ~ '^55[0-9]{10,11}$'
   and pref.wa_opt_in_phone=
     case when regexp_replace(coalesce(p.phone,''),'[^0-9]','','g') ~ '^[0-9]{10,11}$'
          then '55'||regexp_replace(p.phone,'[^0-9]','','g')
          else regexp_replace(coalesce(p.phone,''),'[^0-9]','','g') end
);
$$;
revoke all on function public.wa_bridge_customer_eligible(uuid) from public,anon,authenticated;
grant execute on function public.wa_bridge_customer_eligible(uuid) to service_role;

create or replace function public.wa_bridge_eligible_customers()
returns table(user_id uuid, customer_name text, phone text)
language plpgsql stable security definer set search_path='' as $$
begin
 if not public.current_user_is_admin() then
   raise exception 'Somente administradores podem listar clientes habilitados.' using errcode='42501';
 end if;
 return query
 select p.id,coalesce(nullif(btrim(concat_ws(' ',p.first_name,p.last_name)),''),'Cliente'),pref.wa_opt_in_phone
 from public.profiles p join public.user_preferences pref on pref.user_id=p.id
 where public.wa_bridge_customer_eligible(p.id) order by p.first_name,p.last_name,p.id;
end $$;
revoke all on function public.wa_bridge_eligible_customers() from public,anon;
grant execute on function public.wa_bridge_eligible_customers() to authenticated;

-- This RPC never enables sending. Changing target always pauses and cuts off old queued events.
create or replace function public.wa_bridge_set_delivery_mode(p_mode text,p_customer_id uuid default null)
returns text language plpgsql security definer set search_path='' as $$
begin
 if not public.current_user_is_admin() then raise exception 'Somente administradores.' using errcode='42501'; end if;
 if p_mode not in ('self_test','single_client','consented_clients') then
  raise exception 'Modo inválido' using errcode='22023';
 end if;
 if p_mode='single_client' and
    (p_customer_id is null or not public.wa_bridge_customer_eligible(p_customer_id)) then
  raise exception 'Selecione um cliente ativo com consentimento e telefone válidos.' using errcode='22023';
 end if;
 if p_mode='consented_clients' and not exists (
  select 1 from public.whatsapp_bridge_attempts a
  join public.whatsapp_message_outbox o on o.id=a.outbox_id
  where a.status='sent' and a.test_mode=false and o.event_type in
   ('project_status','project_updated','project_task','project_stage','file_available','file_review_requested')
 ) then
  raise exception 'Conclua primeiro um teste individual real antes da expansão.' using errcode='22023';
 end if;
 update public.app_settings set
   wa_bridge_auto_enabled=false,wa_bridge_auto_started_at=null,
   wa_bridge_delivery_mode=p_mode,
   wa_bridge_single_customer_id=case when p_mode='single_client' then p_customer_id else null end,
   wa_bridge_test_only=(p_mode='self_test')
 where id=true;
 return case p_mode when 'self_test' then 'Modo teste próprio selecionado; envios pausados.'
 when 'single_client' then 'Cliente autorizado selecionado; envios pausados.'
 else 'Clientes com aceite selecionados; envios pausados.' end;
end $$;
revoke all on function public.wa_bridge_set_delivery_mode(text,uuid) from public,anon;
grant execute on function public.wa_bridge_set_delivery_mode(text,uuid) to authenticated;

-- Keep the old admin actions, but make enable re-check the selected real target.
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
   raise exception 'Conecte o número comercial correto antes de habilitar o envio' using errcode='22023';
  end if;
  if cfg.wa_bridge_delivery_mode='self_test' and cfg.wa_bridge_test_only is distinct from true then
   raise exception 'Configuração de teste inconsistente' using errcode='22023'; end if;
  if cfg.wa_bridge_delivery_mode='single_client' then
   if cfg.wa_bridge_test_only is distinct from false or cfg.wa_bridge_single_customer_id is null
     or not public.wa_bridge_customer_eligible(cfg.wa_bridge_single_customer_id)
    then raise exception 'Cliente selecionado sem aceite ou telefone válido' using errcode='22023'; end if;
  elsif cfg.wa_bridge_delivery_mode='consented_clients' then
   if cfg.wa_bridge_test_only is distinct from false or not exists(
    select 1 from public.whatsapp_bridge_attempts where status='sent' and test_mode=false
   ) then raise exception 'Faça o teste individual antes de enviar a todos.' using errcode='22023'; end if;
  elsif cfg.wa_bridge_delivery_mode is distinct from 'self_test' then
   raise exception 'Modo desconhecido' using errcode='22023';
  end if;
  update public.app_settings set wa_bridge_auto_enabled=true,wa_bridge_auto_started_at=now() where id=true;
  return case when cfg.wa_bridge_delivery_mode='self_test' then 'Teste para o próprio WhatsApp ativado'
    when cfg.wa_bridge_delivery_mode='single_client' then 'Envio individual autorizado ativado'
    else 'Envio aos clientes que aceitaram ativado' end;
 end if;
 raise exception 'Ação desconhecida' using errcode='22023';
end $$;

-- Transactional worker claim: always revalidate opt-in, current phone AND current project access
-- at the time of sending; no backward replay when switching modes.
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
 if cfg.wa_bridge_delivery_mode not in ('self_test','single_client','consented_clients')
 or cfg.wa_bridge_test_only is distinct from (cfg.wa_bridge_delivery_mode='self_test')
 then return null; end if;
 if cfg.wa_bridge_delivery_mode='single_client'
 and (cfg.wa_bridge_single_customer_id is null
 or not public.wa_bridge_customer_eligible(cfg.wa_bridge_single_customer_id)) then return null; end if;
 select count(*) into v_used from public.whatsapp_bridge_attempts
 where (claimed_at at time zone 'America/Sao_Paulo')::date =
  (now() at time zone 'America/Sao_Paulo')::date;
 if v_used>=cfg.wa_bridge_daily_limit then return null; end if;
 select o.* into v_row from public.whatsapp_message_outbox o
 join public.notifications n on n.id=o.notification_id
 where o.status='ready_manual' and o.source='live'
  and o.created_at>=cfg.wa_bridge_auto_started_at
  and o.destination_phone ~ '^55[0-9]{10,11}$'
  and (
    cfg.wa_bridge_delivery_mode='self_test'
    or (
      o.event_type in ('project_status','project_updated','project_task','project_stage',
                       'file_available','file_review_requested')
      and n.metadata->>'project_id' is not null
      and public.wa_bridge_customer_eligible(o.recipient_user_id)
      and o.destination_phone=(select pref.wa_opt_in_phone from public.user_preferences pref
        where pref.user_id=o.recipient_user_id)
      and (cfg.wa_bridge_delivery_mode='consented_clients'
        or o.recipient_user_id=cfg.wa_bridge_single_customer_id)
      and exists (
        select 1 from public.projects p where p.id=(n.metadata->>'project_id')::uuid
          and p.project_type<>'internal' and
            (p.customer_id=o.recipient_user_id or exists (
             select 1 from public.project_customer_access a
             where a.project_id=p.id and a.customer_id=o.recipient_user_id
            ))
      )
    )
  )
 order by o.created_at,o.id limit 1 for update of o skip locked;
 if not found then return null; end if;
 v_target:=case when cfg.wa_bridge_delivery_mode='self_test' then cfg.wa_bridge_test_phone else v_row.destination_phone end;
 v_body:=case when cfg.wa_bridge_delivery_mode='self_test'
   then '[TESTE SAGAMENTE - envio para o número de teste; destinatário original: '||
    v_row.recipient_name||' / '||v_row.destination_phone||']'||E'\n\n'
   else '' end||v_row.message_body;
 update public.whatsapp_message_outbox set status='sending_auto' where id=v_row.id;
 insert into public.whatsapp_bridge_attempts(outbox_id,instance_id,destination_phone,test_mode)
 values(v_row.id,p_instance,v_target,cfg.wa_bridge_delivery_mode='self_test') returning id into v_attempt;
 return jsonb_build_object('attempt_id',v_attempt,'outbox_id',v_row.id,
  'phone',v_target,'message',v_body,'test_only',cfg.wa_bridge_delivery_mode='self_test');
end $$;
revoke all on function public.wa_bridge_claim(uuid) from public,anon,authenticated;
grant execute on function public.wa_bridge_claim(uuid) to service_role;

-- Never elevate old rows to opt-in based on the previous preference flag.
-- Their consent records remain null until they explicitly reconfirm.
