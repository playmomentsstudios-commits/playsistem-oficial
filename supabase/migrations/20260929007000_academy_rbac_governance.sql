-- Academy V1 #199 — academic RBAC enforcement
begin;
create or replace function public.has_staff_permission(p_permission text)
returns boolean language sql stable security definer set search_path=public as $$
 select public.is_active_admin() or exists(
   select 1 from public.staff_profiles sm join public.profiles p on p.id=sm.user_id
   where sm.user_id=auth.uid() and sm.active=true and p.status='active' and p.role='staff'
   and (sm.permissions @> array[p_permission]::text[] or sm.permissions @> array['*']::text[])
 )
$$;
grant execute on function public.has_staff_permission(text) to authenticated;

-- Management policies: admin remains unrestricted; staff gets only explicit academic capabilities.
do $$ declare t text; begin
 foreach t in array array['academy_students','academy_curricula','academy_offerings','academy_events','academy_attendance'] loop
  if to_regclass('public.'||t) is not null then
   execute format('drop policy if exists "academy staff secretary read" on public.%I',t);
   execute format('create policy "academy staff secretary read" on public.%I for select to authenticated using(public.has_staff_permission(''academy.view'') or public.has_staff_permission(''academy.students.manage'') or public.has_staff_permission(''academy.curriculum.manage''))',t);
  end if;
 end loop;
end $$;

drop policy if exists "academy programs staff read" on public.academy_programs;
create policy "academy programs staff read" on public.academy_programs for select to authenticated using(public.has_staff_permission('academy.view') or public.has_staff_permission('academy.programs.manage'));
drop policy if exists "academy programs staff manage" on public.academy_programs;
create policy "academy programs staff manage" on public.academy_programs for all to authenticated using(public.has_staff_permission('academy.programs.manage')) with check(public.has_staff_permission('academy.programs.manage'));

drop policy if exists "academy program courses staff manage" on public.academy_program_courses;
create policy "academy program courses staff manage" on public.academy_program_courses for all to authenticated using(public.has_staff_permission('academy.programs.manage')) with check(public.has_staff_permission('academy.programs.manage'));

drop policy if exists "academy documents staff manage" on public.academy_documents;
create policy "academy documents staff manage" on public.academy_documents for all to authenticated using(public.has_staff_permission('academy.documents.manage')) with check(public.has_staff_permission('academy.documents.manage'));
drop policy if exists "academy document versions staff manage" on public.academy_document_versions;
create policy "academy document versions staff manage" on public.academy_document_versions for all to authenticated using(public.has_staff_permission('academy.documents.manage')) with check(public.has_staff_permission('academy.documents.manage'));

commit;
