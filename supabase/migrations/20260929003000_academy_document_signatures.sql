-- Academy V1 #197 — academic signatures
begin;
create table if not exists public.academy_document_signatures (
 id uuid primary key default gen_random_uuid(),
 document_id uuid not null references public.academy_documents(id) on delete restrict,
 document_version integer not null check(document_version>0),
 signer_id uuid not null references public.profiles(id) on delete restrict,
 signer_role text not null check(signer_role in('student','administrator','coordinator','secretary','instructor')),
 signature_type text not null default 'electronic' check(signature_type in('electronic','acceptance')),
 document_hash text,
 signed_at timestamptz not null default now(),
 evidence jsonb not null default '{}'::jsonb,
 revoked_at timestamptz,
 created_at timestamptz not null default now(),
 unique(document_id,document_version,signer_id,signer_role)
);
create index if not exists academy_document_signatures_document_idx on public.academy_document_signatures(document_id,document_version);
alter table public.academy_document_signatures enable row level security;
drop policy if exists "academy signatures own read" on public.academy_document_signatures;
create policy "academy signatures own read" on public.academy_document_signatures for select to authenticated using(signer_id=auth.uid() or public.is_active_admin());
drop policy if exists "academy signatures admin manage" on public.academy_document_signatures;
create policy "academy signatures admin manage" on public.academy_document_signatures for all to authenticated using(public.is_active_admin()) with check(public.is_active_admin());

create or replace function public.academy_sign_document(p_document_id uuid,p_signer_role text default 'administrator')
returns public.academy_document_signatures language plpgsql security definer set search_path=public as $$
declare d public.academy_documents%rowtype; s public.academy_document_signatures%rowtype;
begin
 if not public.is_active_admin() then raise exception 'Acesso negado'; end if;
 if p_signer_role not in('administrator','coordinator','secretary','instructor') then raise exception 'Papel de assinatura inválido'; end if;
 select * into d from public.academy_documents where id=p_document_id;
 if not found or d.status not in('issued','signed') then raise exception 'Documento não está disponível para assinatura'; end if;
 insert into public.academy_document_signatures(document_id,document_version,signer_id,signer_role,document_hash,evidence)
 values(d.id,d.current_version,auth.uid(),p_signer_role,d.file_hash,jsonb_build_object('document_type',d.document_type,'title',d.title,'version',d.current_version))
 on conflict(document_id,document_version,signer_id,signer_role) do update set signed_at=excluded.signed_at,document_hash=excluded.document_hash,evidence=excluded.evidence,revoked_at=null
 returning * into s;
 update public.academy_documents set status='signed',updated_at=now() where id=d.id;
 return s;
end $$;
grant execute on function public.academy_sign_document(uuid,text) to authenticated;
commit;
