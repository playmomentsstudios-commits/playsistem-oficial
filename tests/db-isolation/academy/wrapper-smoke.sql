-- Test-only wrapper for learner-owned refresh.
create or replace function public.academy_refresh_my_enrollments()
returns setof public.course_enrollments language sql security definer set search_path=public as $$
 select public.academy_refresh_enrollment(e.id) from public.course_enrollments e where e.user_id=auth.uid()
$$;
