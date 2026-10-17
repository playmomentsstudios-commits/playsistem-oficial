-- Saga operational briefing V4: internal task summary to a single pre-authorized test contact.
-- Existing RKC and normal WhatsApp notification flows remain independent.
alter table public.saga_digest_runs drop constraint if exists saga_digest_runs_slot_check;
alter table public.saga_digest_runs add constraint saga_digest_runs_slot_check
check (slot in ('morning','midday','evening','test'));
alter table public.saga_digest_runs
 add column if not exists notification_id uuid references public.notifications(id),
 add column if not exists outbox_id uuid references public.whatsapp_message_outbox(id);

create table if not exists public.saga_operational_recipients(
 recipient_user_id uuid primary key references public.profiles(id),
 enabled boolean not null default false,
 created_at timestamptz not null default now()
);
alter table public.saga_operational_recipients enable row level security;
revoke all on public.saga_operational_recipients from public,anon,authenticated;
grant select,insert,update on public.saga_operational_recipients to service_role;

-- Only the explicitly requested test account is seeded. No other customers.
insert into public.saga_operational_recipients(recipient_user_id,enabled)
select p.id,true from public.profiles p
where lower(p.email)='eufedesigner@gmail.com'
  and p.role='customer' and p.status='active'
  and public.wa_bridge_customer_eligible(p.id)
  and exists (select 1 from public.user_preferences pref
    where pref.user_id=p.id and pref.notify_project_updates=true)
on conflict (recipient_user_id) do nothing;

create or replace function public.saga_operational_report(p_slot text,p_at timestamptz default now())
returns jsonb
language plpgsql stable security invoker set search_path='' as $saga$
declare
 v_today date:=(p_at at time zone 'America/Sao_Paulo')::date;
 v_total bigint;v_pending bigint;v_progress bigint;v_overdue bigint;
 v_due bigint;v_completed bigint;v_priorities text;
 v_label text;v_message text;
begin
 if p_at is null or not isfinite(p_at) or p_slot not in ('morning','midday','evening','test') then
  return jsonb_build_object('status','invalid_input');
 end if;
 select count(*),count(*) filter (where t.status='pending'),
  count(*) filter (where t.status='in_progress'),
  count(*) filter (where t.status not in ('completed','cancelled') and t.due_date<v_today),
  count(*) filter (where t.status not in ('completed','cancelled') and t.due_date=v_today),
  count(*) filter (where t.status='completed')
 into v_total,v_pending,v_progress,v_overdue,v_due,v_completed
 from public.tasks t;
 select string_agg('• '||left(regexp_replace(t.title,'[\r\n]',' ','g'),100)
   ||' ('||case when t.due_date<v_today then 'atrasada'
        when t.due_date=v_today then 'vence hoje'
        when t.priority='urgent' then 'urgente'
        else 'prioritária' end||')',E'\n' order by
      case when t.due_date<v_today then 0 when t.due_date=v_today then 1
       when t.priority='urgent' then 2 else 3 end,t.due_date nulls last,t.id)
 into v_priorities from (
  select id,title,due_date,priority from public.tasks
  where status not in ('completed','cancelled')
   and (due_date<=v_today or priority in ('urgent','high'))
  order by case when due_date<v_today then 0 when due_date=v_today then 1
     when priority='urgent' then 2 else 3 end, due_date nulls last,id
  limit 5
 ) t;
 v_label:=case p_slot when 'morning' then 'Planejamento das 7h'
   when 'midday' then 'Acompanhamento das 13h'
   when 'evening' then 'Fechamento das 19h' else 'Teste de integração' end;
 v_message:= case p_slot when 'morning'
      then 'Bom dia! Preparei suas prioridades com base nas tarefas cadastradas.'
     when 'midday'
      then 'Atualizei o acompanhamento das tarefas do Play Sistem.'
     when 'evening'
      then 'Preparei seu fechamento do dia com a situação registrada no sistema.'
     else 'Este é meu teste de envio automático, com dados reais do Play Sistem.' end
   ||E'\n\n'||format('Tarefas cadastradas: %s | Pendentes: %s | Em andamento: %s | Concluídas (total): %s',
       v_total,v_pending,v_progress,v_completed)
   ||E'\n'||format('Atrasadas: %s | Vencem hoje: %s',v_overdue,v_due)
   ||E'\n\nPrioridades registradas:\n'||coalesce(v_priorities,'• Nenhuma tarefa urgente ou com prazo vencido/hoje registrada.')
   ||E'\n\nConfira e atualize o andamento no Play Sistem: /admin/produtividade';
 return jsonb_build_object('status','ok','title','Saga | '||v_label,
  'message',v_message,'total',v_total,'pending',v_pending,'in_progress',v_progress,
  'completed',v_completed,'overdue',v_overdue,'due_today',v_due);
end $saga$;
revoke all on function public.saga_operational_report(text,timestamptz) from public,anon,authenticated;
grant execute on function public.saga_operational_report(text,timestamptz) to service_role;

-- Runs every minute, but prepares only at the three configured local clock minutes.
-- Draft retries are allowed for two hours when Baileys comes back online.
-- A single 'test' slot may be requested explicitly by service_role for E2E QA.
create or replace function public.saga_operational_tick(p_test boolean default false)
returns jsonb language plpgsql security invoker set search_path='' as $saga$
declare
 settings public.sagamente_assistant_settings%rowtype;
 controls public.saga_digest_runtime_controls%rowtype;
 bridge_cfg public.app_settings%rowtype;
 bridge public.whatsapp_bridge_state%rowtype;
 recipient record; run_row record; draft jsonb;
 v_local timestamp:=now() at time zone 'America/Sao_Paulo';
 v_day date:=v_local::date;
 v_clock text:=to_char(v_local,'HH24:MI');
 v_slot text; v_created integer:=0;v_queued integer:=0;
 v_notice uuid;v_outbox uuid;v_phone text;v_name text;
