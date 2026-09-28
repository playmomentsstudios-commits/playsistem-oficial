-- Academia 2.0: modelos de certificado, snapshot de emissão e validação pública.
-- Migration aditiva: não altera a migration 20260928173000, que pode já existir no remoto.
create table if not exists public.academy_certificate_templates (
 id uuid primary key default gen_random_uuid(),
 name text not null check(char_length(name) between 2 and 160),
 status text not null default 'draft' check(status in ('draft','active','archived')),
 page_orientation text not null default 'landscape' check(page_orientation in ('landscape','portrait')),
 background_drive_file_id text,
 signature_drive_file_id text,
 signer_name text,
 signer_role text,
 body_template text not null default 'Certificamos que {{student_name}} concluiu o curso {{course_title}}, com carga horária de {{course_hours}} horas, em {{completion_date}}.',
 layout jsonb not null default '{"student_name":{"x":50,"y":43,"fontSize":30},"body":{"x":50,"y":56,"fontSize":14,"width":72},"signer":{"x":72,"y":79,"fontSize":11},"code":{"x":50,"y":92,"fontSize":8},"qr":{"x":91,"y":86,"size":8}}'::jsonb,
 version integer not null default 1,
 created_at timestamptz not null default now(),
 updated_at timestamptz not null default now()
);
alter table public.academy_certificate_templates enable row level security;
drop policy if exists "academy certificate templates admin manage" on public.academy_certificate_templates;
create policy "academy certificate templates admin manage" on public.academy_certificate_templates for all to authenticated
 using(exists(select 1 from public.profiles p where p.id=auth.uid() and p.role='admin'))
 with check(exists(select 1 from public.profiles p where p.id=auth.uid() and p.role='admin'));

alter table public.courses add column if not exists certificate_template_id uuid references public.academy_certificate_templates(id) on delete set null;
alter table public.academy_certificates
 add column if not exists template_id uuid references public.academy_certificate_templates(id) on delete set null,
 add column if not exists template_snapshot jsonb,
 add column if not exists student_name_snapshot text,
 add column if not exists course_title_snapshot text,
 add column if not exists course_hours_snapshot numeric(8,2),
 add column if not exists completion_date_snapshot date,
 add column if not exists pdf_drive_file_id text,
 add column if not exists generated_at timestamptz;

create or replace function public.academy_issue_my_certificate(p_course_id uuid)
returns public.academy_certificates language plpgsql security definer set search_path=public as $$
declare v_enrollment public.course_enrollments; v_course public.courses; v_profile public.profiles; v_template public.academy_certificate_templates;
v_total int; v_done int; v_required int; v_passed int; v_cert public.academy_certificates;
begin
 select * into v_course from public.courses where id=p_course_id and status='published';
 if not found or not coalesce(v_course.certificate_enabled,false) then raise exception 'Certificado não disponível para este curso.'; end if;
 if v_course.certificate_template_id is null then raise exception 'O curso ainda não possui um modelo de certificado ativo.'; end if;
 select * into v_template from public.academy_certificate_templates where id=v_course.certificate_template_id and status='active';
 if not found then raise exception 'O modelo de certificado deste curso não está ativo.'; end if;
 select * into v_enrollment from public.course_enrollments where course_id=p_course_id and user_id=auth.uid() and status in('active','completed') limit 1;
 if not found then raise exception 'Matrícula ativa não encontrada.'; end if;
 select * into v_profile from public.profiles where id=auth.uid();
 select count(*) into v_total from public.course_lessons l join public.course_modules m on m.id=l.module_id where m.course_id=p_course_id and l.status='published';
 select count(distinct lp.lesson_id) into v_done from public.lesson_progress lp join public.course_lessons l on l.id=lp.lesson_id join public.course_modules m on m.id=l.module_id where m.course_id=p_course_id and lp.enrollment_id=v_enrollment.id and lp.completed=true and l.status='published';
 if v_total=0 or v_done<v_total then raise exception 'Conclua todas as aulas antes de emitir o certificado.'; end if;
 if coalesce(v_course.require_assessments,false) then
  select count(*) into v_required from public.academy_assessments a join public.course_modules m on m.id=a.module_id where m.course_id=p_course_id and a.status='published' and a.kind='evaluation';
  select count(distinct a.id) into v_passed from public.academy_assessments a join public.course_modules m on m.id=a.module_id
  where m.course_id=p_course_id and a.status='published' and a.kind='evaluation' and exists(
   select 1 from public.academy_attempts t where t.assessment_id=a.id and t.user_id=auth.uid() and t.status='completed'
   and t.score*100 >= greatest(1,(select coalesce(sum((q->>'points')::numeric),0) from jsonb_array_elements(t.snapshot) q))*a.passing_percent);
  if v_passed<v_required then raise exception 'Conclua as avaliações obrigatórias com aproveitamento mínimo.'; end if;
 end if;
 insert into public.academy_certificates(course_id,user_id,enrollment_id,template_id,template_snapshot,student_name_snapshot,course_title_snapshot,course_hours_snapshot,completion_date_snapshot)
 values(p_course_id,auth.uid(),v_enrollment.id,v_template.id,to_jsonb(v_template),trim(concat_ws(' ',v_profile.first_name,v_profile.last_name)),v_course.title,v_course.certificate_hours,current_date)
 on conflict(course_id,user_id) do update set enrollment_id=excluded.enrollment_id
 returning * into v_cert;
 update public.course_enrollments set status='completed',completed_at=coalesce(completed_at,now()) where id=v_enrollment.id;
 return v_cert;
end $$;

create or replace function public.academy_verify_certificate(p_code text)
returns table(verification_code text,issued_at timestamptz,revoked_at timestamptz,student_name text,course_title text,course_hours numeric,completion_date date)
language sql stable security definer set search_path=public as $$
 select c.verification_code,c.issued_at,c.revoked_at,c.student_name_snapshot,c.course_title_snapshot,c.course_hours_snapshot,c.completion_date_snapshot
 from public.academy_certificates c where c.verification_code=upper(trim(p_code)) limit 1
$$;
grant execute on function public.academy_verify_certificate(text) to anon,authenticated;
create index if not exists academy_certificate_templates_status_idx on public.academy_certificate_templates(status,created_at desc);
