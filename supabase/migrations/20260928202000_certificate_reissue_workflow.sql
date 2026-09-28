-- Certificate reissue workflow: 3 self-service reissues, admin approval afterwards, audit history.
begin;

alter table public.academy_certificates
  add column if not exists reissue_count integer not null default 0,
  add column if not exists last_reissued_at timestamptz;

create table if not exists public.academy_certificate_reissues (
  id uuid primary key default gen_random_uuid(),
  certificate_id uuid not null references public.academy_certificates(id) on delete cascade,
  sequence_no integer not null,
  requested_by uuid references public.profiles(id) on delete set null,
  approved_by uuid references public.profiles(id) on delete set null,
  reason text,
  source text not null check (source in ('self_service','admin','legacy_recovery')),
  template_snapshot jsonb,
  previous_pdf_drive_file_id text,
  created_at timestamptz not null default now(),
  unique(certificate_id,sequence_no)
);

create table if not exists public.academy_certificate_reissue_requests (
  id uuid primary key default gen_random_uuid(),
  certificate_id uuid not null references public.academy_certificates(id) on delete cascade,
  user_id uuid not null references public.profiles(id) on delete cascade,
  reason text,
  status text not null default 'pending' check(status in ('pending','approved','rejected')),
  reviewed_by uuid references public.profiles(id) on delete set null,
  reviewed_at timestamptz,
  created_at timestamptz not null default now()
);
create unique index if not exists academy_certificate_one_pending_reissue
  on public.academy_certificate_reissue_requests(certificate_id,user_id) where status='pending';

alter table public.academy_certificate_reissues enable row level security;
alter table public.academy_certificate_reissue_requests enable row level security;

drop policy if exists "certificate reissues own read" on public.academy_certificate_reissues;
create policy "certificate reissues own read" on public.academy_certificate_reissues for select to authenticated
using (exists(select 1 from public.academy_certificates c where c.id=certificate_id and c.user_id=auth.uid()));
drop policy if exists "certificate reissues admin read" on public.academy_certificate_reissues;
create policy "certificate reissues admin read" on public.academy_certificate_reissues for select to authenticated
using (exists(select 1 from public.profiles p where p.id=auth.uid() and p.role='admin'));

drop policy if exists "reissue requests own read" on public.academy_certificate_reissue_requests;
create policy "reissue requests own read" on public.academy_certificate_reissue_requests for select to authenticated using(user_id=auth.uid());
drop policy if exists "reissue requests admin read" on public.academy_certificate_reissue_requests;
create policy "reissue requests admin read" on public.academy_certificate_reissue_requests for select to authenticated
using (exists(select 1 from public.profiles p where p.id=auth.uid() and p.role='admin'));

create or replace function public.academy_reissue_my_certificate(p_certificate_id uuid,p_reason text default null)
returns public.academy_certificates language plpgsql security definer set search_path=public as $$
declare v_cert public.academy_certificates; v_template public.academy_certificate_templates; v_seq int; v_source text;
begin
 select * into v_cert from public.academy_certificates where id=p_certificate_id and user_id=auth.uid() and revoked_at is null for update;
 if not found then raise exception 'Certificado não encontrado.'; end if;
 if v_cert.reissue_count>=3 then raise exception 'Limite de 3 reemissões atingido. Solicite uma nova via para aprovação.'; end if;
 select t.* into v_template from public.courses c join public.academy_certificate_templates t on t.id=c.certificate_template_id
 where c.id=v_cert.course_id and t.status='active';
 if not found then raise exception 'O curso não possui modelo de certificado ativo.'; end if;
 v_seq:=v_cert.reissue_count+1;
 v_source:=case when v_cert.template_snapshot is null then 'legacy_recovery' else 'self_service' end;
 insert into public.academy_certificate_reissues(certificate_id,sequence_no,requested_by,reason,source,template_snapshot,previous_pdf_drive_file_id)
 values(v_cert.id,v_seq,auth.uid(),nullif(trim(p_reason),''),v_source,v_cert.template_snapshot,v_cert.pdf_drive_file_id);
 update public.academy_certificates set
   template_id=v_template.id,template_snapshot=to_jsonb(v_template),
   pdf_drive_file_id=null,generated_at=null,reissue_count=v_seq,last_reissued_at=now()
 where id=v_cert.id returning * into v_cert;
 insert into public.notifications(user_id,title,message,link)
 values(auth.uid(),'Nova via do certificado emitida','A '||(v_seq+1)||'ª via do seu certificado está disponível.','/certificados/'||v_cert.verification_code);
 return v_cert;
