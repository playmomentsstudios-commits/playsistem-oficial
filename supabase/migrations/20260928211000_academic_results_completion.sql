-- Academic V1 results, completion and record consolidation
begin;
create or replace function public.academy_refresh_enrollment(p_enrollment_id uuid)
returns public.course_enrollments language plpgsql security definer set search_path=public as $$
declare e public.course_enrollments%rowtype; v_lessons int; v_done int; v_assess int; v_passed int; v_avg numeric; v_progress numeric; v_complete boolean;
begin
 select * into e from public.course_enrollments where id=p_enrollment_id;
 if not found then raise exception 'Matrícula não encontrada'; end if;
 if auth.uid()<>e.user_id and not public.is_active_admin() then raise exception 'Acesso negado'; end if;
 select count(*),count(*) filter(where lp.completed) into v_lessons,v_done from public.course_lessons l join public.course_modules m on m.id=l.module_id left join public.lesson_progress lp on lp.lesson_id=l.id and lp.enrollment_id=e.id where m.course_id=e.course_id and l.status='published';
 select count(*),count(*) filter(where best_score>=passing_percent),avg(best_score) into v_assess,v_passed,v_avg from (select a.id,a.passing_percent,coalesce(max(at.score) filter(where at.status='completed'),0) best_score from public.academy_assessments a join public.course_modules m on m.id=a.module_id left join public.academy_attempts at on at.assessment_id=a.id and at.user_id=e.user_id where m.course_id=e.course_id and a.status='published' group by a.id,a.passing_percent) x;
 v_progress=case when v_lessons=0 then 0 else round((v_done::numeric/v_lessons)*100,2) end;
 v_complete=(v_done=v_lessons and v_lessons>0 and (v_assess=0 or v_passed=v_assess));
 update public.course_enrollments set progress_percent=v_progress,final_grade=case when v_assess>0 then round(v_avg,2) else final_grade end,status=case when v_complete then 'completed' else status end,completed_at=case when v_complete then coalesce(completed_at,now()) else completed_at end where id=e.id returning * into e;
 if v_complete and not exists(select 1 from public.academy_events where enrollment_id=e.id and event_type='course_completed') then insert into public.academy_events(student_id,enrollment_id,event_type,title,metadata) values(e.student_id,e.id,'course_completed','Curso concluído',jsonb_build_object('progress_percent',v_progress,'final_grade',e.final_grade)); end if;
 return e;
end $$;
create or replace function public.academy_refresh_my_enrollments() returns setof public.course_enrollments language sql security definer set search_path=public as $$ select public.academy_refresh_enrollment(e.id) from public.course_enrollments e where e.user_id=auth.uid() $$;
grant execute on function public.academy_refresh_enrollment(uuid) to authenticated;
grant execute on function public.academy_refresh_my_enrollments() to authenticated;
commit;