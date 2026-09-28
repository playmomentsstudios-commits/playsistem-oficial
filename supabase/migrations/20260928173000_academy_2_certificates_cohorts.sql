-- Academia 2.0: turmas, certificados e configuração acadêmica
alter table public.courses
  add column if not exists certificate_enabled boolean not null default false,
  add column if not exists certificate_hours numeric(8,2),
  add column if not exists require_assessments boolean not null default false;

create table if not exists public.academy_cohorts (
  id uuid primary key default gen_random_uuid(),
  course_id uuid not null references public.courses(id) on delete cascade,
  name text not null check (char_length(name) between 2 and 160),
  organization text,
  starts_on date,
  ends_on date,
  status text not null default 'active' check (status in ('draft','active','completed','archived')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.academy_cohort_members (
  cohort_id uuid not null references public.academy_cohorts(id) on delete cascade,
  user_id uuid not null references public.profiles(id) on delete cascade,
  joined_at timestamptz not null default now(),
  primary key (cohort_id,user_id)
);

create table if not exists public.academy_certificates (
  id uuid primary key default gen_random_uuid(),
  course_id uuid not null references public.courses(id) on delete cascade,
  user_id uuid not null references public.profiles(id) on delete cascade,
  enrollment_id uuid references public.course_enrollments(id) on delete set null,
  verification_code text not null unique default upper(substr(replace(gen_random_uuid()::text,'-',''),1,16)),
  issued_at timestamptz not null default now(),
  revoked_at timestamptz,
  unique(course_id,user_id)
);

alter table public.academy_cohorts enable row level security;
alter table public.academy_cohort_members enable row level security;
alter table public.academy_certificates enable row level security;

drop policy if exists "academy cohorts admin manage" on public.academy_cohorts;
create policy "academy cohorts admin manage" on public.academy_cohorts for all to authenticated
using (exists(select 1 from public.profiles p where p.id=auth.uid() and p.role='admin'))
with check (exists(select 1 from public.profiles p where p.id=auth.uid() and p.role='admin'));

drop policy if exists "academy cohort members admin manage" on public.academy_cohort_members;
create policy "academy cohort members admin manage" on public.academy_cohort_members for all to authenticated
using (exists(select 1 from public.profiles p where p.id=auth.uid() and p.role='admin'))
with check (exists(select 1 from public.profiles p where p.id=auth.uid() and p.role='admin'));

drop policy if exists "academy cohort members own read" on public.academy_cohort_members;
create policy "academy cohort members own read" on public.academy_cohort_members for select to authenticated
using (user_id=auth.uid());

drop policy if exists "academy certificates admin manage" on public.academy_certificates;
create policy "academy certificates admin manage" on public.academy_certificates for all to authenticated
using (exists(select 1 from public.profiles p where p.id=auth.uid() and p.role='admin'))
with check (exists(select 1 from public.profiles p where p.id=auth.uid() and p.role='admin'));

drop policy if exists "academy certificates own read" on public.academy_certificates;
create policy "academy certificates own read" on public.academy_certificates for select to authenticated
using (user_id=auth.uid());

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
  if not found or not coalesce(v_course.certificate_enabled,false) then raise exception 'Certificado não disponível para este curso.'; end if;
  select * into v_enrollment from public.course_enrollments where course_id=p_course_id and user_id=auth.uid() and status in ('active','completed') limit 1;
  if not found then raise exception 'Matrícula ativa não encontrada.'; end if;

  select count(*) into v_total from public.course_lessons l join public.course_modules m on m.id=l.module_id where m.course_id=p_course_id and l.status='published';
  select count(distinct lp.lesson_id) into v_done from public.lesson_progress lp join public.course_lessons l on l.id=lp.lesson_id join public.course_modules m on m.id=l.module_id where m.course_id=p_course_id and lp.enrollment_id=v_enrollment.id and lp.completed=true and l.status='published';
  if v_total=0 or v_done<v_total then raise exception 'Conclua todas as aulas antes de emitir o certificado.'; end if;

  if coalesce(v_course.require_assessments,false) then
    select count(*) into v_required from public.academy_assessments a join public.course_modules m on m.id=a.module_id where m.course_id=p_course_id and a.status='published' and a.kind='evaluation';
    select count(distinct a.id) into v_passed
    from public.academy_assessments a join public.course_modules m on m.id=a.module_id
    where m.course_id=p_course_id and a.status='published' and a.kind='evaluation'
      and exists(select 1 from public.academy_attempts t where t.assessment_id=a.id and t.user_id=auth.uid() and t.status='completed'
        and t.score*100 >= greatest(1,(select coalesce(sum((q->>'points')::numeric),0) from jsonb_array_elements(t.snapshot) q))*a.passing_percent);
    if v_passed<v_required then raise exception 'Conclua as avaliações obrigatórias com aproveitamento mínimo.'; end if;
  end if;

  insert into public.academy_certificates(course_id,user_id,enrollment_id)
  values(p_course_id,auth.uid(),v_enrollment.id)
  on conflict(course_id,user_id) do update set enrollment_id=excluded.enrollment_id
  returning * into v_cert;
  update public.course_enrollments set status='completed',completed_at=coalesce(completed_at,now()) where id=v_enrollment.id;
  return v_cert;
end $$;

grant execute on function public.academy_issue_my_certificate(uuid) to authenticated;
create index if not exists academy_cohorts_course_idx on public.academy_cohorts(course_id,status);
create index if not exists academy_certificates_user_idx on public.academy_certificates(user_id,issued_at desc);