end $$;

create or replace function public.academy_request_certificate_reissue(p_certificate_id uuid,p_reason text default null)
returns public.academy_certificate_reissue_requests language plpgsql security definer set search_path=public as $$
declare v_cert public.academy_certificates; v_req public.academy_certificate_reissue_requests;
begin
 select * into v_cert from public.academy_certificates where id=p_certificate_id and user_id=auth.uid() and revoked_at is null;
 if not found then raise exception 'Certificado não encontrado.'; end if;
 if v_cert.reissue_count<3 then raise exception 'Você ainda possui reemissões automáticas disponíveis.'; end if;
 insert into public.academy_certificate_reissue_requests(certificate_id,user_id,reason)
 values(v_cert.id,auth.uid(),nullif(trim(p_reason),'')) returning * into v_req;
 return v_req;
exception when unique_violation then raise exception 'Já existe uma solicitação pendente para este certificado.';
end $$;

create or replace function public.academy_admin_reissue_certificate(p_certificate_id uuid,p_request_id uuid default null,p_reason text default null)
returns public.academy_certificates language plpgsql security definer set search_path=public as $$
declare v_cert public.academy_certificates; v_template public.academy_certificate_templates; v_seq int;
begin
 if not exists(select 1 from public.profiles where id=auth.uid() and role='admin') then raise exception 'Acesso negado.'; end if;
 select * into v_cert from public.academy_certificates where id=p_certificate_id and revoked_at is null for update;
 if not found then raise exception 'Certificado não encontrado.'; end if;
 select t.* into v_template from public.courses c join public.academy_certificate_templates t on t.id=c.certificate_template_id
 where c.id=v_cert.course_id and t.status='active';
 if not found then raise exception 'O curso não possui modelo de certificado ativo.'; end if;
 v_seq:=v_cert.reissue_count+1;
 insert into public.academy_certificate_reissues(certificate_id,sequence_no,requested_by,approved_by,reason,source,template_snapshot,previous_pdf_drive_file_id)
 values(v_cert.id,v_seq,v_cert.user_id,auth.uid(),nullif(trim(p_reason),''),'admin',v_cert.template_snapshot,v_cert.pdf_drive_file_id);
 update public.academy_certificates set template_id=v_template.id,template_snapshot=to_jsonb(v_template),
   pdf_drive_file_id=null,generated_at=null,reissue_count=v_seq,last_reissued_at=now()
 where id=v_cert.id returning * into v_cert;
 if p_request_id is not null then
   update public.academy_certificate_reissue_requests set status='approved',reviewed_by=auth.uid(),reviewed_at=now()
   where id=p_request_id and certificate_id=v_cert.id and status='pending';
 end if;
 insert into public.notifications(user_id,title,message,link)
 values(v_cert.user_id,'Nova via do certificado emitida','A '||(v_seq+1)||'ª via do seu certificado foi liberada pela Play Moments.','/certificados/'||v_cert.verification_code);
 return v_cert;
end $$;

grant execute on function public.academy_reissue_my_certificate(uuid,text) to authenticated;
grant execute on function public.academy_request_certificate_reissue(uuid,text) to authenticated;
grant execute on function public.academy_admin_reissue_certificate(uuid,uuid,text) to authenticated;
commit;
