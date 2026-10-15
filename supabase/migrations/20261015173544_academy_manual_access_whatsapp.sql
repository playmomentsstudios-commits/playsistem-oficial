-- Manual access changes are atomic and emit one notice for newly activated formats.
-- Existing grants are not replayed and payments are never inferred from manual access.
create table if not exists app_private.academy_manual_access_events(
 id uuid primary key default gen_random_uuid(),
 user_id uuid not null references public.profiles(id) on delete cascade,
 work_id uuid not null references public.academy_library_works(id) on delete cascade,
 item_ids uuid[] not null,
 granted_by uuid references auth.users(id) on delete set null,
 notification_id uuid unique references public.notifications(id) on delete set null,
 outbox_id uuid unique references public.whatsapp_message_outbox(id) on delete set null,
 created_at timestamptz not null default now(),
 cancelled_at timestamptz
);
alter table app_private.academy_manual_access_events enable row level security;
revoke all on app_private.academy_manual_access_events from public,anon,authenticated;
grant select on app_private.academy_manual_access_events to service_role;

create or replace function public.academy_admin_set_library_access(
 p_item_ids uuid[],p_user_id uuid,p_active boolean
) returns jsonb language plpgsql security definer set search_path='' as $access$
declare
 v_actor uuid:=auth.uid(); v_work uuid; v_count integer; v_works integer;
 v_item record; v_was_active boolean; v_changed uuid[]:='{}'; v_ready uuid[];
 v_formats text[]; v_name text; v_first text; v_title text; v_label text;
 v_event uuid; v_notice uuid; v_outbox uuid; v_message text;
 v_profile public.profiles%rowtype;
