-- Academic V1 management: atomic administrative enrollment
begin;
create or replace function public.academy_admin_enroll(p_user_id uuid,p_offering_id uuid)
returns public.course_enrollments language plpgsql security definer set search_path=public as $$
declare v_student public.academy_students%rowtype; v_offering public.academy_offerings%rowtype; v_enrollment public.course_enrollments%rowtype;
begin
 if not public.is_active_admin() then raise exception 'Acesso negado'; end if;
 select * into v_offering from public.academy_offerings where id=p_offering_id and status in('active','draft');
 if not found then raise exception 'Oferta não encontrada ou indisponível'; end if;
 select * into v_student from public.academy_students where profile_id=p_user_id;
 if not found then
  insert into public.academy_students(profile_id,academic_record) values(p_user_id,'RA-'||to_char(current_date,'YYYY')||'-'||lpad(nextval('public.academy_student_ra_seq')::text,6,'0')) returning * into v_student;
 end if;
 select * into v_enrollment from public.course_enrollments where course_id=v_offering.course_id and user_id=p_user_id;
 if found then
  update public.course_enrollments set student_id=v_student.id,offering_id=v_offering.id,curriculum_id=v_offering.curriculum_id,enrollment_number=coalesce(enrollment_number,'MAT-'||to_char(current_date,'YYYY')||'-'||lpad(nextval('public.academy_enrollment_number_seq')::text,6,'0')),started_at=coalesce(started_at,now()),origin=coalesce(origin,source,'manual'),status='active' where id=v_enrollment.id returning * into v_enrollment;
 else
  insert into public.course_enrollments(course_id,user_id,status,source,student_id,offering_id,curriculum_id,enrollment_number,started_at,origin)
  values(v_offering.course_id,p_user_id,'active','manual',v_student.id,v_offering.id,v_offering.curriculum_id,'MAT-'||to_char(current_date,'YYYY')||'-'||lpad(nextval('public.academy_enrollment_number_seq')::text,6,'0'),now(),'manual') returning * into v_enrollment;
 end if;
 if not exists(select 1 from public.academy_events where enrollment_id=v_enrollment.id and event_type='enrollment_created') then insert into public.academy_events(student_id,enrollment_id,event_type,title,actor_id,metadata) values(v_student.id,v_enrollment.id,'enrollment_created','Matrícula acadêmica efetivada',auth.uid(),jsonb_build_object('offering_id',v_offering.id,'curriculum_id',v_offering.curriculum_id)); end if;
 return v_enrollment;
end $$;
revoke all on function public.academy_admin_enroll(uuid,uuid) from public;
grant execute on function public.academy_admin_enroll(uuid,uuid) to authenticated;
commit;
