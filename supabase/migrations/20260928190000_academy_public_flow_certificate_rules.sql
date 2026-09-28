-- Public course structure + strict certificate eligibility.
begin;

create or replace function public.academy_public_course(course_slug text)
returns jsonb
language sql stable security definer set search_path=public as $$
  select jsonb_build_object(
    'course', to_jsonb(c),
    'modules', coalesce((
      select jsonb_agg(
        to_jsonb(m) || jsonb_build_object(
          'lessons', coalesce((
            select jsonb_agg(to_jsonb(l) order by l.display_order)
            from public.course_lessons l
            where l.module_id=m.id and l.status='published'
          ),'[]'::jsonb),
          'assessments', coalesce((
            select jsonb_agg(jsonb_build_object(
              'id',a.id,'title',a.title,'kind',a.kind,'timed',a.timed,'passing_percent',a.passing_percent
            ) order by a.created_at)
            from public.academy_assessments a
            where a.module_id=m.id and a.status='published'
          ),'[]'::jsonb)
        )
        order by m.display_order
      )
      from public.course_modules m where m.course_id=c.id
    ),'[]'::jsonb)
  )
  from public.courses c
  where c.slug=course_slug and c.status='published' and c.access_type='free'
  limit 1
$$;

revoke all on function public.academy_public_course(text) from public;
grant execute on function public.academy_public_course(text) to anon,authenticated;

create or replace function public.academy_issue_my_certificate(p_course_id uuid)
returns public.academy_certificates
language plpgsql security definer set search_path=public
as $$
declare
  v_enrollment public.course_enrollments;
  v_course public.courses;
  v_total int;
  v_done int;
  v_required int;
  v_passed int;
  v_cert public.academy_certificates;
begin
  select * into v_course from public.courses where id=p_course_id and status='published';
  if not found or not coalesce(v_course.certificate_enabled,false) then
    raise exception 'Certificado não disponível para este curso.';
  end if;

  select * into v_enrollment
  from public.course_enrollments
  where course_id=p_course_id and user_id=auth.uid() and status in ('active','completed')
  limit 1;
  if not found then raise exception 'Matrícula ativa não encontrada.'; end if;

  select count(*) into v_total
  from public.course_lessons l
  join public.course_modules m on m.id=l.module_id
  where m.course_id=p_course_id and l.status='published';

  select count(distinct lp.lesson_id) into v_done
  from public.lesson_progress lp
  join public.course_lessons l on l.id=lp.lesson_id
  join public.course_modules m on m.id=l.module_id
  where m.course_id=p_course_id
    and lp.enrollment_id=v_enrollment.id
    and lp.completed=true
    and l.status='published';

  if v_total=0 or v_done<v_total then
    raise exception 'Conclua todas as aulas antes de emitir o certificado.';
  end if;

  -- Toda atividade e toda avaliação publicada é obrigatória para certificação.
  select count(*) into v_required
  from public.academy_assessments a
  join public.course_modules m on m.id=a.module_id
  where m.course_id=p_course_id and a.status='published';

  select count(distinct a.id) into v_passed
  from public.academy_assessments a
  join public.course_modules m on m.id=a.module_id
  where m.course_id=p_course_id
    and a.status='published'
    and exists(
      select 1
      from public.academy_attempts t
      where t.assessment_id=a.id
        and t.user_id=auth.uid()
        and t.status='completed'
        and t.score*100 >= greatest(
          1,
          (select coalesce(sum((q->>'points')::numeric),0) from jsonb_array_elements(t.snapshot) q)
        )*a.passing_percent
    );

  if v_passed<v_required then
    raise exception 'Conclua todas as atividades e avaliações com aproveitamento mínimo antes de emitir o certificado.';
  end if;

  insert into public.academy_certificates(course_id,user_id,enrollment_id)
  values(p_course_id,auth.uid(),v_enrollment.id)
  on conflict(course_id,user_id) do update set enrollment_id=excluded.enrollment_id
  returning * into v_cert;

  update public.course_enrollments
  set status='completed',completed_at=coalesce(completed_at,now())
  where id=v_enrollment.id;

  return v_cert;
end $$;

grant execute on function public.academy_issue_my_certificate(uuid) to authenticated;

commit;
