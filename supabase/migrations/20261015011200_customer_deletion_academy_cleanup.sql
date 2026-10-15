-- Safely resolve academy records before an explicitly confirmed account deletion.
-- No historical users are modified by this migration. Cleanup is never triggered by signup.
-- service_role-only RPC called after the server has verified the current admin.
create or replace function public.admin_customer_academy_summary(p_customer_id uuid)
returns jsonb language plpgsql stable security definer set search_path='' as $$
declare v_result jsonb;
begin
 if not exists (select 1 from public.profiles p where p.id=p_customer_id and p.role='customer') then
   raise exception 'Cadastro de cliente não encontrado.' using errcode='22023';
 end if;
 select jsonb_build_object(
    'students', (select count(*) from public.academy_students a where a.profile_id=p_customer_id),
    'enrollments', (select count(*) from public.course_enrollments e where e.user_id=p_customer_id
       or e.student_id in (select s.id from public.academy_students s where s.profile_id=p_customer_id)),
    'attempts', (select count(*) from public.academy_attempts a where a.user_id=p_customer_id),
    'certificates', (select count(*) from public.academy_certificates c where c.user_id=p_customer_id),
    'program_enrollments', (select count(*) from public.academy_program_enrollments e
       where e.student_id in (select s.id from public.academy_students s where s.profile_id=p_customer_id)),
    'documents', (select count(*) from public.academy_documents d
       where d.student_id in (select s.id from public.academy_students s where s.profile_id=p_customer_id)),
    'signed_records',
       (select count(*) from public.academy_document_signatures sig
        where sig.signer_id=p_customer_id
          or sig.document_id in (select d.id from public.academy_documents d
              where d.student_id in (select s.id from public.academy_students s where s.profile_id=p_customer_id)))
       + (select count(*) from public.academy_document_acceptances a
          where a.accepted_by=p_customer_id
             or a.student_id in (select s.id from public.academy_students s where s.profile_id=p_customer_id))
 )
 into v_result;
 return v_result;
end $$;
revoke all on function public.admin_customer_academy_summary(uuid) from public,anon,authenticated;
grant execute on function public.admin_customer_academy_summary(uuid) to service_role;

create or replace function public.admin_customer_cleanup_academy(p_customer_id uuid)
returns jsonb language plpgsql security definer set search_path='' as $$
declare
 v_summary jsonb;
 v_removed_answers integer;
 v_removed_attempts integer;
 v_removed_enrollments integer;
 v_removed_students integer;
begin
 -- This RPC is callable only with the server secret, never from the browser.
 -- The Edge Function checks admin, target role, e-mail confirmation and EXCLUIR TUDO.
 select public.admin_customer_academy_summary(p_customer_id) into v_summary;
 if coalesce((v_summary->>'signed_records')::integer,0)>0 then
   raise exception 'Este cliente possui documentos assinados ou aceites acadêmicos. Preserve os registros e solicite revisão administrativa antes de excluir.'
     using errcode='23503';
 end if;

 -- All following statements run as a single database transaction.
 delete from public.academy_answers a where a.attempt_id in (
   select t.id from public.academy_attempts t where t.user_id=p_customer_id);
 get diagnostics v_removed_answers = row_count;
 delete from public.academy_attempts a where a.user_id=p_customer_id;
 get diagnostics v_removed_attempts = row_count;

 -- No signed records remain; eliminate user-owned academic documents and event history.
 delete from public.academy_documents d where d.student_id in (
   select s.id from public.academy_students s where s.profile_id=p_customer_id);
 delete from public.academy_program_enrollments p where p.student_id in (
   select s.id from public.academy_students s where s.profile_id=p_customer_id);
 delete from public.academy_events e where e.student_id in (
   select s.id from public.academy_students s where s.profile_id=p_customer_id)
   or e.enrollment_id in (
     select c.id from public.course_enrollments c where c.user_id=p_customer_id
        or c.student_id in (select s.id from public.academy_students s where s.profile_id=p_customer_id));

 -- Certificate/reissue rows belong to this customer, never the shared course catalog.
 delete from public.academy_certificates c where c.user_id=p_customer_id;
 delete from public.course_enrollments c where c.user_id=p_customer_id
   or c.student_id in (select s.id from public.academy_students s where s.profile_id=p_customer_id);
 get diagnostics v_removed_enrollments = row_count;
 delete from public.academy_students s where s.profile_id=p_customer_id;
 get diagnostics v_removed_students = row_count;

 return jsonb_build_object('ok',true,
   'answers_deleted',v_removed_answers,'attempts_deleted',v_removed_attempts,
   'enrollments_deleted',v_removed_enrollments,'students_deleted',v_removed_students);
end $$;
revoke all on function public.admin_customer_cleanup_academy(uuid) from public,anon,authenticated;
grant execute on function public.admin_customer_cleanup_academy(uuid) to service_role;
