-- Restore immutable certificate snapshots after strict public-flow rules.
begin;
create or replace function public.academy_issue_my_certificate(p_course_id uuid)
returns public.academy_certificates language plpgsql security definer set search_path=public as $$
declare
 v_enrollment public.course_enrollments; v_course public.courses; v_profile public.profiles;
 v_template public.academy_certificate_templates; v_total int; v_done int; v_required int; v_passed int;
 v_cert public.academy_certificates;
begin
 select * into v_course from public.courses where id=p_course_id and status='published';
 if not found or not coalesce(v_course.certificate_enabled,false) then raise exception 'Certificado não disponível para este curso.'; end if;
 if v_course.certificate_template_id is null then raise exception 'Selecione um modelo de certificado para este curso.'; end if;
 select * into v_template from public.academy_certificate_templates where id=v_course.certificate_template_id and status='active';
 if not found then raise exception 'O modelo de certificado deste curso não está ativo.'; end if;
 select * into v_enrollment from public.course_enrollments where course_id=p_course_id and user_id=auth.uid() and status in('active','completed') limit 1;
 if not found then raise exception 'Matrícula ativa não encontrada.'; end if;
 select * into v_profile from public.profiles where id=auth.uid();
 select count(*) into v_total from public.course_lessons l join public.course_modules m on m.id=l.module_id where m.course_id=p_course_id and l.status='published';
 select count(distinct lp.lesson_id) into v_done from public.lesson_progress lp join public.course_lessons l on l.id=lp.lesson_id join public.course_modules m on m.id=l.module_id where m.course_id=p_course_id and lp.enrollment_id=v_enrollment.id and lp.completed=true and l.status='published';
 if v_total=0 or v_done<v_total then raise exception 'Conclua todas as aulas antes de emitir o certificado.'; end if;
 select count(*) into v_required from public.academy_assessments a join public.course_modules m on m.id=a.module_id where m.course_id=p_course_id and a.status='published';
 select count(distinct a.id) into v_passed from public.academy_assessments a join public.course_modules m on m.id=a.module_id
 where m.course_id=p_course_id and a.status='published' and exists(
  select 1 from public.academy_attempts t where t.assessment_id=a.id and t.user_id=auth.uid() and t.status='completed'
  and t.score*100 >= greatest(1,(select coalesce(sum((q->>'points')::numeric),0) from jsonb_array_elements(t.snapshot) q))*a.passing_percent);
 if v_passed<v_required then raise exception 'Conclua todas as atividades e avaliações com aproveitamento mínimo antes de emitir o certificado.'; end if;
 insert into public.academy_certificates(course_id,user_id,enrollment_id,template_id,template_snapshot,student_name_snapshot,course_title_snapshot,course_hours_snapshot,completion_date_snapshot,pdf_drive_file_id,generated_at)
 values(p_course_id,auth.uid(),v_enrollment.id,v_template.id,to_jsonb(v_template),trim(concat_ws(' ',v_profile.first_name,v_profile.last_name)),v_course.title,v_course.certificate_hours,coalesce(v_enrollment.completed_at::date,current_date),null,null)
 on conflict(course_id,user_id) do update set
  enrollment_id=excluded.enrollment_id,
  template_id=case when academy_certificates.template_snapshot is null then excluded.template_id else academy_certificates.template_id end,
  template_snapshot=coalesce(academy_certificates.template_snapshot,excluded.template_snapshot),
  student_name_snapshot=coalesce(academy_certificates.student_name_snapshot,excluded.student_name_snapshot),
  course_title_snapshot=coalesce(academy_certificates.course_title_snapshot,excluded.course_title_snapshot),
  course_hours_snapshot=coalesce(academy_certificates.course_hours_snapshot,excluded.course_hours_snapshot),
  completion_date_snapshot=coalesce(academy_certificates.completion_date_snapshot,excluded.completion_date_snapshot),
  pdf_drive_file_id=case when academy_certificates.template_snapshot is null then null else academy_certificates.pdf_drive_file_id end,
  generated_at=case when academy_certificates.template_snapshot is null then null else academy_certificates.generated_at end
 returning * into v_cert;
 update public.course_enrollments set status='completed',completed_at=coalesce(completed_at,now()) where id=v_enrollment.id;
 return v_cert;
end $$;
grant execute on function public.academy_issue_my_certificate(uuid) to authenticated;
commit;
