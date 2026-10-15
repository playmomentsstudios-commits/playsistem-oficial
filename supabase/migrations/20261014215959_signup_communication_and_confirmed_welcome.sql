-- Sagamente · communication preferences and confirmed-account welcome.
-- Preserve Supabase Auth email confirmation; do not send authentication links by WhatsApp.
-- Existing users are not retroactively opted into any channel.
alter table public.user_preferences
 add column if not exists marketing_opt_in boolean not null default false,
 add column if not exists marketing_opt_in_at timestamptz,
 add column if not exists signup_consent_version text;

-- The server, not client-provided timestamps, records marketing consent.
create or replace function public.customer_marketing_consent_stamp()
returns trigger language plpgsql security definer set search_path='' as $$
begin
 if new.marketing_opt_in is not true then
   new.marketing_opt_in_at:=null;
 elsif tg_op='INSERT' then
   new.marketing_opt_in_at:=now();
 elsif old.marketing_opt_in is distinct from true then
   new.marketing_opt_in_at:=now();
 else
   new.marketing_opt_in_at:=old.marketing_opt_in_at;
 end if;
 return new;
end $$;
drop trigger if exists user_preferences_marketing_consent_stamp on public.user_preferences;
create trigger user_preferences_marketing_consent_stamp
before insert or update on public.user_preferences
for each row execute function public.customer_marketing_consent_stamp();
revoke all on function public.customer_marketing_consent_stamp() from public,anon,authenticated;

-- Profiles created through Supabase Auth already initialize user_preferences.
-- This trigger runs after profiles_ensure_user_preferences, and never turns on consent
-- without an explicit, versioned true submitted on the registration form.
create or replace function public.signup_capture_communication_preferences()
returns trigger language plpgsql security definer set search_path='' as $$
declare v_meta jsonb; v_phone text;
begin
 select u.raw_user_meta_data into v_meta from auth.users u where u.id=new.id;
 if coalesce(v_meta->>'signup_communication_version','') <> '2026-10-v1' then
   return new;
 end if;
 v_phone := regexp_replace(coalesce(new.phone,''),'[^0-9]','','g');
 if v_phone ~ '^[0-9]{10,11}$' then v_phone:='55'||v_phone; end if;
 insert into public.user_preferences(user_id) values(new.id)
 on conflict(user_id) do nothing;
 update public.user_preferences
 set wa_automatic_opt_in=(
       v_meta->>'signup_whatsapp_updates_opt_in'='true'
       and v_phone ~ '^55[0-9]{10,11}$'
     ),
     marketing_opt_in=(v_meta->>'signup_marketing_opt_in'='true'),
     signup_consent_version='2026-10-v1'
 where user_id=new.id;
 return new;
end $$;
drop trigger if exists profiles_zz_signup_communication on public.profiles;
create trigger profiles_zz_signup_communication
after insert on public.profiles
for each row execute function public.signup_capture_communication_preferences();
revoke all on function public.signup_capture_communication_preferences() from public,anon,authenticated;

-- Idempotence and audit marker for the first confirmed account welcome.
create table if not exists public.customer_onboarding_events(
 user_id uuid primary key references auth.users(id) on delete cascade,
 email_confirmed_at timestamptz not null,
 processed_at timestamptz not null default now()
);
alter table public.customer_onboarding_events enable row level security;
revoke all on public.customer_onboarding_events from anon,authenticated;

-- Confirmation notifications are generated on the SERVER, not on a client
-- redirect page that could be reloaded or called without a valid session.
-- Avoid blocking Supabase Auth if an operational notification is unavailable.
create or replace function public.customer_welcome_after_email_confirmation()
returns trigger language plpgsql security definer set search_path='' as $$
declare
 v_profile public.profiles%rowtype;
 v_name text;
 v_first text;
 v_welcome uuid;
 v_message text;
 v_inserted uuid;
