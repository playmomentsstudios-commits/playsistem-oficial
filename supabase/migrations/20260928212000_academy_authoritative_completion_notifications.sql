-- Academy authoritative completion + safe notification type
begin;
create or replace function public.academy_refresh_enrollment(p_enrollment_id uuid)
returns public.course_enrollments language plpgsql security definer set search_path=public as $$
declare e public.course_enrollments%rowtype; v_lessons int; v_done int; v_assess int; v_passed int; v_avg numeric; v_progress numeric; v_complete boolean; v_was_completed boolean;
begin
 select * into e from public.course_enrollments where id=p_enrollment_id;
 if not found then raise exception 'Matrícula não encontrada'; end if;
 if auth.uid()<>e.user_id and not public.is_active_admin() then raise exception 'Acesso negado'; end if;
 v_was_completed=e.status='completed';
 select count(*),count(*) filter(where lp.completed) into v_lessons,v_done from public.course_lessons l join public.course_modules m on m.id=l.module_id left join public.lesson_progress lp on lp.lesson_id=l.id and lp.enrollment_id=e.id where m.course_id=e.course_id and l.status='published';
 select count(*),count(*) filter(where best_score>=passing_percent),avg(best_score) into v_assess,v_passed,v_avg from (select a.id,a.passing_percent,coalesce(max(case when at.status='completed' and coalesce((select sum((q->>'points')::numeric) from jsonb_array_elements(at.snapshot) q),0)>0 then at.score*100/(select sum((q->>'points')::numeric) from jsonb_array_elements(at.snapshot) q) end),0) best_score from public.academy_assessments a join public.course_modules m on m.id=a.module_id left join public.academy_attempts at on at.assessment_id=a.id and at.user_id=e.user_id where m.course_id=e.course_id and a.status='published' group by a.id,a.passing_percent) x;
 v_progress=case when v_lessons=0 then 0 else round((v_done::numeric/v_lessons)*100,2) end;
 v_complete=(v_lessons>0 and v_done=v_lessons and (v_assess=0 or v_passed=v_assess));
 update public.course_enrollments set progress_percent=v_progress,final_grade=case when v_assess>0 then round(v_avg,2) else final_grade end,status=case when v_complete then 'completed' when status='completed' and not v_complete then 'active' else status end,completed_at=case when v_complete then coalesce(completed_at,now()) when not v_complete then null else completed_at end where id=e.id returning * into e;
 if v_complete and not v_was_completed then
  insert into public.academy_events(student_id,enrollment_id,event_type,title,metadata) values(e.student_id,e.id,'course_completed','Curso concluído',jsonb_build_object('progress_percent',v_progress,'final_grade',e.final_grade));
  insert into public.notifications(user_id,type,title,message,link,metadata) values(e.user_id,'academy_course_completed','Curso concluído','Você concluiu o curso e já pode verificar a disponibilidade do certificado.','/app/academia/'||e.course_id,jsonb_build_object('course_id',e.course_id,'enrollment_id',e.id));
 end if;
 return e;
end $$;
create or replace function public.academy_issue_my_certificate(p_course_id uuid)
returns public.academy_certificates language plpgsql security definer set search_path=public as $$
declare e public.course_enrollments; c public.courses; cert public.academy_certificates;
begin
 select * into c from public.courses where id=p_course_id and status='published';
 if not found or not coalesce(c.certificate_enabled,false) then raise exception 'Certificado não disponível para este curso.'; end if;
 select * into e from public.course_enrollments where course_id=p_course_id and user_id=auth.uid() and status in ('active','completed') limit 1;
 if not found then raise exception 'Matrícula ativa não encontrada.'; end if;
 e:=public.academy_refresh_enrollment(e.id);
 if e.status<>'completed' then raise exception 'Conclua todas as etapas acadêmicas antes de emitir o certificado.'; end if;
 insert into public.academy_certificates(course_id,user_id,enrollment_id) values(p_course_id,auth.uid(),e.id) on conflict(course_id,user_id) do update set enrollment_id=excluded.enrollment_id returning * into cert;
 return cert;
end $$;
grant execute on function public.academy_refresh_enrollment(uuid),public.academy_issue_my_certificate(uuid) to authenticated;
commit;