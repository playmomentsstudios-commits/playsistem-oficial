-- Prevent anonymous or cross-student recalculation of academy program enrollment.
-- Keep authenticated self-service and administrator recalculation available.
create or replace function public.academy_refresh_program_enrollment(p_program_enrollment_id uuid)
returns public.academy_program_enrollments
language plpgsql
security definer
set search_path = public
as $function$
declare
  pe public.academy_program_enrollments%rowtype;
  total_required int;
  done_required int;
  pct numeric(5,2);
begin
  select *
  into pe
  from public.academy_program_enrollments
  where id = p_program_enrollment_id;

  if not found then
    raise exception 'Programa não encontrado';
  end if;

  if auth.uid() is null then
    raise exception 'Acesso negado' using errcode = '42501';
  end if;

  if not public.is_active_admin()
    and not exists (
      select 1
      from public.academy_students s
      where s.id = pe.student_id
        and s.profile_id = auth.uid()
    )
  then
    raise exception 'Acesso negado' using errcode = '42501';
  end if;

  select
    count(*),
    count(*) filter (
      where exists (
        select 1
        from public.course_enrollments ce
        join public.academy_students s on s.profile_id = ce.user_id
        where s.id = pe.student_id
          and ce.course_id = pc.course_id
          and ce.status = 'completed'
      )
    )
  into total_required, done_required
  from public.academy_program_courses pc
  where pc.program_id = pe.program_id
    and pc.requirement_type = 'required';

  pct := case
    when total_required = 0 then 0
    else round(done_required::numeric / total_required * 100, 2)
  end;

  update public.academy_program_enrollments
  set
    progress_percent = pct,
    status = case
      when total_required > 0 and done_required = total_required then 'completed'
      else 'active'
    end,
    completed_at = case
      when total_required > 0 and done_required = total_required then coalesce(completed_at, now())
      else null
    end
  where id = pe.id
  returning * into pe;

  return pe;
end
$function$;

-- The function is a self-service RPC for authenticated users; remove anonymous
-- and PUBLIC execution while retaining the explicit authenticated grant.
revoke execute on function public.academy_refresh_program_enrollment(uuid) from public, anon;
grant execute on function public.academy_refresh_program_enrollment(uuid) to authenticated;