begin
 if v_actor is null or not public.is_active_admin() then
  raise exception 'Somente administradores ativos podem liberar materiais.' using errcode='42501';
 end if;
 if p_active is null or p_user_id is null or p_item_ids is null
    or cardinality(p_item_ids) not between 1 and 2 then
  raise exception 'Selecione um cliente e um ou dois formatos válidos.' using errcode='22023';
 end if;
 -- Serialize repeated requests for the same customer, including double clicks.
 select * into v_profile from public.profiles where id=p_user_id and role='customer' for update;
 if not found or (p_active and v_profile.status<>'active') then
  raise exception 'Cliente não encontrado ou inativo.' using errcode='22023';
 end if;
 select count(*),count(distinct work_id),(array_agg(work_id))[1]
 into v_count,v_works,v_work from public.academy_library_items where id=any(p_item_ids);
 if v_count<>cardinality(p_item_ids) or v_works<>1 or exists(
  select 1 from public.academy_library_items where id=any(p_item_ids) and work_id is null
 ) then raise exception 'Os formatos devem pertencer à mesma obra.' using errcode='22023'; end if;

 for v_item in select id from public.academy_library_items where id=any(p_item_ids) order by id loop
  select active into v_was_active from public.academy_library_grants
   where item_id=v_item.id and user_id=p_user_id for update;
  if p_active and coalesce(v_was_active,false) is false then
   insert into public.academy_library_grants(item_id,user_id,active,source,granted_at)
   values(v_item.id,p_user_id,true,'admin',now())
   on conflict(item_id,user_id) do update set active=true,source='admin',granted_at=now();
   v_changed:=array_append(v_changed,v_item.id);
  elsif not p_active and v_was_active is true then
   update public.academy_library_grants set active=false where item_id=v_item.id and user_id=p_user_id;
   v_changed:=array_append(v_changed,v_item.id);
  end if;
 end loop;
 if cardinality(v_changed)=0 then
  return jsonb_build_object('changed_count',0,'whatsapp_queued',false,'notification_status','unchanged');
 end if;
 if not p_active then
  -- A pending release message must not survive a revoke/reactivate cycle.
  update app_private.academy_manual_access_events set cancelled_at=now()
   where user_id=p_user_id and item_ids&&v_changed and cancelled_at is null;
  update public.whatsapp_message_outbox o set archived_at=now(),archived_by=v_actor
   from app_private.academy_manual_access_events e
   where e.outbox_id=o.id and e.user_id=p_user_id and e.item_ids&&v_changed
     and e.cancelled_at is not null and o.status='ready_manual';
  return jsonb_build_object('changed_count',cardinality(v_changed),'whatsapp_queued',false,'notification_status','revoked');
 end if;

 select array_agg(id order by format),array_agg(format order by format) into v_ready,v_formats
 from public.academy_library_items where id=any(v_changed)
   and status in('published','private_beta') and nullif(btrim(drive_file_id),'') is not null;
 if coalesce(cardinality(v_ready),0)=0 then
  return jsonb_build_object('changed_count',cardinality(v_changed),'whatsapp_queued',false,'notification_status','content_unavailable');
 end if;
 select title into v_title from public.academy_library_works where id=v_work;
 v_name:=btrim(concat_ws(' ',nullif(v_profile.first_name,''),nullif(v_profile.last_name,'')));
 v_first:=coalesce(nullif(split_part(v_name,' ',1),''),'cliente');
 v_first:=left(regexp_replace(v_first,'[^[:alnum:]À-ÿ -]','','g'),60);
 v_label:=case when cardinality(v_formats)=2 then 'e-book e audiobook'
   when v_formats[1]='ebook' then 'e-book' else 'audiobook' end;
 v_event:=gen_random_uuid();
 v_message:='Olá, *'||v_first||'*! 👋'||E'\n\n*Acesso liberado!*\n\n'
  ||'Seu acesso a *'||coalesce(v_title,'sua obra')||'* foi liberado na Academia Sagamente.'
  ||E'\n\nFormato: *'||v_label||'*'
  ||E'\n\nAcesse sua obra:\nhttps://academia-sagamente.playmomentsstudios.workers.dev/app/academia';
 insert into public.notifications(user_id,type,title,message,link,metadata)
 values(p_user_id,'academy_access_granted','Seu acesso foi liberado',
  coalesce(v_title,'Sua obra')||' · '||v_label||' disponível na Minha Academia.',
  '/app/academia',jsonb_build_object('source','academy_manual_access','access_event_id',v_event,'work_id',v_work))
 returning id into v_notice;
 if public.wa_bridge_customer_eligible(p_user_id) then
  insert into public.whatsapp_message_outbox(notification_id,recipient_user_id,recipient_name,
   destination_phone,event_type,title,message_body,target_link,status,source)
  select v_notice,p_user_id,coalesce(nullif(v_name,''),'Cliente'),pref.wa_opt_in_phone,
   'academy_access_granted','Acesso liberado · Academia Sagamente',v_message,'/app/academia','ready_manual','live'
  from public.user_preferences pref where pref.user_id=p_user_id returning id into v_outbox;
 end if;
 insert into app_private.academy_manual_access_events
  (id,user_id,work_id,item_ids,granted_by,notification_id,outbox_id)
 values(v_event,p_user_id,v_work,v_ready,v_actor,v_notice,v_outbox);
 return jsonb_build_object('changed_count',cardinality(v_changed),'whatsapp_queued',v_outbox is not null,
  'notification_status',case when v_outbox is null then 'no_consent' else 'queued' end,'notification_id',v_notice);
end $access$;
revoke all on function public.academy_admin_set_library_access(uuid[],uuid,boolean) from public,anon,authenticated;
grant execute on function public.academy_admin_set_library_access(uuid[],uuid,boolean) to authenticated;

-- Add only the audited manual-access lane; keep the installed payment, project,
-- signup, automation, consent, pilot and pacing rules intact.
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
      o.event_type='academy_access_granted' and n.type='academy_access_granted'
      and n.user_id=o.recipient_user_id
      and public.wa_bridge_customer_eligible(o.recipient_user_id)
      and o.destination_phone=(select pref.wa_opt_in_phone from public.user_preferences pref
        where pref.user_id=o.recipient_user_id)
      and (cfg.wa_bridge_delivery_mode='consented_clients'
        or o.recipient_user_id=cfg.wa_bridge_single_customer_id)
      and exists(select 1 from app_private.academy_manual_access_events e
        where e.outbox_id=o.id and e.notification_id=n.id and e.user_id=o.recipient_user_id
          and e.cancelled_at is null and n.metadata->>'access_event_id'=e.id::text
          and not exists(select 1 from unnest(e.item_ids) as target(item_id)
            where not exists(select 1 from public.academy_library_grants g
              where g.item_id=target.item_id and g.user_id=e.user_id and g.active)))
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
