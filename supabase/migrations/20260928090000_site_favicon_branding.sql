alter table public.app_settings add column if not exists favicon_url text;
update public.app_settings set favicon_url=coalesce(favicon_url,'/favicon.svg') where id=true;
insert into storage.buckets(id,name,public,file_size_limit,allowed_mime_types)
values('site-assets','site-assets',true,2097152,array['image/png','image/svg+xml','image/x-icon','image/webp'])
on conflict(id) do update set public=true,file_size_limit=2097152,allowed_mime_types=excluded.allowed_mime_types;
drop policy if exists "site assets public read" on storage.objects;
create policy "site assets public read" on storage.objects for select using(bucket_id='site-assets');
drop policy if exists "site assets admin write" on storage.objects;
create policy "site assets admin write" on storage.objects for all to authenticated
using(bucket_id='site-assets' and public.current_user_is_admin())
with check(bucket_id='site-assets' and public.current_user_is_admin());
