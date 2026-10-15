-- Academy library content management. No changes to existing SAGA NEGRA media/grants.
alter table public.academy_library_items
  add column if not exists description text,
  add column if not exists author_name text,
  add column if not exists cover_url text,
  add column if not exists cover_drive_file_id text,
  add column if not exists banner_url text,
  add column if not exists sample_text text,
  add column if not exists sample_audio_url text,
  add column if not exists landing_page_id uuid references public.site_landing_pages(id) on delete set null;

create index if not exists academy_library_items_landing_page_idx
on public.academy_library_items(landing_page_id);

-- Create a customisable draft landing for NEW library content only, not for the
-- 12 existing releases whose hand-crafted landing pages must be preserved.
create or replace function public.academy_library_create_landing_on_insert()
returns trigger language plpgsql security definer set search_path='' as $$
declare v_landing uuid;
begin
  if not public.is_active_admin() then
    raise exception 'Admin access required' using errcode='42501';
  end if;
  insert into public.site_landing_pages (
    title,slug,status,eyebrow,headline,subheadline,cta_label,cta_href,
    hero_image_url,hero_image_drive_file_id,sections,seo_title,
    seo_description,noindex,created_by,updated_by
  ) values (
    NEW.title||case when NEW.format='ebook' then ' · E-book' else ' · Audiobook' end,
    'biblioteca-'||NEW.slug||'-'||left(replace(NEW.id::text,'-',''),8),
    'draft',
    case when NEW.format='ebook' then 'Academia Sagamente · E-book' else 'Academia Sagamente · Audiobook' end,
    NEW.title,
    coalesce(nullif(NEW.description,''),'Conheça este conteúdo digital da Academia Sagamente.'),
    'Conhecer a Academia','/academia',
    coalesce(NEW.banner_url,NEW.cover_url),NEW.cover_drive_file_id,
    jsonb_build_array(jsonb_build_object('type','cta','title','Conheça a obra',
      'text','Fale com a equipe Sagamente para saber sobre formatos e disponibilidade.')),
    left(NEW.title||' | Academia Sagamente',180),
    left(coalesce(nullif(NEW.description,''),NEW.title),300),
    true,auth.uid(),auth.uid()
  ) returning id into v_landing;
  update public.academy_library_items set landing_page_id=v_landing where id=NEW.id;
  return NEW;
end $$;

drop trigger if exists academy_library_auto_landing_create on public.academy_library_items;
create trigger academy_library_auto_landing_create
after insert on public.academy_library_items
for each row execute function public.academy_library_create_landing_on_insert();

-- Only a deliberate change in publication status publishes/pauses a linked
-- landing. Editing the landing independently never republishes archived work.
create or replace function public.academy_library_sync_landing_status()
returns trigger language plpgsql security definer set search_path='' as $$
begin
  if NEW.landing_page_id is not null and NEW.status is distinct from OLD.status then
    update public.site_landing_pages
    set status=case when NEW.status='published' then 'published' else 'paused' end,
        noindex=NEW.status<>'published',
        published_at=case when NEW.status='published' then coalesce(published_at,now()) else published_at end,
        updated_at=now()
    where id=NEW.landing_page_id;
  end if;
  return NEW;
end $$;
drop trigger if exists academy_library_landing_status on public.academy_library_items;
create trigger academy_library_landing_status
after update of status on public.academy_library_items
for each row execute function public.academy_library_sync_landing_status();

revoke all on function public.academy_library_create_landing_on_insert() from public,anon,authenticated;
revoke all on function public.academy_library_sync_landing_status() from public,anon,authenticated;

-- Public preview endpoint: NEVER returns Drive IDs, original filenames, grants or
-- private media tickets. Draft pages are visible to active administrators only.
create or replace function public.academy_public_library_landing(p_slug text)
returns table(
 title text,format text,description text,author_name text,
 cover_url text,sample_text text,sample_audio_url text
) language sql stable security definer set search_path='' as $$
 select i.title,i.format,i.description,i.author_name,i.cover_url,i.sample_text,i.sample_audio_url
 from public.academy_library_items i
 join public.site_landing_pages p on p.id=i.landing_page_id
 where p.slug=p_slug
   and (
     public.is_active_admin()
     or (p.status='published' and (p.published_at is null or p.published_at<=now())
         and i.status='published')
   )
 limit 1
$$;
revoke all on function public.academy_public_library_landing(text) from public;
grant execute on function public.academy_public_library_landing(text) to anon,authenticated;

-- Add cover artwork to the existing private library without changing the
-- return signature of academy_my_library() or exposing original Drive IDs.
create or replace function public.academy_my_library_artwork()
returns table(item_id uuid,cover_url text)
language sql stable security definer set search_path='' as $$
 select i.id,i.cover_url
 from public.academy_library_items i
 join public.academy_library_grants g on g.item_id=i.id
 join public.profiles p on p.id=g.user_id
 where g.user_id=auth.uid() and g.active=true and p.status='active'
 and i.status in ('private_beta','published')
$$;
revoke all on function public.academy_my_library_artwork() from public;
grant execute on function public.academy_my_library_artwork() to authenticated;
