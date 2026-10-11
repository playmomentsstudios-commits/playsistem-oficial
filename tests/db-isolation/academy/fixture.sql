\set ON_ERROR_STOP on
-- Synthetic academy schema only. Run against LOCAL Supabase CLI PostgreSQL.
-- User IDs are reserved test fixtures, never real customer identities.
-- Do not modify the supplied Supabase auth schema or auth.uid().
create table public.profiles (
  id uuid primary key, role text not null, status text not null
);
create function public.is_active_admin() returns boolean
language sql stable security definer set search_path=public as $$
  select exists(
    select 1 from public.profiles
    where id=auth.uid() and role='admin' and status='active'
  )
$$;

create table public.course_enrollments(
  id uuid primary key, user_id uuid not null, student_id uuid not null,
  course_id uuid not null, curriculum_id uuid not null, status text not null,
  progress_percent numeric not null default 0, attendance_percent numeric,
  final_grade numeric, completed_at timestamptz
);
create table public.academy_curricula(
  id uuid primary key, academic_rules jsonb
);
create table public.course_modules(
  id uuid primary key, course_id uuid not null
);
create table public.course_lessons(
  id uuid primary key, module_id uuid not null, status text not null
);
create table public.lesson_progress(
  id bigserial primary key, enrollment_id uuid not null,
  lesson_id uuid not null, completed boolean not null
);
create table public.academy_assessments(
  id uuid primary key, module_id uuid not null,
  passing_percent numeric not null, status text not null
);
create table public.academy_attempts(
  id bigserial primary key, assessment_id uuid not null,
  user_id uuid not null, status text not null,
  snapshot jsonb not null, score numeric not null
);
create table public.academy_attendance(
  id bigserial primary key, enrollment_id uuid not null,
  attendance_type text not null, attended boolean not null
);
create table public.academy_events(
  id bigserial primary key, student_id uuid not null,
  enrollment_id uuid not null, event_type text not null,
  title text not null, metadata jsonb not null
);
create table public.notifications(
  id bigserial primary key, user_id uuid not null,
  type text not null, title text not null,
  message text not null, link text not null, metadata jsonb not null
);
create table public.courses(
  id uuid primary key, status text not null,
  certificate_enabled boolean not null
);
create table public.academy_certificates(
  id bigserial primary key,
  course_id uuid not null, user_id uuid not null,
  enrollment_id uuid not null, unique(course_id,user_id)
);

-- Stub establishes the identical SQL signature and return type that the real
-- PR #359 CREATE OR REPLACE FUNCTION will override.
create function public.academy_refresh_enrollment(uuid)
  returns public.course_enrollments language plpgsql security definer
  as $$ begin return null; end $$;
grant execute on function public.academy_refresh_enrollment(uuid)
  to public, anon, authenticated, service_role;

insert into public.profiles values
  ('10000000-0000-4000-8000-000000000001','customer','active'),
  ('10000000-0000-4000-8000-000000000002','customer','active'),
  ('10000000-0000-4000-8000-000000000003','admin','active'),
  ('10000000-0000-4000-8000-000000000004','admin','inactive');
insert into public.course_enrollments
  (id,user_id,student_id,course_id,curriculum_id,status,progress_percent,attendance_percent)
values
  ('70000000-0000-4000-8000-000000000001',
   '10000000-0000-4000-8000-000000000001',
   '10000000-0000-4000-8000-000000000001',
   '20000000-0000-4000-8000-000000000001',
   '30000000-0000-4000-8000-000000000001','active',5,0),
  ('70000000-0000-4000-8000-000000000002',
   '10000000-0000-4000-8000-000000000002',
   '10000000-0000-4000-8000-000000000002',
   '20000000-0000-4000-8000-000000000001',
   '30000000-0000-4000-8000-000000000001','active',5,0);
insert into public.academy_curricula values
  ('30000000-0000-4000-8000-000000000001',
   '{"attendance_required":true,"minimum_attendance_percent":80}');
insert into public.course_modules values
  ('40000000-0000-4000-8000-000000000001',
   '20000000-0000-4000-8000-000000000001');
insert into public.course_lessons values
  ('50000000-0000-4000-8000-000000000001',
   '40000000-0000-4000-8000-000000000001','published');
insert into public.lesson_progress(enrollment_id,lesson_id,completed) values
  ('70000000-0000-4000-8000-000000000001',
   '50000000-0000-4000-8000-000000000001',true);
insert into public.academy_assessments values
  ('60000000-0000-4000-8000-000000000001',
   '40000000-0000-4000-8000-000000000001',70,'published');
insert into public.academy_attempts(
  assessment_id,user_id,status,snapshot,score) values
  ('60000000-0000-4000-8000-000000000001',
   '10000000-0000-4000-8000-000000000001',
   'completed','[{"points":100}]',80);
insert into public.academy_attendance(enrollment_id,attendance_type,attended) values
  ('70000000-0000-4000-8000-000000000001','present',true),
  ('70000000-0000-4000-8000-000000000002','absent',false);
insert into public.courses values
  ('20000000-0000-4000-8000-000000000001','published',true);

do $$
begin
  if not has_function_privilege('anon',
     'public.academy_refresh_enrollment(uuid)','EXECUTE') then
    raise exception 'Fixture baseline missing anon permission';
  end if;
end $$;
