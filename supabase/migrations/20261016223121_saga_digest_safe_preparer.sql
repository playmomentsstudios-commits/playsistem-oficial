-- Saga digest preparer V3. Existing Bridge / RKC untouched.
-- Server-only preview + idempotent DRAFT preparation; sends NOTHING.
-- Explicit secondary kill-switches stay false. No cron, no outbound RPC.
create table if not exists public.saga_digest_runtime_controls (
 id boolean primary key default true check (id),
 prepare_enabled boolean not null default false,
 dispatch_enabled boolean not null default false,
 updated_at timestamptz not null default now()
);
insert into public.saga_digest_runtime_controls(id) values (true)
on conflict(id) do nothing;
alter table public.saga_digest_runtime_controls enable row level security;
revoke all on public.saga_digest_runtime_controls from public, anon, authenticated;
grant select, update on public.saga_digest_runtime_controls to service_role;

-- The preview may run while the agent is OFF; callers must be trusted service_role.
-- Never invoke from the browser or expose to authenticated/anon.
create or replace function public.saga_digest_preview_at(p_at timestamptz default now())
returns jsonb language plpgsql stable security invoker set search_path = '' as $$
declare
 cfg public.sagamente_assistant_settings%rowtype;
 v_day date;
 v_hour integer;
 v_clock text;
 v_start timestamptz;
 v_end timestamptz;
 v_slot text;
 v_drafts jsonb := '[]'::jsonb;
begin
 if p_at is null or not isfinite(p_at) then
  return jsonb_build_object('status','invalid_time','drafts','[]'::jsonb);
 end if;
 select * into cfg from public.sagamente_assistant_settings where id=true;
 if not found or cfg.timezone<>'America/Sao_Paulo' then
  return jsonb_build_object('status','invalid_settings','drafts','[]'::jsonb);
 end if;
 v_day := (p_at at time zone cfg.timezone)::date;
 v_clock := to_char(p_at at time zone cfg.timezone,'HH24:MI');
 if v_clock not in ('07:00','13:00','19:00')
   or not v_clock = any(cfg.digest_times) then
  return jsonb_build_object('status','not_scheduled','drafts','[]'::jsonb);
 end if;
 v_hour := split_part(v_clock,':',1)::integer;
 v_slot := case v_hour when 7 then 'morning' when 13 then 'midday' else 'evening' end;
 v_start := (case v_hour when 7 then v_day::timestamp - interval '5 hours'
   when 13 then v_day::timestamp + interval '7 hours'
   else v_day::timestamp + interval '13 hours' end) at time zone cfg.timezone;
 v_end := (v_day::timestamp + make_interval(hours=>v_hour)) at time zone cfg.timezone;

 select coalesce(jsonb_agg(jsonb_build_object(
  'recipient_user_id', s.recipient_user_id,
  'key', 'saga:digest:'||v_day::text||':'||lpad(v_hour::text,2,'0')||':'||s.recipient_user_id::text,
  'slot', v_slot, 'local_day',v_day::text,
  'event_ids',to_jsonb(s.event_ids),
  'title','Saga | '||case v_hour when 7 then 'Planejamento'
    when 13 then 'Acompanhamento' else 'Fechamento' end||' — '||v_day::text,
  'message','Saga | '||case v_hour when 7 then 'Planejamento'
    when 13 then 'Acompanhamento' else 'Fechamento' end||' — '||v_day::text
      ||E'\n'||s.body
  ) order by s.recipient_user_id),'[]'::jsonb)
 into v_drafts
 from (
  select recipient.id as recipient_user_id,
   array_agg(e.id order by e.created_at,e.id) as event_ids,
   string_agg('• '||left(e.title,120)||': '||left(e.message,240),
       E'\n' order by e.created_at,e.id) as body,
   count(*) as n
  from public.sagamente_assistant_events e
  join public.project_stages stage on stage.id=e.source_id
   and stage.client_visible is true
  join public.projects project on project.id=stage.project_id
   and project.project_type<>'internal'
  join public.profiles recipient on recipient.role='customer'
   and recipient.status='active'
   and (project.customer_id=recipient.id or exists(
     select 1 from public.project_customer_access access
     where access.project_id=project.id and access.customer_id=recipient.id
   ))
  join public.user_preferences pref on pref.user_id=recipient.id
   and pref.notify_project_updates is true
   and pref.wa_automatic_opt_in is true and pref.wa_opt_in_at is not null
   and pref.wa_opt_in_phone ~ '^55[0-9]{10,11}$'
  where e.event_type='project_stage_status'
   and e.source_table='project_stages'
   and e.created_at>=v_start and e.created_at<v_end
   and e.created_at<=p_at
   and public.wa_bridge_customer_eligible(recipient.id)
  group by recipient.id
  having count(*) between 1 and 30
 ) s;

 return jsonb_build_object('status','preview_only','slot',v_slot,
  'local_day',v_day::text,'window_start',v_start,'window_end',v_end,
  'drafts',v_drafts);
