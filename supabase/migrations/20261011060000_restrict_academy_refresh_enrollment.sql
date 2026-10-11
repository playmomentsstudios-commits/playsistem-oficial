-- P0-SEC-02: prevent anonymous callers from recalculating arbitrary enrollments.
-- Keep authenticated self-service, active-admin access, and owner-level internal callers.
revoke execute on function public.academy_refresh_enrollment(uuid) from public, anon;

create or replace function public.academy_refresh_enrollment(p_enrollment_id uuid)
returns public.course_enrollments
language plpgsql
security definer
set search_path to 'public'
as $function$
declare
  e public.course_enrollments%rowtype;
  v_lessons int;
  v_done int;
  v_assess int;
  v_passed int;
  v_avg numeric;
  v_progress numeric;
  v_complete boolean;
  v_was_completed boolean;
  v_rules jsonb;
  v_attendance_required boolean;
  v_min_attendance numeric;
  v_attendance numeric;
begin
  select * into e from public.course_enrollments where id=p_enrollment_id;
  if not found then raise exception 'Matrícula não encontrada'; end if;

  -- auth.uid() is NULL for anon. An IF condition evaluating to NULL does not
  -- enter the branch, so make the unauthenticated case explicit.
  if auth.uid() is null
     or (auth.uid() <> e.user_id and not public.is_active_admin()) then
    raise exception 'Acesso negado' using errcode='42501';
  end if;

  v_was_completed=e.status='completed';
  select coalesce(c.academic_rules,'{}'::jsonb) into v_rules
    from public.academy_curricula c where c.id=e.curriculum_id;
  v_attendance_required=coalesce((v_rules->>'attendance_required')::boolean,false);
  v_min_attendance=coalesce((v_rules->>'minimum_attendance_percent')::numeric,0);

  select count(*),count(*) filter(where lp.completed)
    into v_lessons,v_done
  from public.course_lessons l
  join public.course_modules m on m.id=l.module_id
  left join public.lesson_progress lp on lp.lesson_id=l.id and lp.enrollment_id=e.id
  where m.course_id=e.course_id and l.status='published';

  select count(*),count(*) filter(where best_score>=passing_percent),avg(best_score)
    into v_assess,v_passed,v_avg
  from (
    select a.id,a.passing_percent,
      coalesce(max(case
        when at.status='completed'
         and coalesce((select sum((q->>'points')::numeric) from jsonb_array_elements(at.snapshot) q),0)>0
        then at.score*100/(select sum((q->>'points')::numeric) from jsonb_array_elements(at.snapshot) q)
      end),0) best_score
    from public.academy_assessments a
    join public.course_modules m on m.id=a.module_id
    left join public.academy_attempts at on at.assessment_id=a.id and at.user_id=e.user_id
    where m.course_id=e.course_id and a.status='published'
    group by a.id,a.passing_percent
  ) x;

  v_progress=case when v_lessons=0 then 0 else round((v_done::numeric/v_lessons)*100,2) end;
  select case when count(*)=0 then null
    else round(100.0*count(*) filter(where attended)/count(*),2) end
    into v_attendance
  from public.academy_attendance
  where enrollment_id=e.id and attendance_type in('present','absent','justified','participation');
  if v_attendance is null and not v_attendance_required then
    v_attendance=e.attendance_percent;
  end if;

  v_complete=(v_lessons>0 and v_done=v_lessons and (v_assess=0 or v_passed=v_assess)
    and (not v_attendance_required or coalesce(v_attendance,0)>=v_min_attendance));
  update public.course_enrollments
  set progress_percent=v_progress,
      attendance_percent=v_attendance,
      final_grade=case when v_assess>0 then round(v_avg,2) else final_grade end,
      status=case when v_complete then 'completed' when status='completed' and not v_complete then 'active' else status end,
      completed_at=case when v_complete then coalesce(completed_at,now()) when not v_complete then null else completed_at end
  where id=e.id returning * into e;

  if v_complete and not v_was_completed then
    insert into public.academy_events(student_id,enrollment_id,event_type,title,metadata)
    values(e.student_id,e.id,'course_completed','Curso concluído',
      jsonb_build_object('progress_percent',v_progress,'final_grade',e.final_grade,'attendance_percent',e.attendance_percent));
    insert into public.notifications(user_id,type,title,message,link,metadata)
    values(e.user_id,'academy_course_completed','Curso concluído',
      'Você concluiu o curso e já pode verificar a disponibilidade do certificado.',
      '/app/academia/'||e.course_id,
      jsonb_build_object('course_id',e.course_id,'enrollment_id',e.id));
  end if;
  return e;
end
$function$;
