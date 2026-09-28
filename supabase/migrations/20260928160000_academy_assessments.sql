-- Optional module activities and evaluations. Answers and clocks are server controlled.
begin;
create table public.academy_assessments (
 id uuid primary key default gen_random_uuid(),
 module_id uuid not null references public.course_modules(id) on delete cascade,
 title text not null check(length(trim(title)) between 1 and 200),
 kind text not null check(kind in ('activity','evaluation')),
 instructions text not null default '',
 status text not null default 'draft' check(status in ('draft','published')),
 timed boolean not null default true,
 max_attempts integer not null default 2 check(max_attempts between 1 and 10),
 passing_percent integer not null default 70 check(passing_percent between 0 and 100),
 created_at timestamptz not null default now()
);
create table public.academy_questions (
 id uuid primary key default gen_random_uuid(),
 assessment_id uuid not null references public.academy_assessments(id) on delete cascade,
 prompt text not null,
 options jsonb not null,
 correct_option integer not null,
 points integer not null check(points between 1 and 100),
 seconds integer not null check(seconds between 15 and 3600),
 display_order integer not null,
 unique(assessment_id,display_order)
);
create table public.academy_attempts (
 id uuid primary key default gen_random_uuid(),
 assessment_id uuid not null references public.academy_assessments(id),
 user_id uuid not null references public.profiles(id),
 snapshot jsonb not null,
 timed boolean not null,
 passing_percent integer not null,
 position integer not null default 0,
 question_started_at timestamptz not null default clock_timestamp(),
 status text not null default 'in_progress' check(status in ('in_progress','completed')),
 score integer not null default 0,
 started_at timestamptz not null default now(),
 completed_at timestamptz
);
create unique index academy_one_active_attempt on public.academy_attempts(assessment_id,user_id) where status='in_progress';
create index academy_attempt_owner on public.academy_attempts(user_id,assessment_id);
create table public.academy_answers (
 attempt_id uuid not null references public.academy_attempts(id),
 position integer not null,
 selected_option integer,
 timed_out boolean not null,
 awarded_points integer not null,
 answered_at timestamptz not null default clock_timestamp(),
 primary key(attempt_id,position)
);
alter table public.academy_assessments enable row level security;
alter table public.academy_questions enable row level security;
alter table public.academy_attempts enable row level security;
alter table public.academy_answers enable row level security;
-- No direct client writes, including admins: validated RPCs serialize edits and attempts.
revoke all on public.academy_assessments,public.academy_questions,public.academy_attempts,public.academy_answers from anon,authenticated;
grant select on public.academy_assessments,public.academy_questions,public.academy_attempts,public.academy_answers to authenticated;
create policy assessments_admin_read on public.academy_assessments for select to authenticated using(public.is_active_admin());
create policy questions_admin_read on public.academy_questions for select to authenticated using(public.is_active_admin());
create policy attempts_admin_read on public.academy_attempts for select to authenticated using(public.is_active_admin());
create policy answers_admin_read on public.academy_answers for select to authenticated using(public.is_active_admin());
create policy assessments_student_read on public.academy_assessments for select to authenticated using (
 status='published' and exists(select 1 from public.profiles p where p.id=auth.uid() and p.status='active') and exists(select 1 from public.course_modules m join public.courses c on c.id=m.course_id join public.course_enrollments e on e.course_id=c.id
 where m.id=module_id and c.status='published' and e.user_id=auth.uid() and e.status in ('active','completed'))
);