begin
 -- Serialize scheduler and manual QA to avoid two simultaneous sends.
 if not pg_try_advisory_xact_lock(424201701) then
  return jsonb_build_object('status','busy');
 end if;
 select * into settings from public.sagamente_assistant_settings where id=true;
 select * into controls from public.saga_digest_runtime_controls where id=true;
 if settings.enabled is distinct from true or settings.whatsapp_notifications is distinct from true
 or settings.timezone<>'America/Sao_Paulo' or controls.prepare_enabled is distinct from true
 or controls.dispatch_enabled is distinct from true then
  return jsonb_build_object('status','disabled','created',0,'queued',0);
 end if;
 if p_test then v_slot:='test';
 elsif v_clock=any(settings.digest_times) then
  v_slot:=case v_clock when '07:00' then 'morning'
    when '13:00' then 'midday' when '19:00' then 'evening' end;
 end if;

 if v_slot is not null then
   draft:=public.saga_operational_report(v_slot,now());
   if draft->>'status'<>'ok' then return jsonb_build_object('status','report_failed'); end if;
   for recipient in
    select p.id as recipient_id from public.saga_operational_recipients a
    join public.profiles p on p.id=a.recipient_user_id
    where a.enabled and lower(p.email)='eufedesigner@gmail.com'
      and p.role='customer' and p.status='active'
      and public.wa_bridge_customer_eligible(p.id)
      and exists(select 1 from public.user_preferences pref
       where pref.user_id=p.id and pref.notify_project_updates is true)
   loop
    insert into public.saga_digest_runs(slot,local_day,recipient_user_id,state,content,event_ids)
     values(v_slot,v_day,recipient.recipient_id,'draft',
      jsonb_build_object('kind','saga_operational_digest',
         'title',draft->>'title','message',draft->>'message'),'{}'::uuid[])
     on conflict (slot,local_day,recipient_user_id) do nothing;
    if found then v_created:=v_created+1; end if;
   end loop;
 end if;

 select * into bridge_cfg from public.app_settings where id=true;
 select * into bridge from public.whatsapp_bridge_state where id=true;
 if bridge_cfg.wa_bridge_auto_enabled is distinct from true
  or bridge_cfg.wa_bridge_delivery_mode<>'consented_clients'
  or bridge_cfg.wa_bridge_auto_started_at is null
  or bridge_cfg.wa_bridge_daily_limit<1
  or bridge.status<>'connected' or bridge.requested_mode<>'connect'
  or bridge.heartbeat_at<now()-interval '35 seconds'
  or bridge.connected_phone is distinct from bridge_cfg.wa_bridge_sender_phone then
   return jsonb_build_object('status','waiting_bridge','created',v_created,'queued',0);
 end if;

 for run_row in
   select r.id,r.slot,r.local_day,r.recipient_user_id,r.content,r.created_at
   from public.saga_digest_runs r
   join public.saga_operational_recipients a on a.recipient_user_id=r.recipient_user_id and a.enabled
   where r.state='draft' and r.content->>'kind'='saga_operational_digest'
   order by r.created_at,r.id for update of r skip locked limit 3
 loop
  if run_row.created_at<now()-interval '2 hours' then
   update public.saga_digest_runs set state='cancelled' where id=run_row.id;
   continue;
  end if;
  select pref.wa_opt_in_phone,
      coalesce(nullif(btrim(concat_ws(' ',p.first_name,p.last_name)),''),'Destinatário')
   into v_phone,v_name
   from public.profiles p join public.user_preferences pref on pref.user_id=p.id
   where p.id=run_row.recipient_user_id
     and lower(p.email)='eufedesigner@gmail.com'
     and p.role='customer' and p.status='active'
     and pref.notify_project_updates and pref.wa_automatic_opt_in
     and pref.wa_opt_in_at is not null
     and public.wa_bridge_customer_eligible(p.id);
  if not found then
    update public.saga_digest_runs set state='cancelled' where id=run_row.id;
    continue;
  end if;
  insert into public.notifications(user_id,type,title,message,link,metadata)
   values(run_row.recipient_user_id,'saga_operational_digest',run_row.content->>'title',
     run_row.content->>'message','/admin/produtividade',
     jsonb_build_object('source','saga_operational','saga_run_id',run_row.id))
   returning id into v_notice;
  insert into public.whatsapp_message_outbox(
      notification_id,recipient_user_id,recipient_name,destination_phone,
      event_type,title,message_body,target_link,status,source)
   values(v_notice,run_row.recipient_user_id,v_name,v_phone,
     'saga_operational_digest',run_row.content->>'title',
     run_row.content->>'message','/admin/produtividade','ready_manual','live')
   returning id into v_outbox;
  update public.saga_digest_runs set state='queued',
    notification_id=v_notice,outbox_id=v_outbox where id=run_row.id;
  v_queued:=v_queued+1;
 end loop;
 return jsonb_build_object('status','ok','created',v_created,'queued',v_queued,
  'slot',v_slot);
end $saga$;
revoke all on function public.saga_operational_tick(boolean) from public,anon,authenticated;
grant execute on function public.saga_operational_tick(boolean) to service_role;
