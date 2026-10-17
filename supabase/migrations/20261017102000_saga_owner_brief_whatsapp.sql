-- Saga personal operational briefs — independent of RKC and customer project digests.
-- First release: ONE pre-authorized test customer receives the admin owner's summary.
-- Safe defaults: disabled. Authorizations are rechecked again at Baileys claim.
create table if not exists public.saga_owner_brief_settings (
 id boolean primary key default true check (id),
 enabled boolean not null default false,
 recipient_user_id uuid not null references public.profiles(id),
 updated_at timestamptz not null default now()
);
insert into public.saga_owner_brief_settings(id,recipient_user_id)
select true,p.id from public.profiles p
where lower(p.email)='eufedesigner@gmail.com'
and p.role='customer' and p.status='active'
and public.wa_bridge_customer_eligible(p.id)
and exists(select 1 from public.user_preferences u where u.user_id=p.id
  and u.notify_project_updates and u.wa_automatic_opt_in and u.wa_opt_in_at is not null)
on conflict(id) do nothing;
alter table public.saga_owner_brief_settings enable row level security;
revoke all on public.saga_owner_brief_settings from public,anon,authenticated;
grant select,update on public.saga_owner_brief_settings to service_role;

-- Static allowlist of operational projects; avoids duplicating RKC check-ins.
create table if not exists public.saga_owner_brief_projects(
 project_id uuid primary key references public.projects(id) on delete cascade
);
insert into public.saga_owner_brief_projects(project_id)
select id from public.projects
where lower(title) like 'sagamente%' or project_type='design'
on conflict do nothing;
alter table public.saga_owner_brief_projects enable row level security;
revoke all on public.saga_owner_brief_projects from public,anon,authenticated;
grant select,insert,delete on public.saga_owner_brief_projects to service_role;

create table if not exists public.saga_owner_brief_runs(
 id uuid primary key default gen_random_uuid(),
 local_day date not null,
 slot text not null check(slot in ('07:00','13:00','19:00','test')),
 recipient_user_id uuid not null references public.profiles(id),
 status text not null default 'queued' check(status in ('queued','cancelled')),
 notification_id uuid not null unique references public.notifications(id) on delete cascade,
 outbox_id uuid unique references public.whatsapp_message_outbox(id) on delete set null,
 created_at timestamptz not null default now(),
 unique(local_day,slot,recipient_user_id)
);
alter table public.saga_owner_brief_runs enable row level security;
revoke all on public.saga_owner_brief_runs from public,anon,authenticated;
grant select,insert,update on public.saga_owner_brief_runs to service_role;

-- The existing wa_bridge_claim calls this immediately before claiming a message.
-- Changes to opt-in, registered phone, system flags or recipient deny the claim.
create or replace function public.saga_owner_brief_claim_allowed(p_outbox uuid)
returns boolean language sql stable security invoker set search_path='' as $$
select exists (
 select 1 from public.saga_owner_brief_runs r
 join public.saga_owner_brief_settings s on s.id=true
     and s.enabled and s.recipient_user_id=r.recipient_user_id
 join public.sagamente_assistant_settings cfg on cfg.id=true
     and cfg.enabled and cfg.whatsapp_notifications
 join public.saga_digest_runtime_controls controls on controls.id=true
     and controls.prepare_enabled is false and controls.dispatch_enabled is false
 join public.whatsapp_message_outbox o on o.id=r.outbox_id
     and o.id=p_outbox and o.event_type='saga_owner_brief'
     and o.status='ready_manual' and o.source='live'
     and o.recipient_user_id=r.recipient_user_id
     and o.notification_id=r.notification_id
 join public.notifications n on n.id=r.notification_id
     and n.type='saga_owner_brief' and n.user_id=r.recipient_user_id
     and n.metadata->>'saga_owner_brief_run_id'=r.id::text
 join public.profiles p on p.id=r.recipient_user_id
     and p.role='customer' and p.status='active'
     and lower(p.email)='eufedesigner@gmail.com'
 join public.user_preferences pref on pref.user_id=p.id
     and pref.notify_project_updates=true
     and pref.wa_automatic_opt_in=true and pref.wa_opt_in_at is not null
     and o.destination_phone=pref.wa_opt_in_phone
 join public.app_settings app on app.id=true
     and app.wa_bridge_auto_enabled
     and app.wa_bridge_delivery_mode in ('consented_clients','single_client')
     and (app.wa_bridge_delivery_mode='consented_clients'
       or app.wa_bridge_single_customer_id=p.id)
 where r.status='queued'
   and public.wa_bridge_customer_eligible(p.id)
);
$$;
revoke all on function public.saga_owner_brief_claim_allowed(uuid) from public,anon,authenticated;
grant execute on function public.saga_owner_brief_claim_allowed(uuid) to service_role;