end $$;
revoke all on function public.saga_digest_preview_at(timestamptz)
 from public, anon, authenticated;
grant execute on function public.saga_digest_preview_at(timestamptz) to service_role;

-- Writes DRAFT ledger rows only, never notifications/outbox/WhatsApp.
-- Off unless BOTH the original Saga enabled flag and a separate preparer
-- switch are enabled by a trusted backend. A dispatch switch is prohibited.
create or replace function public.saga_digest_prepare_tick(p_at timestamptz default now())
returns jsonb language plpgsql volatile security invoker set search_path = '' as $$
declare
 cfg public.sagamente_assistant_settings%rowtype;
 ctrl public.saga_digest_runtime_controls%rowtype;
 report jsonb;
 item jsonb;
 v_ids uuid[];
 v_inserted integer := 0;
 v_slot text;
 v_day date;
begin
 select * into cfg from public.sagamente_assistant_settings where id=true;
 select * into ctrl from public.saga_digest_runtime_controls where id=true;
 if not found or cfg.enabled is distinct from true
  or cfg.whatsapp_notifications is distinct from false
  or ctrl.prepare_enabled is distinct from true
  or ctrl.dispatch_enabled is distinct from false then
  return jsonb_build_object('status','disabled','inserted',0);
 end if;
 -- No replaying arbitrary dates through an automated worker.
 if p_at is null or abs(extract(epoch from (now()-p_at)))>90 then
  return jsonb_build_object('status','invalid_clock','inserted',0);
 end if;
 report := public.saga_digest_preview_at(p_at);
 if report->>'status' <> 'preview_only' then
  return jsonb_build_object('status',report->>'status','inserted',0);
 end if;
 v_slot := report->>'slot';
 v_day := (report->>'local_day')::date;
 for item in select value from jsonb_array_elements(report->'drafts')
 loop
  select array_agg(event_id::uuid) into v_ids
    from jsonb_array_elements_text(item->'event_ids') as elem(event_id);
  if coalesce(array_length(v_ids,1),0)<1 then continue; end if;
  insert into public.saga_digest_runs(slot,local_day,recipient_user_id,
      state,content,event_ids)
  values(v_slot,v_day,(item->>'recipient_user_id')::uuid,
      'draft',jsonb_build_object('title',item->>'title',
      'message',item->>'message','key',item->>'key'),v_ids)
  on conflict(slot,local_day,recipient_user_id) do nothing;
  if found then v_inserted:=v_inserted+1; end if;
 end loop;
 return jsonb_build_object('status','drafts_prepared','inserted',v_inserted,
  'slot',v_slot,'local_day',v_day::text);
end $$;
revoke all on function public.saga_digest_prepare_tick(timestamptz)
 from public,anon,authenticated;
grant execute on function public.saga_digest_prepare_tick(timestamptz) to service_role;

comment on table public.saga_digest_runtime_controls is
 'Independent backend-only kill switches. Both disabled by default; WhatsApp dispatch not implemented.';
