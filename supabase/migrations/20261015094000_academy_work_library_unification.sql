-- Organize one public book work with two independently permissioned formats.
-- Historical items, access grants, original file ids and landing URLs are preserved.
create table if not exists public.academy_library_works (
  id uuid primary key default gen_random_uuid(),
  release_code text not null unique,
  title text not null,
  slug text not null unique,
  description text,
  cover_url text,
  banner_url text,
  landing_page_id uuid references public.site_landing_pages(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
alter table public.academy_library_works enable row level security;
drop policy if exists academy_library_works_admin on public.academy_library_works;
create policy academy_library_works_admin on public.academy_library_works
  for all to authenticated using (public.is_active_admin())
  with check (public.is_active_admin());
grant select,insert,update,delete on public.academy_library_works to authenticated;

alter table public.academy_library_items add column if not exists work_id uuid references public.academy_library_works(id) on delete restrict;
create index if not exists academy_library_items_work_idx on public.academy_library_items(work_id);

-- Idempotent backfill: do not rename/move/delete any release, Drive file or grant.
insert into public.academy_library_works(release_code,title,slug,description)
select distinct on (release_code)
  release_code,title,
  case when release_code ~ '^[0-9]{2}$' then 'saga-negra-release-'||release_code
       else 'obra-'||lower(regexp_replace(release_code,'[^a-zA-Z0-9_-]+','-','g')) end,
  description
from public.academy_library_items
order by release_code, (case when description is not null and btrim(description)<>'' then 0 else 1 end),
  (case when format='ebook' then 0 else 1 end), created_at
on conflict (release_code) do nothing;

-- Associate six carefully authored, already-published original SAGA NEGRA landings.
-- A single landing is shared by both formats; its original URL/SEO remains untouched.
update public.academy_library_works w
set landing_page_id=p.id,
    description=coalesce(nullif(w.description,''),p.subheadline),
    cover_url=coalesce(w.cover_url,nullif(p.hero_image_url,'')),
    banner_url=coalesce(w.banner_url,nullif(p.hero_image_url,''))
from public.site_landing_pages p
where w.release_code in ('00','01','02','03','04','05')
and p.slug = case w.release_code
  when '00' then 'saga-negra-entre-fracasso-e-prosperidade'
  when '01' then 'saga-negra-o-direito-de-descansar'
  when '02' then 'saga-negra-amor-afeto-e-solidao-negra'
  when '03' then 'saga-negra-paternidade-negra-presenca-ausencia-e-reconstrucao'
  when '04' then 'saga-negra-educacao-o-conhecimento-que-abre-portas'
  when '05' then 'saga-negra-justica-prisao-e-liberdade'
end;

-- Release 22: audiobook landing becomes canonical. Keep the ebook's original
-- published landing as an alias: the router redirects it to the canonical work.
update public.academy_library_works w
set landing_page_id=a.landing_page_id,
    description=coalesce(nullif(w.description,''),nullif(a.description,'')),
    cover_url=coalesce(w.cover_url,a.cover_url),
    banner_url=coalesce(w.banner_url,a.banner_url)
from public.academy_library_items a
where w.release_code=a.release_code and w.release_code='22'
  and a.format='audiobook' and a.landing_page_id is not null;

update public.academy_library_items i
set work_id=w.id,
  landing_page_id=coalesce(i.landing_page_id,w.landing_page_id)
from public.academy_library_works w
where i.release_code=w.release_code
  and (i.work_id is distinct from w.id
     or (i.landing_page_id is null and w.landing_page_id is not null));

-- Avoid assigning a single landing as canonical to two different works.
create unique index if not exists academy_library_works_canonical_landing_key
on public.academy_library_works(landing_page_id) where landing_page_id is not null;

-- The Ebook Release 22 URL stays reachable as an alias but should not be
-- indexed as a competing second public offer for the same work.
update public.site_landing_pages alias
set noindex=true,canonical_url='https://playsistem-oficial.playmomentsstudios.workers.dev/l/'||canonical.slug,
    updated_at=now()
from public.academy_library_items e
join public.academy_library_works w on w.id=e.work_id
join public.site_landing_pages canonical on canonical.id=w.landing_page_id
where e.release_code='22' and e.format='ebook'
 and alias.id=e.landing_page_id and alias.id<>canonical.id;

-- Admin inserts must create one work and ONE draft landing for the first format.
-- Second-format inserts reuse the existing work and canonical landing.
create or replace function public.academy_library_create_landing_on_insert()
returns trigger language plpgsql security definer set search_path='' as $$
declare v_work uuid; v_landing uuid; v_slug text;
begin
 if not public.is_active_admin() then
  raise exception 'Admin access required' using errcode='42501';
 end if;
 v_slug := case when NEW.release_code ~ '^[0-9]{2}$' then 'saga-negra-release-'||NEW.release_code
   else 'obra-'||lower(regexp_replace(NEW.release_code,'[^a-zA-Z0-9_-]+','-','g')) end;
 insert into public.academy_library_works(release_code,title,slug,description,cover_url,banner_url)
 values (NEW.release_code,NEW.title,v_slug,NEW.description,NEW.cover_url,NEW.banner_url)
 on conflict (release_code) do nothing;
 select id,landing_page_id into v_work,v_landing
 from public.academy_library_works where release_code=NEW.release_code for update;
 if v_landing is null then
  insert into public.site_landing_pages
    (title,slug,status,eyebrow,headline,subheadline,cta_label,cta_href,
     hero_image_url,hero_image_drive_file_id,sections,seo_title,seo_description,
     noindex,created_by,updated_by)
  values (NEW.title,'biblioteca-'||NEW.slug||'-'||left(replace(v_work::text,'-',''),8),
   'draft','Academia Sagamente · Obra digital',NEW.title,
   coalesce(nullif(NEW.description,''),'Conheça esta obra da Academia Sagamente.'),
   'Explorar a Academia','/academia',coalesce(NEW.banner_url,NEW.cover_url),
   NEW.cover_drive_file_id,
   jsonb_build_array(jsonb_build_object('type','cta','title','Conheça a obra',
    'text','Escolha como ler ou ouvir esta obra na Academia Sagamente.')),
   left(NEW.title||' | Academia Sagamente',180),
   left(coalesce(nullif(NEW.description,''),NEW.title),300),
   true,auth.uid(),auth.uid())
  returning id into v_landing;
  update public.academy_library_works set landing_page_id=v_landing,
    updated_at=now() where id=v_work;
 end if;
 update public.academy_library_items
  set work_id=v_work,landing_page_id=v_landing where id=NEW.id;
 return NEW;
end $$;

-- Publishing a format opens the work landing; disabling one format never hides
-- a still-available sibling. Historical beta/prelaunch landings remain intact.
create or replace function public.academy_library_sync_landing_status()
returns trigger language plpgsql security definer set search_path='' as $$
declare v_landing uuid;
begin
 if NEW.status is not distinct from OLD.status then return NEW; end if;
 select w.landing_page_id into v_landing
 from public.academy_library_works w where w.id=NEW.work_id;
 if v_landing is null then return NEW; end if;
 if NEW.status='published' then
  update public.site_landing_pages
  set status='published',noindex=false,
      published_at=coalesce(published_at,now()),updated_at=now()
  where id=v_landing;
 elsif not exists (
  select 1 from public.academy_library_items i
  where i.work_id=NEW.work_id and i.status in ('published','private_beta')
 ) then
  update public.site_landing_pages set status='paused',noindex=true,
    updated_at=now() where id=v_landing;
 end if;
 return NEW;
end $$;

-- Public catalog contains metadata only; no Drive file IDs, grants, user ids
-- or source filenames. Private beta materials can be marketed as previews.
create or replace function public.academy_public_works()
returns table(
  release_code text,title text,description text,cover_url text,
  landing_slug text,ebook_status text,audiobook_status text
) language sql stable security definer set search_path='' as $$
 select w.release_code,w.title,coalesce(nullif(w.description,''),p.subheadline),
   coalesce(w.cover_url,p.hero_image_url),p.slug,
   (select i.status from public.academy_library_items i
     where i.work_id=w.id and i.format='ebook' and i.status in ('published','private_beta') limit 1),
   (select i.status from public.academy_library_items i
     where i.work_id=w.id and i.format='audiobook' and i.status in ('published','private_beta') limit 1)
 from public.academy_library_works w
 join public.site_landing_pages p on p.id=w.landing_page_id
 where p.status='published' and (p.published_at is null or p.published_at<=now())
 and exists (select 1 from public.academy_library_items i where i.work_id=w.id
   and i.status in ('published','private_beta'))
 order by w.release_code;
$$;

-- Both legacy landing URLs and the new ebook alias resolve to a single work.
create or replace function public.academy_public_work_landing(p_slug text)
returns table(
  release_code text,title text,description text,author_name text,
  cover_url text,banner_url text,canonical_slug text,
  ebook_status text,audiobook_status text,sample_text text,sample_audio_url text
) language sql stable security definer set search_path='' as $$
 select w.release_code,w.title,coalesce(nullif(w.description,''),c.subheadline),
   coalesce(e.author_name,a.author_name),
   coalesce(w.cover_url,c.hero_image_url),coalesce(w.banner_url,c.hero_image_url),
   c.slug,
   case when e.status in ('published','private_beta') then e.status end,
   case when a.status in ('published','private_beta') then a.status end,
   e.sample_text,a.sample_audio_url
 from public.academy_library_works w
 join public.site_landing_pages c on c.id=w.landing_page_id
 left join public.academy_library_items e on e.work_id=w.id and e.format='ebook'
 left join public.academy_library_items a on a.work_id=w.id and a.format='audiobook'
 join public.site_landing_pages requested on
   (requested.id=w.landing_page_id or requested.id=e.landing_page_id or requested.id=a.landing_page_id)
 where requested.slug=p_slug and requested.status='published'
 and (requested.published_at is null or requested.published_at<=now())
 and c.status='published' and (c.published_at is null or c.published_at<=now())
 and (e.status in ('published','private_beta') or a.status in ('published','private_beta'))
 limit 1
$$;
revoke all on function public.academy_public_works() from public;
revoke all on function public.academy_public_work_landing(text) from public;
grant execute on function public.academy_public_works() to anon,authenticated;
grant execute on function public.academy_public_work_landing(text) to anon,authenticated;

-- Cover images of the work shared by both paid or manually granted formats.
create or replace function public.academy_my_library_artwork()
returns table(item_id uuid,cover_url text)
language sql stable security definer set search_path='' as $$
 select i.id,coalesce(i.cover_url,w.cover_url)
 from public.academy_library_items i
 join public.academy_library_grants g on g.item_id=i.id
 join public.profiles p on p.id=g.user_id
 left join public.academy_library_works w on w.id=i.work_id
 where g.user_id=auth.uid() and g.active=true and p.status='active'
 and i.status in ('private_beta','published');
$$;
revoke all on function public.academy_my_library_artwork() from public;
grant execute on function public.academy_my_library_artwork() to authenticated;
