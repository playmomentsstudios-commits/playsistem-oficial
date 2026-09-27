-- Play Moments Academy foundation
create table if not exists public.courses (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  slug text not null unique,
  description text,
  content_type text not null default 'course' check (content_type in ('course','video_class','webinar','lecture','training')),
  status text not null default 'draft' check (status in ('draft','published','archived')),
  access_type text not null default 'manual' check (access_type in ('free','manual','product')),
  product_id uuid,
  cover_drive_file_id text,
  cover_url text,
  cover_mime_type text,
  cover_file_size bigint,
  instructor_name text,
  estimated_minutes integer,
  published_at timestamptz,
  created_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create table if not exists public.course_modules (
  id uuid primary key default gen_random_uuid(),
  course_id uuid not null references public.courses(id) on delete cascade,
  title text not null,
  description text,
  display_order integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create table if not exists public.course_lessons (
  id uuid primary key default gen_random_uuid(),
  module_id uuid not null references public.course_modules(id) on delete cascade,
  title text not null,
  description text,
  video_source text not null default 'none' check (video_source in ('none','youtube','vimeo','drive')),
  video_url text,
  video_drive_file_id text,
  duration_seconds integer,
  is_preview boolean not null default false,
  display_order integer not null default 0,
  status text not null default 'draft' check (status in ('draft','published')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create table if not exists public.lesson_materials (
  id uuid primary key default gen_random_uuid(),
  lesson_id uuid not null references public.course_lessons(id) on delete cascade,
  title text not null,
  drive_file_id text,
  external_url text,
  mime_type text,
  file_size bigint,
  display_order integer not null default 0,
  created_at timestamptz not null default now()
);
create table if not exists public.course_enrollments (
  id uuid primary key default gen_random_uuid(),
  course_id uuid not null references public.courses(id) on delete cascade,
  user_id uuid not null references public.profiles(id) on delete cascade,
  status text not null default 'active' check (status in ('active','completed','cancelled')),
  source text not null default 'manual' check (source in ('manual','free','product')),
  enrolled_at timestamptz not null default now(),
  completed_at timestamptz,
  unique(course_id,user_id)
);
create table if not exists public.lesson_progress (
  id uuid primary key default gen_random_uuid(),
  enrollment_id uuid not null references public.course_enrollments(id) on delete cascade,
  lesson_id uuid not null references public.course_lessons(id) on delete cascade,
  completed boolean not null default false,
  progress_seconds integer not null default 0,
  last_watched_at timestamptz,
  completed_at timestamptz,
  unique(enrollment_id,lesson_id)
);
create index if not exists course_modules_course_order_idx on public.course_modules(course_id,display_order);
create index if not exists course_lessons_module_order_idx on public.course_lessons(module_id,display_order);
create index if not exists course_enrollments_user_idx on public.course_enrollments(user_id,status);
create index if not exists lesson_progress_enrollment_idx on public.lesson_progress(enrollment_id);

alter table public.courses enable row level security;
alter table public.course_modules enable row level security;
alter table public.course_lessons enable row level security;
alter table public.lesson_materials enable row level security;
alter table public.course_enrollments enable row level security;
alter table public.lesson_progress enable row level security;

create or replace function public.is_active_admin()
returns boolean language sql stable security definer set search_path=public as $$
  select exists(select 1 from public.profiles p where p.id=auth.uid() and p.role='admin' and p.status='active')
$$;

create policy "academy admins manage courses" on public.courses for all using (public.is_active_admin()) with check (public.is_active_admin());
create policy "academy students view enrolled courses" on public.courses for select using (
  status='published' and (access_type='free' or exists(select 1 from public.course_enrollments e where e.course_id=courses.id and e.user_id=auth.uid() and e.status in ('active','completed')))
);
create policy "academy admins manage modules" on public.course_modules for all using (public.is_active_admin()) with check (public.is_active_admin());
create policy "academy students view enrolled modules" on public.course_modules for select using (
  exists(select 1 from public.courses c where c.id=course_modules.course_id and c.status='published' and (c.access_type='free' or exists(select 1 from public.course_enrollments e where e.course_id=c.id and e.user_id=auth.uid() and e.status in ('active','completed'))))
);
create policy "academy admins manage lessons" on public.course_lessons for all using (public.is_active_admin()) with check (public.is_active_admin());
create policy "academy students view enrolled lessons" on public.course_lessons for select using (
  status='published' and exists(select 1 from public.course_modules m join public.courses c on c.id=m.course_id where m.id=course_lessons.module_id and c.status='published' and (is_preview or c.access_type='free' or exists(select 1 from public.course_enrollments e where e.course_id=c.id and e.user_id=auth.uid() and e.status in ('active','completed'))))
);
create policy "academy admins manage materials" on public.lesson_materials for all using (public.is_active_admin()) with check (public.is_active_admin());
create policy "academy students view materials" on public.lesson_materials for select using (
  exists(select 1 from public.course_lessons l join public.course_modules m on m.id=l.module_id join public.course_enrollments e on e.course_id=m.course_id where l.id=lesson_materials.lesson_id and e.user_id=auth.uid() and e.status in ('active','completed'))
);
create policy "academy admins manage enrollments" on public.course_enrollments for all using (public.is_active_admin()) with check (public.is_active_admin());
create policy "academy students view own enrollments" on public.course_enrollments for select using (user_id=auth.uid());
create policy "academy students create free enrollment" on public.course_enrollments for insert with check (
  user_id=auth.uid() and source='free' and exists(select 1 from public.courses c where c.id=course_id and c.status='published' and c.access_type='free')
);
create policy "academy admins manage progress" on public.lesson_progress for all using (public.is_active_admin()) with check (public.is_active_admin());
create policy "academy students view own progress" on public.lesson_progress for select using (
  exists(select 1 from public.course_enrollments e where e.id=enrollment_id and e.user_id=auth.uid())
);
create policy "academy students insert own progress" on public.lesson_progress for insert with check (
  exists(select 1 from public.course_enrollments e where e.id=enrollment_id and e.user_id=auth.uid() and e.status='active')
);
create policy "academy students update own progress" on public.lesson_progress for update using (
  exists(select 1 from public.course_enrollments e where e.id=enrollment_id and e.user_id=auth.uid() and e.status='active')
) with check (
  exists(select 1 from public.course_enrollments e where e.id=enrollment_id and e.user_id=auth.uid() and e.status='active')
);