begin
 if old.email_confirmed_at is not null or new.email_confirmed_at is null
    or new.is_anonymous is true then return new; end if;
 select * into v_profile from public.profiles p where p.id=new.id;
 if not found or v_profile.role <> 'customer' or v_profile.status <> 'active' then
    return new;
 end if;
 insert into public.customer_onboarding_events(user_id,email_confirmed_at)
 values(new.id,new.email_confirmed_at)
 on conflict(user_id) do nothing returning user_id into v_inserted;
 if v_inserted is null then return new; end if;

 v_name := btrim(concat_ws(' ',nullif(v_profile.first_name,''),nullif(v_profile.last_name,'')));
 v_first := nullif(split_part(v_name,' ',1),'');
 if v_first is null then v_first:='cliente'; end if;
 v_first := left(regexp_replace(v_first,'[^[:alnum:]À-ÿ -]','','g'),60);
 insert into public.notifications(user_id,type,title,message,link,metadata)
 values(new.id,'account_welcome','Boas-vindas à Sagamente!',
   'Seu e-mail foi confirmado. Sua conta está pronta para acompanhar pedidos, projetos, cursos e materiais.',
   '/app',jsonb_build_object('source','confirmed_signup','customer_id',new.id))
 returning id into v_welcome;

 if public.wa_bridge_customer_eligible(new.id) then
   v_message := 'Olá, *'||v_first||'*! 👋'||E'\n\n'
    ||'*Boas-vindas à Sagamente!*'||E'\n\n'
    ||'Seu e-mail foi confirmado e sua conta está disponível. '
    ||'No seu painel você pode consultar pedidos, acompanhar projetos, acessar cursos, materiais, e-books e audiobooks.'
    ||E'\n\n🔗 *Acessar meu painel:*\n'
    ||'https://playsistem-oficial.playmomentsstudios.workers.dev/app'
    ||E'\n\nPara cancelar avisos pelo WhatsApp, acesse as configurações da sua conta.'
    ||E'\n\n*Equipe Sagamente*';
   insert into public.whatsapp_message_outbox(
     notification_id,recipient_user_id,recipient_name,destination_phone,event_type,
     title,message_body,target_link,status,source
   ) values (
     v_welcome,new.id,coalesce(nullif(v_name,''),'Cliente'),
     (select wa_opt_in_phone from public.user_preferences where user_id=new.id),
     'account_welcome','Boas-vindas à Sagamente!',v_message,
     '/app','ready_manual','live'
   ) on conflict(notification_id) do nothing;
 end if;

 insert into public.notifications(user_id,type,title,message,link,metadata)
 select admin.id,'new_customer_signup','Novo cliente cadastrado',
    'Novo cadastro confirmado: '||coalesce(nullif(v_name,''),'Cliente')||'.',
    '/admin/clientes/'||new.id::text,
    jsonb_build_object('source','confirmed_signup','customer_id',new.id)
 from public.profiles admin
 where admin.role='admin' and admin.status='active' and admin.id<>new.id;

 return new;
exception when others then
 raise warning 'customer_welcome_after_email_confirmation failed for a confirmed user: %',sqlstate;
 return new;
end $$;
drop trigger if exists on_customer_email_confirmed_welcome on auth.users;
create trigger on_customer_email_confirmed_welcome
after update of email_confirmed_at on auth.users
for each row when (old.email_confirmed_at is null and new.email_confirmed_at is not null)
execute function public.customer_welcome_after_email_confirmation();
revoke all on function public.customer_welcome_after_email_confirmation() from public,anon,authenticated;

-- Reuse the production WhatsApp bridge without changing existing throttles.
CREATE OR REPLACE FUNCTION public.wa_bridge_claim(p_instance uuid)
 RETURNS jsonb
 LANGUAGE plpgsql
 SET search_path TO ''
AS $function$
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
 -- Anti-burst limits, applied to both tests and real recipients.
 if exists(select 1 from public.whatsapp_bridge_attempts
    where claimed_at>now()-interval '1 minute') then return null; end if;
 if (select count(*) from public.whatsapp_bridge_attempts
    where claimed_at>now()-interval '1 hour')>=10 then return null; end if;
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
    or (
      o.event_type='account_welcome'
      and n.type='account_welcome'
      and n.user_id=o.recipient_user_id
      and public.wa_bridge_customer_eligible(o.recipient_user_id)
      and o.destination_phone=(
        select pref.wa_opt_in_phone from public.user_preferences pref
        where pref.user_id=o.recipient_user_id
      )
      and (cfg.wa_bridge_delivery_mode='consented_clients'
        or o.recipient_user_id=cfg.wa_bridge_single_customer_id)
      and exists (select 1 from public.customer_onboarding_events e where e.user_id=o.recipient_user_id)
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
end $function$;
revoke all on function public.wa_bridge_claim(uuid) from public,anon,authenticated;
grant execute on function public.wa_bridge_claim(uuid) to service_role;
