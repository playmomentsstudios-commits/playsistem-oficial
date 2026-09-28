-- Academy V1 #194 — academic document engine
begin;

create table if not exists public.academy_document_templates (
 id uuid primary key default gen_random_uuid(),
 name text not null,
 document_type text not null check(document_type in('contract','term','declaration','enrollment_proof','report_card','transcript','certificate','other')),
 status text not null default 'draft' check(status in('draft','active','archived')),
 content jsonb not null default '{}'::jsonb,
 created_by uuid references public.profiles(id) on delete set null,
 created_at timestamptz not null default now(),
 updated_at timestamptz not null default now()
);

create table if not exists public.academy_documents (
 id uuid primary key default gen_random_uuid(),
 student_id uuid not null references public.academy_students(id) on delete restrict,
 enrollment_id uuid references public.course_enrollments(id) on delete set null,
 template_id uuid references public.academy_document_templates(id) on delete set null,
 document_type text not null check(document_type in('contract','term','declaration','enrollment_proof','report_card','transcript','certificate','other')),
 title text not null,
 status text not null default 'draft' check(status in('draft','issued','signed','revoked','archived')),
 current_version integer not null default 1 check(current_version>0),
 drive_file_id text,
 file_name text,
 mime_type text,
 file_size bigint,
 file_hash text,
 issued_at timestamptz,
 revoked_at timestamptz,
 metadata jsonb not null default '{}'::jsonb,
 created_by uuid references public.profiles(id) on delete set null,
 created_at timestamptz not null default now(),
 updated_at timestamptz not null default now()
);

create table if not exists public.academy_document_versions (
 id uuid primary key default gen_random_uuid(),
 document_id uuid not null references public.academy_documents(id) on delete cascade,
 version integer not null check(version>0),
 drive_file_id text,
 file_name text,
 mime_type text,
 file_size bigint,
 file_hash text,
 snapshot jsonb not null default '{}'::jsonb,
 created_by uuid references public.profiles(id) on delete set null,
 created_at timestamptz not null default now(),
 unique(document_id,version)
);

create index if not exists academy_documents_student_idx on public.academy_documents(student_id,created_at desc);
create index if not exists academy_documents_enrollment_idx on public.academy_documents(enrollment_id,created_at desc);

alter table public.academy_document_templates enable row level security;
alter table public.academy_documents enable row level security;
alter table public.academy_document_versions enable row level security;

drop policy if exists "academy document templates admin" on public.academy_document_templates;
create policy "academy document templates admin" on public.academy_document_templates for all to authenticated using(public.is_active_admin()) with check(public.is_active_admin());

drop policy if exists "academy documents own read" on public.academy_documents;
create policy "academy documents own read" on public.academy_documents for select to authenticated using(exists(select 1 from public.academy_students s where s.id=academy_documents.student_id and s.profile_id=auth.uid()) or public.is_active_admin());
drop policy if exists "academy documents admin manage" on public.academy_documents;
create policy "academy documents admin manage" on public.academy_documents for all to authenticated using(public.is_active_admin()) with check(public.is_active_admin());

drop policy if exists "academy document versions own read" on public.academy_document_versions;
create policy "academy document versions own read" on public.academy_document_versions for select to authenticated using(exists(select 1 from public.academy_documents d join public.academy_students s on s.id=d.student_id where d.id=academy_document_versions.document_id and s.profile_id=auth.uid()) or public.is_active_admin());
drop policy if exists "academy document versions admin manage" on public.academy_document_versions;
create policy "academy document versions admin manage" on public.academy_document_versions for all to authenticated using(public.is_active_admin()) with check(public.is_active_admin());

commit;