create function public.academy_save_assessment(payload jsonb) returns uuid
language plpgsql security definer set search_path=public as $$
declare aid uuid; q jsonb; n integer:=0; opts jsonb;
begin
 if not public.is_active_admin() then raise exception 'Acesso administrativo necessário.'; end if;
 aid:=nullif(payload->>'id','')::uuid;
 if aid is not null then
  perform 1 from public.academy_assessments where id=aid for update;
  if not found then raise exception 'Atividade não encontrada.'; end if;
  if exists(select 1 from public.academy_attempts where assessment_id=aid) then raise exception 'Já há tentativas. Crie uma nova versão para preservar os resultados.'; end if;
 end if;
 if jsonb_typeof(payload->'questions') is distinct from 'array' then raise exception 'Informe as questões.'; end if;
 if jsonb_array_length(payload->'questions') not between 1 and 50 then raise exception 'Informe entre 1 e 50 questões.'; end if;
 if aid is null then
  insert into public.academy_assessments(module_id,title,kind,instructions,status,timed,max_attempts,passing_percent)
  values((payload->>'module_id')::uuid,trim(payload->>'title'),payload->>'kind',coalesce(payload->>'instructions',''),payload->>'status',(payload->>'timed')::boolean,(payload->>'max_attempts')::integer,(payload->>'passing_percent')::integer) returning id into aid;
 else
  update public.academy_assessments set title=trim(payload->>'title'),kind=payload->>'kind',instructions=coalesce(payload->>'instructions',''),status=payload->>'status',timed=(payload->>'timed')::boolean,max_attempts=(payload->>'max_attempts')::integer,passing_percent=(payload->>'passing_percent')::integer where id=aid;
  delete from public.academy_questions where assessment_id=aid;
 end if;
 for q in select value from jsonb_array_elements(payload->'questions') loop
  opts:=q->'options';
  if length(trim(coalesce(q->>'prompt',''))) not between 1 and 3000 or jsonb_typeof(opts) is distinct from 'array' then raise exception 'Questão inválida.'; end if;
  if jsonb_array_length(opts) not between 2 and 6 then raise exception 'Use de 2 a 6 alternativas.'; end if;
  if exists(select 1 from jsonb_array_elements(opts) o where jsonb_typeof(o) <> 'string' or length(trim(o#>>'{}')) not between 1 and 1000) then raise exception 'Preencha as alternativas.'; end if;
  if q->>'correct_option' is null or (q->>'correct_option')::integer not between 0 and jsonb_array_length(opts)-1 then raise exception 'Selecione a resposta correta.'; end if;
  insert into public.academy_questions(assessment_id,prompt,options,correct_option,points,seconds,display_order)
  values(aid,trim(q->>'prompt'),opts,(q->>'correct_option')::integer,(q->>'points')::integer,(q->>'seconds')::integer,n);
  n:=n+1;
 end loop;
 return aid;
end $$;

create function public.academy_set_assessment_status(assessment uuid, published boolean) returns void
language plpgsql security definer set search_path=public as $$
begin
 if not public.is_active_admin() then raise exception 'Acesso administrativo necessário.'; end if;
 perform 1 from public.academy_assessments where id=assessment for update;
 if not found then raise exception 'Atividade não encontrada.'; end if;
 if published and not exists(select 1 from public.academy_questions where assessment_id=assessment) then raise exception 'Cadastre as questões primeiro.'; end if;
 update public.academy_assessments set status=case when published then 'published' else 'draft' end where id=assessment;
end $$;

-- Private helper: never expose question snapshots or answer keys to the student.
create function public.academy_attempt_state(attempt uuid) returns jsonb
language plpgsql security definer set search_path=public as $$
declare a public.academy_attempts; q jsonb; total integer; maxpoints integer; used integer; allowed integer;
begin
 select * into strict a from public.academy_attempts where id=attempt;
 total:=jsonb_array_length(a.snapshot);
 select sum((x->>'points')::integer) into maxpoints from jsonb_array_elements(a.snapshot) x;
 select count(*) into used from public.academy_attempts where assessment_id=a.assessment_id and user_id=a.user_id;
 select max_attempts into allowed from public.academy_assessments where id=a.assessment_id;
 q:=a.snapshot->a.position;
 return jsonb_build_object('attempt_id',a.id,'status',a.status,'position',a.position,'total',total,'score',a.score,'max_score',maxpoints,'passing_percent',a.passing_percent,
  'passed',case when a.status='completed' then a.score*100 >= maxpoints*a.passing_percent else null end,
  'attempts_used',used,'max_attempts',allowed,'server_now',clock_timestamp(),
  'deadline',case when a.status='in_progress' and a.timed then a.question_started_at+make_interval(secs=>(q->>'seconds')::integer) else null end,
  'question',case when a.status='in_progress' then q-'correct_option' else null end,
  'answers',case when a.status='completed' then (select coalesce(jsonb_agg(jsonb_build_object('position',position,'timed_out',timed_out,'awarded_points',awarded_points) order by position),'[]'::jsonb) from public.academy_answers where attempt_id=a.id) else null end);
end $$;

-- answer_question is also used to acknowledge an expired question. Row locks make
-- concurrent tabs/retries idempotent; the caller must name the observed position.
create function public.academy_answer_question(attempt uuid, question_position integer, selected integer default null) returns jsonb
language plpgsql security definer set search_path=public as $$
declare a public.academy_attempts; q jsonb; expired boolean; earned integer; t timestamptz;
begin
 if not exists(select 1 from public.profiles p where p.id=auth.uid() and p.status='active') then raise exception 'Conta ativa necessária.'; end if;
 select * into a from public.academy_attempts where id=attempt and user_id=auth.uid() for update;
 if not found then raise exception 'Tentativa não encontrada.'; end if;
 if not exists(select 1 from public.academy_assessments s join public.course_modules m on m.id=s.module_id join public.courses c on c.id=m.course_id join public.course_enrollments e on e.course_id=c.id where s.id=a.assessment_id and s.status='published' and c.status='published' and e.user_id=auth.uid() and e.status in ('active','completed')) then raise exception 'Acesso indisponível.'; end if;
 if a.status='completed' or question_position < a.position then return public.academy_attempt_state(a.id); end if;
 if question_position is null or question_position <> a.position then raise exception 'Questão inválida. Retome a tentativa.'; end if;
 q:=a.snapshot->a.position; t:=clock_timestamp();
 expired:=a.timed and t >= a.question_started_at+make_interval(secs=>(q->>'seconds')::integer);
 if not expired and (selected is null or selected not between 0 and jsonb_array_length(q->'options')-1) then raise exception 'Selecione uma alternativa.'; end if;
 earned:=case when not expired and selected=(q->>'correct_option')::integer then (q->>'points')::integer else 0 end;
 insert into public.academy_answers(attempt_id,position,selected_option,timed_out,awarded_points) values(a.id,a.position,case when expired then null else selected end,expired,earned);
 update public.academy_attempts set position=position+1,score=score+earned,question_started_at=t,
 status=case when position+1=jsonb_array_length(snapshot) then 'completed' else 'in_progress' end,
 completed_at=case when position+1=jsonb_array_length(snapshot) then t else null end where id=a.id;
 return public.academy_attempt_state(a.id);
end $$;

create function public.academy_start_assessment(assessment uuid, new_attempt boolean default false) returns jsonb
language plpgsql security definer set search_path=public as $$
declare s public.academy_assessments; a public.academy_attempts; snapshot jsonb; used integer;
begin
 if auth.uid() is null or not exists(select 1 from public.profiles p where p.id=auth.uid() and p.status='active') then raise exception 'Conta ativa necessária.'; end if;
 select * into s from public.academy_assessments where id=assessment for update;
 if not found or s.status <> 'published' then raise exception 'Atividade indisponível.'; end if;
 if not exists(select 1 from public.course_modules m join public.courses c on c.id=m.course_id join public.course_enrollments e on e.course_id=c.id where m.id=s.module_id and c.status='published' and e.user_id=auth.uid() and e.status in ('active','completed')) then raise exception 'Matrícula ativa necessária.'; end if;
 select * into a from public.academy_attempts where assessment_id=s.id and user_id=auth.uid() order by started_at desc,id desc limit 1 for update;
 if found then
  if a.status='in_progress' then
   if a.timed and clock_timestamp() >= a.question_started_at+make_interval(secs=>((a.snapshot->a.position)->>'seconds')::integer) then
    return public.academy_answer_question(a.id,a.position,null);
   end if;
   return public.academy_attempt_state(a.id);
  end if;
  if not new_attempt then return public.academy_attempt_state(a.id); end if;
 end if;
 select count(*) into used from public.academy_attempts where assessment_id=s.id and user_id=auth.uid();
 if used >= s.max_attempts then raise exception 'Limite de tentativas atingido.'; end if;
 select jsonb_agg(jsonb_build_object('prompt',prompt,'options',options,'correct_option',correct_option,'points',points,'seconds',seconds) order by display_order) into snapshot from public.academy_questions where assessment_id=s.id;
 if snapshot is null then raise exception 'Esta atividade ainda não tem questões.'; end if;
 insert into public.academy_attempts(assessment_id,user_id,snapshot,timed,passing_percent) values(s.id,auth.uid(),snapshot,s.timed,s.passing_percent) returning * into a;
 return public.academy_attempt_state(a.id);
end $$;

revoke all on function public.academy_attempt_state(uuid) from public,anon,authenticated;
revoke all on function public.academy_save_assessment(jsonb),public.academy_set_assessment_status(uuid,boolean),public.academy_start_assessment(uuid,boolean),public.academy_answer_question(uuid,integer,integer) from public,anon,authenticated;
grant execute on function public.academy_save_assessment(jsonb),public.academy_set_assessment_status(uuid,boolean),public.academy_start_assessment(uuid,boolean),public.academy_answer_question(uuid,integer,integer) to authenticated;
commit;
