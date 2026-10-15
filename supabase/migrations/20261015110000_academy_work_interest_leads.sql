-- Academy commercial interest pilot. Capturing interest never charges money
-- or grants access to the paid/private PDF and MP3 content.
create table if not exists public.academy_work_interests(
 id uuid primary key default gen_random_uuid(),
 work_id uuid not null references public.academy_library_works(id) on delete restrict,
 requested_format text not null check (requested_format in ('ebook','audiobook','combo')),
 contact_name text not null check (char_length(contact_name) between 2 and 120),
 whatsapp_digits text not null check (whatsapp_digits ~ '^[0-9]{10,13}$'),
 contact_email text,
 contact_consent_at timestamptz not null,
 source text not null default 'landing',
 utm_source text,
 utm_campaign text,
 stage text not null default 'novo'
  check (stage in ('novo','em_contato','convertido','perdido')),
 internal_notes text,
 updated_by uuid,
 created_at timestamptz not null default now(),
 updated_at timestamptz not null default now()
);
create index if not exists academy_work_interests_work_created
on public.academy_work_interests(work_id,created_at desc);
create index if not exists academy_work_interests_stage_created
on public.academy_work_interests(stage,created_at desc);
create index if not exists academy_work_interests_whatsapp_time
on public.academy_work_interests(whatsapp_digits,created_at desc);
alter table public.academy_work_interests enable row level security;
drop policy if exists academy_work_interests_admin_read on public.academy_work_interests;
drop policy if exists academy_work_interests_admin_update on public.academy_work_interests;
create policy academy_work_interests_admin_read on public.academy_work_interests
 for select to authenticated using (public.is_active_admin());
create policy academy_work_interests_admin_update on public.academy_work_interests
 for update to authenticated using (public.is_active_admin())
 with check (public.is_active_admin());
revoke all on public.academy_work_interests from public,anon,authenticated;
grant select,update on public.academy_work_interests to authenticated;

-- Public endpoint validates a live work, requested format and contact.
-- Honeypot and per-number cooldown limit accidental/spam duplicate requests.
-- Contact information is never returned via public functions.
create or replace function public.academy_submit_work_interest(
 p_release_code text,
 p_requested_format text,
 p_contact_name text,
 p_whatsapp text,
 p_contact_email text default null,
 p_contact_consent boolean default false,
 p_utm_source text default null,
 p_utm_campaign text default null,
 p_website text default ''
) returns uuid
language plpgsql security definer set search_path=''
as $$
declare
 v_work uuid;
 v_phone text;
 v_name text;
 v_email text;
 v_id uuid;
begin
 if coalesce(btrim(p_website),'')<>'' then return gen_random_uuid(); end if;
 if p_contact_consent is distinct from true then
  raise exception 'É necessário autorizar o contato sobre esta obra.' using errcode='22023';
 end if;
 v_phone:=regexp_replace(coalesce(p_whatsapp,''),'[^0-9]','','g');
 v_name:=btrim(coalesce(p_contact_name,''));
 v_email:=nullif(lower(btrim(coalesce(p_contact_email,''))),'');
 if char_length(v_name) not between 2 and 120
    or char_length(v_phone) not between 10 and 13
    or v_phone !~ '^[0-9]+$'
    or (v_email is not null and (char_length(v_email)>160 or v_email !~ '^[A-Za-z0-9._%+\-]+@[A-Za-z0-9.\-]+\.[A-Za-z]{2,}$')) then
  raise exception 'Confira seu nome, WhatsApp e e-mail.' using errcode='22023';
 end if;
 if p_requested_format not in ('ebook','audiobook','combo') then
  raise exception 'Selecione e-book, audiobook ou combo.' using errcode='22023';
 end if;
 select w.id into v_work
 from public.academy_library_works w
 join public.site_landing_pages p on p.id=w.landing_page_id
 where w.release_code=p_release_code and p.status='published'
  and (p.published_at is null or p.published_at<=now())
  and (
   (p_requested_format='ebook' and exists(
     select 1 from public.academy_library_items i where i.work_id=w.id and i.format='ebook'
       and i.status in ('private_beta','published')))
   or
   (p_requested_format='audiobook' and exists(
     select 1 from public.academy_library_items i where i.work_id=w.id and i.format='audiobook'
       and i.status in ('private_beta','published')))
   or
   (p_requested_format='combo' and exists(
     select 1 from public.academy_library_items i where i.work_id=w.id and i.format='ebook'
       and i.status in ('private_beta','published'))
       and exists(
     select 1 from public.academy_library_items i where i.work_id=w.id and i.format='audiobook'
       and i.status in ('private_beta','published')))
  )
 limit 1;
 if v_work is null then
  raise exception 'Esta opção não está disponível no momento.' using errcode='22023';
 end if;
 perform pg_advisory_xact_lock(hashtextextended(v_phone,21));
 -- Prevent repeated requests for the same selection; avoid revealing whether a
 -- phone already submitted by returning an opaque value.
 if exists (
  select 1 from public.academy_work_interests i
  where i.whatsapp_digits=v_phone and i.work_id=v_work
    and i.requested_format=p_requested_format
    and i.created_at>now()-interval '30 minutes'
 ) then return gen_random_uuid(); end if;
 if (select count(*) from public.academy_work_interests i
  where i.whatsapp_digits=v_phone and i.created_at>now()-interval '24 hours')>=8 then
  return gen_random_uuid();
 end if;
 insert into public.academy_work_interests (
  work_id,requested_format,contact_name,whatsapp_digits,
  contact_email,contact_consent_at,utm_source,utm_campaign
 ) values (
  v_work,p_requested_format,v_name,v_phone,v_email,now(),
  nullif(left(btrim(coalesce(p_utm_source,'')),80),''),
  nullif(left(btrim(coalesce(p_utm_campaign,'')),80),'')
 ) returning id into v_id;
 return v_id;
end $$;

revoke all on function public.academy_submit_work_interest(text,text,text,text,text,boolean,text,text,text)
 from public,anon,authenticated;
grant execute on function public.academy_submit_work_interest(text,text,text,text,text,boolean,text,text,text)
 to anon,authenticated;

-- Canonical landing metadata must match the live purchase-intent experience.
-- Preserve long-form written sections and all existing landing slugs.
-- The Release 22 ebook alias remains noindex, pointing at the canonical landing.
update public.site_landing_pages p
set cta_label='Quero adquirir',
    cta_href='/academia/interesse/'||w.release_code,
    noindex=false,
    seo_description=case when w.release_code='22'
      then left(coalesce(nullif(w.description,''),w.title)||
         '. Escolha e-book, audiobook ou combo e solicite as condições de compra.',300)
      else left(regexp_replace(
         coalesce(p.seo_description,w.title),
         'Pré-lançamento[^.]*\\.',
         'Escolha e-book, audiobook ou combo e peça as condições de compra.','gi'),300)
    end,
    updated_at=now()
from public.academy_library_works w
where w.landing_page_id=p.id and p.status='published';
