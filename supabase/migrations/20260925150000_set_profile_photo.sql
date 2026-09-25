-- Set the shipped Play Moments profile portrait as the default public photo.
update public.site_profile
set
  photo_url = '/profile/felipe-costa.webp',
  updated_at = now()
where id = true
  and (photo_url is null or btrim(photo_url) = '');
