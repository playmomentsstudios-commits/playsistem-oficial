-- Academy V1 #198 — programs and learning paths
begin;
create table if not exists public.academy_programs (
 id uuid primary key default gen_random_uuid(), name text not null, slug text not null unique,
 description text, program_type text not null default 'path' check(program_type in('path','technical','undergraduate','postgraduate','extension','other')),
 status text not null default 'draft' check(status in('draft','active','archived')),
 final_requirement text, created_by uuid references public.profiles(id) on delete set null,
 created_at timestamptz not null default now(), updated_at timestamptz not null default now()
);
create table if not exists public.academy_program_courses (
 id uuid primary key default gen_random_uuid(), program_id uuid not null references public.academy_programs(id) on delete cascade,
 course_id uuid not null references public.courses(id) on delete restrict, position integer not null default 0,
 requirement_type text not null default 'required' check(requirement_type in('required','elective')),
 prerequisite_course_id uuid references public.courses(id) on delete restrict, created_at timestamptz not null default now(),
 unique(program_id,course_id)
);
create table if not exists public.academy_program_enrollments (
 id uuid primary key default gen_random_uuid(), program_id uuid not null references public.academy_programs(id) on delete restrict,
 student_id uuid not null references public.academy_students(id) on delete restrict, status text not null default 'active' check(status in('active','completed','cancelled')),
 progress_percent numeric(5,2) not null default 0, enrolled_at timestamptz not null default now(), completed_at timestamptz,
 metadata jsonb not null default '{}'::jsonb, unique(program_id,student_id)
);
create index if not exists academy_program_courses_order_idx on public.academy_program_courses(program_id,position);
create index if not exists academy_program_enrollments_student_idx on public.academy_program_enrollments(student_id,status);
alter table public.academy_programs enable row level security; alter table public.academy_program_courses enable row level security; alter table public.academy_program_enrollments enable row level security;
create policy "academy programs authenticated read" on public.academy_programs for select to authenticated using(status='active' or public.is_active_admin());
create policy "academy programs admin manage" on public.academy_programs for all to authenticated using(public.is_active_admin()) with check(public.is_active_admin());
create policy "academy program courses authenticated read" on public.academy_program_courses for select to authenticated using(exists(select 1 from public.academy_programs p where p.id=program_id and (p.status='active' or public.is_active_admin())));
create policy "academy program courses admin manage" on public.academy_program_courses for all to authenticated using(public.is_active_admin()) with check(public.is_active_admin());
create policy "academy program enrollment own read" on public.academy_program_enrollments for select to authenticated using(exists(select 1 from public.academy_students s where s.id=student_id and s.profile_id=auth.uid()) or public.is_active_admin());
create policy "academy program enrollment admin manage" on public.academy_program_enrollments for all to authenticated using(public.is_active_admin()) with check(public.is_active_admin());

create or replace function public.academy_refresh_program_enrollment(p_program_enrollment_id uuid)
returns public.academy_program_enrollments language plpgsql security definer set search_path=public as $$
declare pe public.academy_program_enrollments%rowtype; total_required int; done_required int; pct numeric(5,2);
begin
 select * into pe from public.academy_program_enrollments where id=p_program_enrollment_id; if not found then raise exception 'Programa não encontrado'; end if;
 select count(*),count(*) filter(where exists(select 1 from public.course_enrollments ce join public.academy_students s on s.profile_id=ce.user_id where s.id=pe.student_id and ce.course_id=pc.course_id and ce.status='completed'))
 into total_required,done_required from public.academy_program_courses pc where pc.program_id=pe.program_id and pc.requirement_type='required';
 pct=case when total_required=0 then 0 else round(done_required::numeric/total_required*100,2) end;
 update public.academy_program_enrollments set progress_percent=pct,status=case when total_required>0 and done_required=total_required then 'completed' else 'active' end,completed_at=case when total_required>0 and done_required=total_required then coalesce(completed_at,now()) else null end where id=pe.id returning * into pe;
 return pe;
end $$;
grant execute on function public.academy_refresh_program_enrollment(uuid) to authenticated;
commit;
