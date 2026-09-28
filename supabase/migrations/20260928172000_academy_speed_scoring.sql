-- Award correct timed answers by response speed: 0-15s=100%, >15-30s=90%, >30s=80%.
begin;
create or replace function public.academy_answer_question(attempt uuid, question_position integer, selected integer default null) returns jsonb
language plpgsql security definer set search_path=public as $$
declare a public.academy_attempts; q jsonb; expired boolean; earned integer; t timestamptz; elapsed numeric; base_points integer;
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
 base_points:=(q->>'points')::integer;
 elapsed:=extract(epoch from (t-a.question_started_at));
 earned:=case
   when expired or selected<>(q->>'correct_option')::integer then 0
   when not a.timed then base_points
   when elapsed<=15 then base_points
   when elapsed<=30 then greatest(1,round(base_points*0.9)::integer)
   else greatest(1,round(base_points*0.8)::integer)
 end;
 insert into public.academy_answers(attempt_id,position,selected_option,timed_out,awarded_points) values(a.id,a.position,case when expired then null else selected end,expired,earned);
 update public.academy_attempts set position=position+1,score=score+earned,question_started_at=t,
 status=case when position+1=jsonb_array_length(snapshot) then 'completed' else 'in_progress' end,
 completed_at=case when position+1=jsonb_array_length(snapshot) then t else null end where id=a.id;
 return public.academy_attempt_state(a.id);
end $$;
revoke all on function public.academy_answer_question(uuid,integer,integer) from public,anon,authenticated;
grant execute on function public.academy_answer_question(uuid,integer,integer) to authenticated;
commit;
