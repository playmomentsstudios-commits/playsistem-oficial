-- Academy V1 #196 — contracts, terms and auditable acceptance
begin;

create table if not exists public.academy_document_acceptances (
 id uuid primary key default gen_random_uuid(),
 document_id uuid not null references public.academy_documents(id) on delete restrict,
 document_version integer not null check(document_version>0),
 student_id uuid not null references public.academy_students(id) on delete restrict,
 enrollment_id uuid references public.course_enrollments(id) on delete set null,
 accepted_by uuid not null references public.profiles(id) on delete restrict,
 acceptance_type text not null default 'electronic' check(acceptance_type in('electronic','admin_recorded')),
 accepted_at timestamptz not null default now(),
 document_hash text,
 evidence jsonb not null default '{}'::jsonb,
 revoked_at timestamptz,
 revoked_by uuid references public.profiles(id) on delete set null,
 revoke_reason text,
 created_at timestamptz not null default now(),
 unique(document_id,document_version,accepted_by)
);

create index if not exists academy_document_acceptances_student_idx on public.academy_document_acceptances(student_id,accepted_at desc);
alter table public.academy_document_acceptances enable row level security;

drop policy if exists "academy acceptance own read" on public.academy_document_acceptances;
create policy "academy acceptance own read" on public.academy_document_acceptances for select to authenticated
using(accepted_by=auth.uid() or public.is_active_admin());

drop policy if exists "academy acceptance own insert" on public.academy_document_acceptances;
create policy "academy acceptance own insert" on public.academy_document_acceptances for insert to authenticated
with check(accepted_by=auth.uid() and exists(select 1 from public.academy_students s where s.id=student_id and s.profile_id=auth.uid()) and exists(select 1 from public.academy_documents d where d.id=document_id and d.student_id=student_id and d.status in('issued','signed')));

drop policy if exists "academy acceptance admin manage" on public.academy_document_acceptances;
create policy "academy acceptance admin manage" on public.academy_document_acceptances for all to authenticated
using(public.is_active_admin()) with check(public.is_active_admin());

create or replace function public.academy_accept_document(p_document_id uuid)
returns public.academy_document_acceptances language plpgsql security definer set search_path=public as $$
declare d public.academy_documents%rowtype; s public.academy_students%rowtype; a public.academy_document_acceptances%rowtype;
begin
 select * into d from public.academy_documents where id=p_document_id;
 if not found or d.status not in('issued','signed') then raise exception 'Documento não está disponível para aceite'; end if;
 select * into s from public.academy_students where id=d.student_id;
 if not found or (s.profile_id<>auth.uid() and not public.is_active_admin()) then raise exception 'Acesso negado'; end if;
 insert into public.academy_document_acceptances(document_id,document_version,student_id,enrollment_id,accepted_by,acceptance_type,document_hash,evidence)
 values(d.id,d.current_version,d.student_id,d.enrollment_id,case when public.is_active_admin() then coalesce(s.profile_id,auth.uid()) else auth.uid() end,case when public.is_active_admin() then 'admin_recorded' else 'electronic' end,d.file_hash,jsonb_build_object('document_type',d.document_type,'title',d.title,'version',d.current_version))
 on conflict(document_id,document_version,accepted_by) do update set accepted_at=excluded.accepted_at,document_hash=excluded.document_hash,evidence=excluded.evidence,revoked_at=null,revoked_by=null,revoke_reason=null
 returning * into a;
 if d.status='issued' then update public.academy_documents set status='signed',updated_at=now() where id=d.id; end if;
 return a;
end $$;

grant execute on function public.academy_accept_document(uuid) to authenticated;
commit;
