-- Play Moments Academic System V1 — Phase A foundation
-- Evolves the existing Academy without replacing current courses/enrollments/cohorts.
begin;

create sequence if not exists public.academy_student_ra_seq start 1;
create sequence if not exists public.academy_enrollment_number_seq start 1;

create table if not exists public.academy_students (
 id uuid primary key default gen_random_uuid(),
 profile_id uuid not null unique references public.profiles(id) on delete restrict,
 academic_record text not null unique,
 status text not null default 'active' check(status in('active','inactive','blocked')),
 created_at timestamptz not null default now(),
 updated_at timestamptz not null default now()
);

create table if not exists public.academy_curricula (
 id uuid primary key default gen_random_uuid(),
 course_id uuid not null references public.courses(id) on delete restrict,
 version integer not null,
 name text not null,
 status text not null default 'draft' check(status in('draft','active','retired')),
 effective_from date,
 effective_until date,
 snapshot jsonb not null default '{}'::jsonb,
 created_at timestamptz not null default now(),
 updated_at timestamptz not null default now(),
 unique(course_id,version)
);

create table if not exists public.academy_offerings (
 id uuid primary key default gen_random_uuid(),
 course_id uuid not null references public.courses(id) on delete restrict,
 curriculum_id uuid not null references public.academy_curricula(id) on delete restrict,
 cohort_id uuid references public.academy_cohorts(id) on delete set null,
 name text not null,
 offering_type text not null default 'open' check(offering_type in('open','cohort','private')),
 starts_on date,
 ends_on date,
 seats integer check(seats is null or seats>0),
 status text not null default 'active' check(status in('draft','active','completed','archived')),
 created_at timestamptz not null default now(),
 updated_at timestamptz not null default now()
);

alter table public.course_enrollments
 add column if not exists student_id uuid references public.academy_students(id) on delete restrict,
 add column if not exists offering_id uuid references public.academy_offerings(id) on delete restrict,
 add column if not exists curriculum_id uuid references public.academy_curricula(id) on delete restrict,
 add column if not exists enrollment_number text,
 add column if not exists started_at timestamptz,
 add column if not exists origin text,
 add column if not exists final_grade numeric(6,2),
 add column if not exists attendance_percent numeric(6,2),
 add column if not exists progress_percent numeric(6,2);

create unique index if not exists course_enrollments_enrollment_number_uidx
 on public.course_enrollments(enrollment_number) where enrollment_number is not null;

create table if not exists public.academy_events (
 id uuid primary key default gen_random_uuid(),
 student_id uuid references public.academy_students(id) on delete set null,
 enrollment_id uuid references public.course_enrollments(id) on delete set null,
 event_type text not null,
 title text not null,
 description text,
 metadata jsonb not null default '{}'::jsonb,
 actor_id uuid references public.profiles(id) on delete set null,
 occurred_at timestamptz not null default now(),
 created_at timestamptz not null default now()
);
create index if not exists academy_events_student_time_idx on public.academy_events(student_id,occurred_at desc);
create index if not exists academy_events_enrollment_time_idx on public.academy_events(enrollment_id,occurred_at desc);
create index if not exists academy_offerings_course_status_idx on public.academy_offerings(course_id,status);
create index if not exists academy_curricula_course_status_idx on public.academy_curricula(course_id,status);

-- Bootstrap one academic identity per existing enrolled profile.
insert into public.academy_students(profile_id,academic_record)
select distinct e.user_id,'RA-'||to_char(current_date,'YYYY')||'-'||lpad(nextval('public.academy_student_ra_seq')::text,6,'0')
from public.course_enrollments e
where not exists(select 1 from public.academy_students s where s.profile_id=e.user_id);

-- Bootstrap curriculum v1 for every existing course.
insert into public.academy_curricula(course_id,version,name,status,effective_from,snapshot)
select c.id,1,c.title||' — Matriz 1','active',current_date,
 jsonb_build_object('course_id',c.id,'course_title',c.title,'created_from','legacy_v1')
from public.courses c
where not exists(select 1 from public.academy_curricula x where x.course_id=c.id);

-- Bootstrap one open offering for existing courses, preserving current cohort tables independently.
insert into public.academy_offerings(course_id,curriculum_id,name,offering_type,status)
select c.id,cur.id,c.title||' — Oferta contínua','open',case when c.status='published' then 'active' else 'draft' end
from public.courses c
join lateral(select id from public.academy_curricula x where x.course_id=c.id order by version desc limit 1) cur on true
where not exists(select 1 from public.academy_offerings o where o.course_id=c.id);

-- Upgrade existing enrollments in place; do not duplicate them.
update public.course_enrollments e set
 student_id=coalesce(e.student_id,s.id),
 curriculum_id=coalesce(e.curriculum_id,o.curriculum_id),
 offering_id=coalesce(e.offering_id,o.id),
 enrollment_number=coalesce(e.enrollment_number,'MAT-'||to_char(e.enrolled_at,'YYYY')||'-'||lpad(nextval('public.academy_enrollment_number_seq')::text,6,'0')),
 started_at=coalesce(e.started_at,e.enrolled_at),
 origin=coalesce(e.origin,e.source)
from public.academy_students s, public.academy_offerings o
where s.profile_id=e.user_id and o.course_id=e.course_id;

-- Initial audit events for legacy enrollments, idempotent by metadata marker.
insert into public.academy_events(student_id,enrollment_id,event_type,title,metadata,occurred_at)
select e.student_id,e.id,'enrollment_migrated','Matrícula integrada à estrutura acadêmica V1',
 jsonb_build_object('bootstrap','phase_a','enrollment_number',e.enrollment_number),now()
from public.course_enrollments e
where e.student_id is not null
and not exists(select 1 from public.academy_events ev where ev.enrollment_id=e.id and ev.event_type='enrollment_migrated' and ev.metadata->>'bootstrap'='phase_a');

alter table public.academy_students enable row level security;
alter table public.academy_curricula enable row level security;
alter table public.academy_offerings enable row level security;
alter table public.academy_events enable row level security;

create policy "academy students own read" on public.academy_students for select to authenticated using(profile_id=auth.uid());
create policy "academy students admin manage" on public.academy_students for all to authenticated using(public.is_active_admin()) with check(public.is_active_admin());
create policy "academy curricula enrolled read" on public.academy_curricula for select to authenticated using(exists(select 1 from public.course_enrollments e where e.curriculum_id=academy_curricula.id and e.user_id=auth.uid()) or public.is_active_admin());
create policy "academy curricula admin manage" on public.academy_curricula for all to authenticated using(public.is_active_admin()) with check(public.is_active_admin());
create policy "academy offerings enrolled read" on public.academy_offerings for select to authenticated using(exists(select 1 from public.course_enrollments e where e.offering_id=academy_offerings.id and e.user_id=auth.uid()) or public.is_active_admin());
create policy "academy offerings admin manage" on public.academy_offerings for all to authenticated using(public.is_active_admin()) with check(public.is_active_admin());
create policy "academy events own read" on public.academy_events for select to authenticated using(exists(select 1 from public.academy_students s where s.id=academy_events.student_id and s.profile_id=auth.uid()) or public.is_active_admin());
create policy "academy events admin manage" on public.academy_events for all to authenticated using(public.is_active_admin()) with check(public.is_active_admin());

commit;
