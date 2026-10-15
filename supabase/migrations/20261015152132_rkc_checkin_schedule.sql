-- Backend-owned test schedule. Local timezone determines slots; no AI/research is fabricated.
create table public.automation_schedules(
 flow_id uuid primary key references public.automation_flows(id),
 project_id uuid not null references public.projects(id),
 timezone text not null default 'America/Sao_Paulo' check(timezone='America/Sao_Paulo'),
 weekdays integer[] not null default array[1,2,3,4,5,6] check(weekdays=array[1,2,3,4,5,6]),
 hours integer[] not null default array[8,13,18] check(hours=array[8,13,18]),
 enabled boolean not null default true,
 created_at timestamptz not null default now()
);
alter table public.automation_schedules enable row level security;
revoke all on public.automation_schedules from public,anon,authenticated;
grant select on public.automation_schedules to authenticated;
grant select,insert,update on public.automation_schedules to service_role;
create policy automation_schedules_admin_read on public.automation_schedules
 for select to authenticated using(public.current_user_is_admin());
insert into public.automation_schedules(flow_id,project_id)
select f.id,p.id from public.automation_flows f cross join public.projects p
where f.event_key='rkc_felipe' and p.title='RKC — Captação, Seleção e Gestão de Editais 2026–2027';

create schema if not exists app_private;
grant usage on schema app_private to service_role;
create or replace function app_private.rkc_checkin_tick(p_at timestamptz default now(),p_dispatch boolean default true)
returns jsonb language plpgsql security invoker set search_path='' as $$
declare s record; v_local timestamp; v_hour integer; v_key text;
 v_notice uuid;
 v_intro text; v_tasks text; v_body text; v_title text; v_result jsonb;
 v_results jsonb:='[]'::jsonb;
begin
 if p_at is null or p_dispatch is null then raise exception 'Invalid scheduler arguments' using errcode='22023'; end if;
 for s in select a.*,f.event_key from public.automation_schedules a
  join public.automation_flows f on f.id=a.flow_id
  where a.enabled and f.enabled and f.event_key='rkc_felipe'
  for update of a loop
  v_local:=p_at at time zone s.timezone;
  v_hour:=extract(hour from v_local)::integer;
  if not (extract(isodow from v_local)::integer=any(s.weekdays))
   or not(v_hour=any(s.hours)) or extract(minute from v_local)<>0 then continue; end if;
  v_key:='rkc:scheduled:'||to_char(v_local,'YYYY-MM-DD')||':'||lpad(v_hour::text,2,'0');
  if p_dispatch and exists(select 1 from public.automation_events where idempotency_key=v_key) then
   v_results:=v_results||jsonb_build_array(jsonb_build_object('key',v_key,'duplicate',true));continue;
  end if;
  v_title:=case v_hour when 8 then 'RKC — início do dia' when 13 then 'RKC — check-in da tarde' else 'RKC — fechamento do dia' end;
  v_intro:=case v_hour
   when 8 then 'Bom dia, Felipe! Revise as prioridades e os prazos de hoje.'
   when 13 then 'Felipe, como avançou a manhã? Atualize o que concluiu e escolha a próxima ação da tarde.'
   else 'Felipe, faça o balanço do dia: entregas concluídas, pendências e prioridades para amanhã.' end;
  select string_agg('• '||t.title||case when t.due_date is not null then ' — prazo cadastrado: '||to_char(t.due_date,'DD/MM/YYYY') else '' end,E'\n' order by t.due_date nulls last,t.title)
  into v_tasks from (
   select left(regexp_replace(title,E'[\r\n]+',' ','g'),160) title,due_date
   from public.tasks where project_id=s.project_id and status not in ('completed','done','cancelled','canceled')
   order by due_date nulls last,position,created_at limit 5
  )t;
  v_body:=v_title||E'\n\n'||v_intro||E'\n\n'||case when v_tasks is null
   then 'Nenhuma pendência aberta registrada no projeto RKC.'
   else E'Pendências registradas no Play Sistem:\n'||v_tasks end
   ||E'\n\nTeste de check-in agendado · Sagamente';
  if p_dispatch then
   v_result:=public.automation_enqueue_for_flow(s.event_key,v_key,v_title,v_body);
   update public.automation_events set source_payload=jsonb_build_object(
    'origin','play_sistem_scheduler','scheduled_local',v_local,'timezone',s.timezone)
   where idempotency_key=v_key returning notification_id into v_notice;
   update public.notifications set metadata=metadata||jsonb_build_object('source','play_sistem_scheduler') where id=v_notice;
  else v_result:=jsonb_build_object('status','preview','message',v_body); end if;
  v_results:=v_results||jsonb_build_array(jsonb_build_object('key',v_key,'result',v_result));
 end loop;
 return jsonb_build_object('slots',v_results);
end $$;
revoke all on function app_private.rkc_checkin_tick(timestamptz,boolean) from public,anon,authenticated;
grant execute on function app_private.rkc_checkin_tick(timestamptz,boolean) to service_role;

-- Hourly wake-up, three local slots Mon–Sat. No other cron job is changed.
-- The local-time guard also handles timezone changes and excludes Sundays.
select cron.schedule('play-rkc-checkin-test','0 * * * *','select app_private.rkc_checkin_tick();');
