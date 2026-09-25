-- Mídia de produtos: bucket público, políticas de escrita para equipe e capa única.
-- Requer migrations anteriores até 20260925100000 aplicadas.

insert into storage.buckets(id,name,public,file_size_limit,allowed_mime_types)
values(
  'product-images',
  'product-images',
  true,
  10485760,
  array['image/jpeg','image/png','image/webp','image/avif']
)
on conflict (id) do update set
  public=true,
  file_size_limit=excluded.file_size_limit,
  allowed_mime_types=excluded.allowed_mime_types;

drop policy if exists product_image_objects_staff_insert on storage.objects;
create policy product_image_objects_staff_insert
on storage.objects
for insert
to authenticated
with check (
  bucket_id='product-images'
  and public.current_user_is_staff_or_admin()
);

drop policy if exists product_image_objects_staff_update on storage.objects;
create policy product_image_objects_staff_update
on storage.objects
for update
to authenticated
using (
  bucket_id='product-images'
  and public.current_user_is_staff_or_admin()
)
with check (
  bucket_id='product-images'
  and public.current_user_is_staff_or_admin()
);

drop policy if exists product_image_objects_staff_delete on storage.objects;
create policy product_image_objects_staff_delete
on storage.objects
for delete
to authenticated
using (
  bucket_id='product-images'
  and public.current_user_is_staff_or_admin()
);

with ranked_covers as (
  select id,row_number() over(partition by product_id order by display_order,id) as rn
  from public.product_images
  where is_cover=true
)
update public.product_images pi
set is_cover=false
from ranked_covers rc
where pi.id=rc.id and rc.rn>1;

create unique index if not exists product_images_single_cover_idx
on public.product_images(product_id)
where is_cover=true;

create or replace function public.set_product_cover(p_product_id uuid,p_image_id uuid)
returns void
language plpgsql
security definer
set search_path=public
as $$
begin
  if not public.current_user_is_staff_or_admin() then
    raise exception 'Staff access required' using errcode='42501';
  end if;

  if not exists(
    select 1 from public.product_images
    where id=p_image_id and product_id=p_product_id
  ) then
    raise exception 'Image not found for product' using errcode='P0002';
  end if;

  update public.product_images
  set is_cover=false
  where product_id=p_product_id;

  update public.product_images
  set is_cover=true
  where id=p_image_id;
end;
$$;

revoke all on function public.set_product_cover(uuid,uuid) from public;
grant execute on function public.set_product_cover(uuid,uuid) to authenticated;