-- A fresh, owner-facing digest from operational tasks, not a customer project
-- update. Uses per-slot unique key; never treats counts as 'completed today'.
create or replace function public.saga_owner_brief_tick(p_test boolean default false)
returns jsonb language plpgsql volatile security invoker set search_path='' as $$
declare
 cfg public.sagamente_assistant_settings%rowtype;
 setting public.saga_owner_brief_settings%rowtype;
 controls public.saga_digest_runtime_controls%rowtype;
 recipient public.profiles%rowtype;
 v_day date; v_clock text; v_slot text; v_title text; v_message text;
 v_total integer; v_pending integer; v_progress integer;
 v_done integer; v_overdue integer; v_today integer;
 v_top text; v_notice uuid; v_admin uuid; v_outbox uuid; v_id uuid;
 v_dest text;
begin
 select * into cfg from public.sagamente_assistant_settings where id=true for update;
 select * into setting from public.saga_owner_brief_settings where id=true for update;
 select * into controls from public.saga_digest_runtime_controls where id=true;
 if cfg.enabled is distinct from true or cfg.whatsapp_notifications is distinct from true
    or setting.enabled is distinct from true
    or controls.prepare_enabled is distinct from false
    or controls.dispatch_enabled is distinct from false then
   return jsonb_build_object('status','disabled');
 end if;
 if cfg.timezone <> 'America/Sao_Paulo' then
   return jsonb_build_object('status','wrong_timezone');
 end if;
 v_day := (now() at time zone cfg.timezone)::date;
 v_clock := to_char(now() at time zone cfg.timezone,'HH24:MI');
 if p_test is true then
    v_slot := 'test';
 elsif v_clock in ('07:00','13:00','19:00')
    and v_clock = any(cfg.digest_times) then
    v_slot := v_clock;
 else
    return jsonb_build_object('status','not_due');
 end if;
 if exists(select 1 from public.saga_owner_brief_runs
           where local_day=v_day and slot=v_slot and recipient_user_id=setting.recipient_user_id) then
    return jsonb_build_object('status','duplicate','slot',v_slot);
 end if;
 select * into recipient from public.profiles where id=setting.recipient_user_id;
 if recipient.role<>'customer' or recipient.status<>'active'
   or lower(recipient.email)<>'eufedesigner@gmail.com'
   or not public.wa_bridge_customer_eligible(recipient.id)
   or not exists (select 1 from public.user_preferences pref
     where pref.user_id=recipient.id and pref.notify_project_updates=true) then
    return jsonb_build_object('status','recipient_not_authorized');
 end if;
 select wa_opt_in_phone into v_dest
 from public.user_preferences where user_id=recipient.id;
 if v_dest is null or v_dest !~ '^55[0-9]{10,11}$' then
   return jsonb_build_object('status','invalid_destination');
 end if;
 if not exists(select 1 from public.profiles where role='admin' and status='active') then
   return jsonb_build_object('status','no_active_admin');
 end if;
 select count(*),
 count(*) filter(where t.status='pending'),
 count(*) filter(where t.status in ('in_progress','review')),
 count(*) filter(where t.status='completed'),
 count(*) filter(where t.due_date<v_day and t.status not in ('completed','cancelled')),
 count(*) filter(where t.due_date=v_day and t.status not in ('completed','cancelled'))
 into v_total,v_pending,v_progress,v_done,v_overdue,v_today
 from public.tasks t join public.saga_owner_brief_projects scope on scope.project_id=t.project_id;
 select string_agg('• '||left(regexp_replace(task.title,E'[\r\n]+',' ','g'),120)
    ||case when task.due_date is null then ''
      else ' · prazo '||to_char(task.due_date,'DD/MM') end,
    E'\n' order by task.rank,task.due_date nulls last,task.title)
 into v_top from (
   select t.title,t.due_date,
     case when t.due_date<v_day then 0 when t.priority='urgent' then 1
       when t.priority='high' then 2 when t.due_date<=v_day+1 then 3 else 4 end as rank
   from public.tasks t join public.saga_owner_brief_projects scope on scope.project_id=t.project_id
   where t.status in ('pending','in_progress','review')
   order by rank,t.due_date nulls last,t.title limit 4
 ) task;
 v_title := 'Saga | '||case v_slot when '07:00' then 'Prioridades da manhã'
    when '13:00' then 'Acompanhamento do dia'
    when '19:00' then 'Fechamento do dia'
    else 'Teste do resumo operacional' end;
 v_message := case when v_slot='07:00' then 'Bom dia! Conferi as suas tarefas no Play Sistem.'
     when v_slot='13:00' then 'Boa tarde! Consultei o andamento das suas tarefas.'
     when v_slot='19:00' then 'Boa noite! Preparei o panorama das suas tarefas.'
     else '[TESTE DA SAGA] Preparei um resumo com os dados atuais do Play Sistem.'
   end||E'\n\n'
   ||format('Tarefas no escopo Saga: %s. Pendentes: %s. Em andamento/revisão: %s. Concluídas no cadastro: %s.',
             v_total,v_pending,v_progress,v_done)
   ||format(E'\nVencidas: %s. Com prazo hoje: %s.',v_overdue,v_today)
   ||case when v_top is not null then E'\n\nMinhas prioridades sugeridas:\n'||v_top
      else E'\n\nNão encontrei tarefas abertas neste escopo.' end
   ||E'\n\nConfira e atualize os cartões em /admin/produtividade.'
   ||E'\n\n— Saga';
 v_id:=gen_random_uuid();
 insert into public.notifications(user_id,type,title,message,link,metadata)
 values(recipient.id,'saga_owner_brief',v_title,v_message,'/admin/produtividade',
   jsonb_build_object('source','saga_owner_brief','saga_owner_brief_run_id',v_id))
 returning id into v_notice;
 insert into public.saga_owner_brief_runs(id,local_day,slot,recipient_user_id,
    status,notification_id)
 values(v_id,v_day,v_slot,recipient.id,'queued',v_notice);
 insert into public.whatsapp_message_outbox(notification_id,recipient_user_id,
    recipient_name,destination_phone,event_type,title,message_body,target_link,status,source)
 values(v_notice,recipient.id,'Cadastro de teste Saga',v_dest,
    'saga_owner_brief',v_title,v_message,'/admin/produtividade','ready_manual','live')
 returning id into v_outbox;
 update public.saga_owner_brief_runs set outbox_id=v_outbox where id=v_id;
 -- Admin portal gets the same factual brief without joining the WhatsApp outbox.
 for v_admin in select id from public.profiles where role='admin' and status='active'
 loop
   insert into public.notifications(user_id,type,title,message,link,metadata)
   values(v_admin,'system',v_title,v_message,'/admin/produtividade',
    jsonb_build_object('source','saga_owner_brief','saga_owner_brief_run_id',v_id));
 end loop;
 return jsonb_build_object('status','queued','slot',v_slot,'run_id',v_id,'outbox_id',v_outbox);
