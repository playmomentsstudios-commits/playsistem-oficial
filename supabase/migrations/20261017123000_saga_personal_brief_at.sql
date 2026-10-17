-- Private, read-only Saga briefing. Only the sole active admin's created tasks.
create or replace function public.saga_personal_brief_at(p_at timestamptz default now())
returns jsonb language plpgsql stable security invoker set search_path='' as $$
declare
 local_clock timestamp;
 local_day date;
 hour_num int;
 admin_count int;
 admin_id uuid;
 task_total int;
 task_pending int;
 task_progress int;
 task_done int;
 task_late int;
 top_items text;
 period_name text;
 briefing text;
begin
 if p_at is null or not isfinite(p_at) then
  return jsonb_build_object('status','invalid_time');
 end if;
 local_clock:=p_at at time zone 'America/Sao_Paulo';
 local_day:=local_clock::date;
 hour_num:=extract(hour from local_clock)::int;
 if hour_num not in (7,13,19) then
  return jsonb_build_object('status','not_due');
 end if;
 select count(*)::int,min(id) into admin_count,admin_id
 from public.profiles where role='admin' and status='active';
 if admin_count<>1 then
  return jsonb_build_object('status','admin_scope_unavailable');
 end if;
 select count(*)::int,
 count(*) filter(where status='pending')::int,
 count(*) filter(where status='in_progress')::int,
 count(*) filter(where status='completed')::int,
 count(*) filter(where due_date<local_day and status not in ('completed','cancelled'))::int
 into task_total,task_pending,task_progress,task_done,task_late
 from public.tasks where created_by=admin_id;
 select string_agg(
  '• '||left(replace(replace(title,chr(10),' '),chr(13),' '),95)
  ||case when due_date is not null then ' — prazo '||to_char(due_date,'DD/MM') else '' end,
  E'\n' order by rank,due_date nulls last,created_at,id)
 into top_items
 from (
  select id,title,due_date,created_at,
  case when due_date<local_day then 0
  when priority='urgent' then 1
  when due_date=local_day then 2
  when priority='high' then 3
  when status='in_progress' then 4 else 5 end as rank
  from public.tasks where created_by=admin_id and status in ('pending','in_progress','review')
  order by rank,due_date nulls last,created_at,id limit 6
 ) ranked;
 period_name:=case hour_num when 7 then 'Planejamento'
  when 13 then 'Acompanhamento' else 'Fechamento' end;
 briefing:='Saga | '||period_name||' — '||to_char(local_day,'DD/MM/YYYY')||
  E'\n\n'||case hour_num when 7 then 'Organizei as prioridades de hoje.'
  when 13 then 'Conferi o andamento registrado das atividades.'
  else 'Preparei um panorama para o fechamento do dia.' end||
  E'\n\nTarefas registradas na gestão: '||task_total||
  '. Pendentes: '||task_pending||'. Em andamento: '||task_progress||
  '. Concluídas no cadastro: '||task_done||'. Atrasadas: '||task_late||'.'||
  E'\n\nPrioridades em aberto:'||E'\n'||
  coalesce(top_items,'Não encontrei tarefas em aberto neste recorte.')||
  E'\n\nDetalhes: /admin/produtividade'||E'\n— Saga';
 return jsonb_build_object(
 'status','ready','key','saga_personal_'||to_char(local_day,'YYYYMMDD')||
  '_'||lpad(hour_num::text,2,'0'),
 'title','Saga | '||period_name,'body',left(briefing,3500),
 'local_day',local_day::text,'slot',lpad(hour_num::text,2,'0'),
 'task_count',task_total,'pending',task_pending,'in_progress',task_progress,
 'overdue',task_late);
end $$;
revoke all on function public.saga_personal_brief_at(timestamptz) from public,anon,authenticated;
grant execute on function public.saga_personal_brief_at(timestamptz) to service_role;
