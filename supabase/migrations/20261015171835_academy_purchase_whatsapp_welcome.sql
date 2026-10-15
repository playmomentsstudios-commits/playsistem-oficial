-- Purchase-ready WhatsApp messages use the existing bridge and its consent/mode limits.
-- No historical purchases are broadcast by this migration.
create schema if not exists app_private;
grant usage on schema app_private to service_role;

create table if not exists app_private.academy_purchase_messages(
 purchase_id uuid primary key references public.academy_work_purchases(id) on delete cascade,
 notification_id uuid not null unique references public.notifications(id) on delete cascade,
 outbox_id uuid unique references public.whatsapp_message_outbox(id) on delete set null,
 created_at timestamptz not null default now()
);
alter table app_private.academy_purchase_messages enable row level security;
revoke all on app_private.academy_purchase_messages from public,anon,authenticated;
grant select on app_private.academy_purchase_messages to service_role;

create or replace function app_private.academy_queue_purchase_welcome(p_purchase_id uuid)
returns uuid language plpgsql security definer set search_path='' as $purchase$
declare
 v_order public.academy_work_purchases%rowtype;
 v_notice uuid; v_outbox uuid; v_name text; v_first text;
 v_title text; v_format text; v_message text;
begin
 -- Serialize the event even when a webhook, email confirmation and retry overlap.
 select * into v_order from public.academy_work_purchases where id=p_purchase_id for update;
 if not found or v_order.status<>'fulfilled' or v_order.paid_at is null
    or nullif(v_order.provider_transaction_nsu,'') is null then return null; end if;
 if not exists(select 1 from auth.users u join public.profiles p on p.id=u.id
    where u.id=v_order.user_id and u.email_confirmed_at is not null
    and lower(u.email)=lower(v_order.buyer_email)
    and p.role='customer' and p.status='active') then return null; end if;
 select notification_id into v_notice from app_private.academy_purchase_messages
 where purchase_id=p_purchase_id;
 if found then return v_notice; end if;

 select title into v_title from public.academy_library_works where id=v_order.work_id;
 select btrim(concat_ws(' ',nullif(first_name,''),nullif(last_name,''))) into v_name
 from public.profiles where id=v_order.user_id;
 v_first:=coalesce(nullif(split_part(v_name,' ',1),''),'cliente');
 v_first:=left(regexp_replace(v_first,'[^[:alnum:]À-ÿ -]','','g'),60);
 v_format:=case v_order.requested_format when 'ebook' then 'e-book'
   when 'audiobook' then 'audiobook' else 'combo de e-book e audiobook' end;
 v_message:='Olá, *'||v_first||'*! 👋'||E'\n\n'
  ||'*Pagamento confirmado!*'||E'\n\n'
  ||'Seu *'||v_format||'* de *'||coalesce(v_title,'sua obra')||'* já está disponível.'
  ||E'\n\n*Boas-vindas à Academia Sagamente!*'
  ||E'\n\nAcesse sua obra:\nhttps://academia-sagamente.playmomentsstudios.workers.dev/app/academia';

 insert into public.notifications(user_id,type,title,message,link,metadata)
 values(v_order.user_id,'academy_purchase_ready','Pagamento confirmado · sua obra está disponível',
   'Seu '||v_format||' de '||coalesce(v_title,'sua obra')||' já está na Minha Academia.',
   '/app/academia',jsonb_build_object('source','academy_purchase','purchase_id',v_order.id,'work_id',v_order.work_id))
 returning id into v_notice;

 if public.wa_bridge_customer_eligible(v_order.user_id) then
  insert into public.whatsapp_message_outbox(notification_id,recipient_user_id,recipient_name,
    destination_phone,event_type,title,message_body,target_link,status,source)
  select v_notice,v_order.user_id,coalesce(nullif(v_name,''),'Cliente'),pref.wa_opt_in_phone,
    'academy_purchase_ready','Pagamento confirmado · Academia Sagamente',v_message,
    '/app/academia','ready_manual','live'
  from public.user_preferences pref where pref.user_id=v_order.user_id
  returning id into v_outbox;
 end if;
 insert into app_private.academy_purchase_messages(purchase_id,notification_id,outbox_id)
 values(v_order.id,v_notice,v_outbox);
 return v_notice;
end $purchase$;
revoke all on function app_private.academy_queue_purchase_welcome(uuid) from public,anon,authenticated;
grant execute on function app_private.academy_queue_purchase_welcome(uuid) to service_role;

create or replace function app_private.academy_purchase_welcome_trigger()
returns trigger language plpgsql security definer set search_path='' as $purchase$
begin
 perform app_private.academy_queue_purchase_welcome(new.id);
 return new;
exception when others then
 -- Communication must never roll back paid content access or email verification.
 raise warning 'Academy purchase communication failed for %: %',new.id,sqlstate;
 return new;
end $purchase$;
revoke all on function app_private.academy_purchase_welcome_trigger() from public,anon,authenticated;
drop trigger if exists academy_purchase_welcome_ready on public.academy_work_purchases;
create trigger academy_purchase_welcome_ready after update of status on public.academy_work_purchases
for each row when(new.status='fulfilled' and old.status is distinct from new.status)
execute function app_private.academy_purchase_welcome_trigger();

-- Preserve the installed claim exactly; add only verified purchase-ready events.
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
      o.event_type='academy_purchase_ready' and n.type='academy_purchase_ready'
      and n.user_id=o.recipient_user_id
      and public.wa_bridge_customer_eligible(o.recipient_user_id)
      and o.destination_phone=(select pref.wa_opt_in_phone from public.user_preferences pref
        where pref.user_id=o.recipient_user_id)
      and (cfg.wa_bridge_delivery_mode='consented_clients'
        or o.recipient_user_id=cfg.wa_bridge_single_customer_id)
      and exists(select 1 from app_private.academy_purchase_messages m
        join public.academy_work_purchases p on p.id=m.purchase_id
        where m.outbox_id=o.id and m.notification_id=n.id
        and p.user_id=o.recipient_user_id and p.status='fulfilled'
        and p.paid_at is not null and nullif(p.provider_transaction_nsu,'') is not null
        and n.metadata->>'purchase_id'=p.id::text)
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
    or (
      o.event_type='automation_check_in' and n.type='automation_check_in'
      and n.user_id=o.recipient_user_id
      and public.wa_bridge_customer_eligible(o.recipient_user_id)
      and o.destination_phone='5562993241277'
      and o.destination_phone=(select pref.wa_opt_in_phone from public.user_preferences pref where pref.user_id=o.recipient_user_id)
      and (cfg.wa_bridge_delivery_mode='consented_clients' or o.recipient_user_id=cfg.wa_bridge_single_customer_id)
      and exists(select 1 from public.automation_events e
        join public.automation_flows f on f.id=e.flow_id
        join public.profiles p on p.id=f.recipient_user_id
        where e.outbox_id=o.id and e.notification_id=n.id and e.status='queued'
        and f.enabled and f.source='chatgpt'
        and f.recipient_user_id=o.recipient_user_id
        and lower(p.email)='eufedesigner@gmail.com' and p.role='customer' and p.status='active')
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
