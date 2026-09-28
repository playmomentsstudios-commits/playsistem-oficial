-- Catálogo público seguro da Academia para visitantes sem sessão.
begin;

create or replace function public.academy_public_courses()
returns jsonb
language sql stable security definer set search_path=public as $$
  select coalesce(jsonb_agg(
    jsonb_build_object(
      'id', c.id,
      'title', c.title,
      'slug', c.slug,
      'description', c.description,
      'category', c.category,
      'estimated_minutes', c.estimated_minutes,
      'cover_url', c.cover_url,
      'access_type', c.access_type,
      'instructor_name', c.instructor_name,
      'published_at', c.published_at
    )
    order by c.published_at desc nulls last, c.created_at desc
  ), '[]'::jsonb)
  from public.courses c
  where c.status='published' and c.access_type='free'
$$;

revoke all on function public.academy_public_courses() from public;
grant execute on function public.academy_public_courses() to anon,authenticated;

commit;
