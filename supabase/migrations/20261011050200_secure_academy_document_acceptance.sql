-- Require a real authenticated student or active administrator for document acceptance.
create or replace function public.academy_accept_document(p_document_id uuid)
returns public.academy_document_acceptances
language plpgsql
security definer
set search_path=public
as $$
declare
  d public.academy_documents%rowtype;
  s public.academy_students%rowtype;
  a public.academy_document_acceptances%rowtype;
begin
  if auth.uid() is null then
    raise exception 'Acesso negado' using errcode='42501';
  end if;

  select * into d from public.academy_documents where id=p_document_id;
  if not found or d.status not in ('issued','signed') then
    raise exception 'Documento não está disponível para aceite';
  end if;

  select * into s from public.academy_students where id=d.student_id;
  if not found
    or (s.profile_id is distinct from auth.uid() and not public.is_active_admin())
  then
    raise exception 'Acesso negado' using errcode='42501';
  end if;

  insert into public.academy_document_acceptances(
    document_id,document_version,student_id,enrollment_id,accepted_by,
    acceptance_type,document_hash,evidence
  )
  values(
    d.id,d.current_version,d.student_id,d.enrollment_id,
    case when public.is_active_admin() then coalesce(s.profile_id,auth.uid()) else auth.uid() end,
    case when public.is_active_admin() then 'admin_recorded' else 'electronic' end,
    d.file_hash,
    jsonb_build_object('document_type',d.document_type,'title',d.title,'version',d.current_version)
  )
  on conflict(document_id,document_version,accepted_by)
  do update set accepted_at=excluded.accepted_at,document_hash=excluded.document_hash,
    evidence=excluded.evidence,revoked_at=null,revoked_by=null,revoke_reason=null
  returning * into a;

  if d.status='issued' then
    update public.academy_documents set status='signed',updated_at=now() where id=d.id;
  end if;

  return a;
end;
$$;

revoke all on function public.academy_accept_document(uuid) from public, anon;
grant execute on function public.academy_accept_document(uuid) to authenticated, service_role;