end;
$$;
revoke all on function public.saga_owner_brief_tick(boolean) from public,anon,authenticated;
grant execute on function public.saga_owner_brief_tick(boolean) to service_role;

-- Extend the *currently installed* claim function, preserving every pre-existing
-- project, payment, RKC and other permitted branch byte-for-byte.
do $$
declare f text; anchor text; amendment text;
begin
 f:=pg_get_functiondef('public.wa_bridge_claim(uuid)'::regprocedure);
 if position('saga_owner_brief_claim_allowed' in f)>0 then
   raise exception 'Saga claim branch already installed; review manually';
 end if;
 anchor:=E'\n  )\n order by o.created_at,o.id limit 1 for update of o skip locked;';
 if position(anchor in f)=0 then
   raise exception 'wa_bridge_claim changed; do NOT patch blindly';
 end if;
 amendment:=E'\n    or (\n      o.event_type=''saga_owner_brief''\n      and public.saga_owner_brief_claim_allowed(o.id)\n    )';
 execute replace(f,anchor,amendment||anchor);
 if position('saga_owner_brief_claim_allowed' in
    pg_get_functiondef('public.wa_bridge_claim(uuid)'::regprocedure))=0 then
   raise exception 'Saga bridge claim patch not present';
 end if;
end $$;
