-- First-party public content views: one unique view per IP/content/day.
begin;

create table if not exists public.public_content_views (
  id uuid primary key default gen_random_uuid(),
  view_date date not null,
  visitor_hash text not null,
  content_type text not null check (content_type in ('page','product','service','resume','landing','course')),
  content_key text not null,
  path text not null,
  referrer_host text,
  created_at timestamptz not null default now(),
  constraint public_content_views_path_length check (length(path) <= 500),
  constraint public_content_views_key_length check (length(content_key) <= 240),
  constraint public_content_views_hash_length check (length(visitor_hash) between 32 and 128)
);

create unique index if not exists public_content_views_daily_unique_idx
  on public.public_content_views(view_date, visitor_hash, content_type, content_key);

create index if not exists public_content_views_type_date_idx
  on public.public_content_views(content_type, view_date desc);

create index if not exists public_content_views_key_date_idx
  on public.public_content_views(content_type, content_key, view_date desc);

alter table public.public_content_views enable row level security;
revoke all on public.public_content_views from anon, authenticated;
grant select, insert on public.public_content_views to service_role;

create or replace function public.public_view_summary(p_days integer default 30)
returns jsonb
language plpgsql
security definer
set search_path=public
as $$
declare
  v_since date;
  v_total bigint;
  v_today bigint;
  v_by_type jsonb;
  v_top jsonb;
  v_daily jsonb;
begin
  if not (public.current_user_is_admin() or public.current_user_has_permission('reports.view')) then
    raise exception 'Reports permission required' using errcode='42501';
  end if;

  if p_days not in (7,30,90) then
    raise exception 'Invalid period' using errcode='22023';
  end if;

  v_since := (timezone('America/Sao_Paulo', now())::date - (p_days - 1));

  select count(*) into v_total
  from public.public_content_views
  where view_date >= v_since;

  select count(*) into v_today
  from public.public_content_views
  where view_date = timezone('America/Sao_Paulo', now())::date;

  select coalesce(
    jsonb_agg(
      jsonb_build_object('content_type',content_type,'total',total)
      order by total desc, content_type
    ),
    '[]'::jsonb
  )
  into v_by_type
  from (
    select content_type,count(*)::bigint as total
    from public.public_content_views
    where view_date >= v_since
    group by content_type
  ) s;

  select coalesce(
    jsonb_agg(
      jsonb_build_object(
        'content_type',content_type,
        'content_key',content_key,
        'path',path,
        'label',label,
        'total',total
      )
      order by total desc, label
    ),
    '[]'::jsonb
  )
  into v_top
  from (
    select
      v.content_type,
      v.content_key,
      min(v.path) as path,
      case
        when v.content_type='product' then coalesce((select p.name from public.products p where p.slug=v.content_key limit 1),v.content_key)
        when v.content_type='service' then coalesce((select s.name from public.services s where s.slug=v.content_key limit 1),v.content_key)
        when v.content_type='resume' then coalesce((select coalesce(r.display_name,r.internal_title,r.slug) from public.resumes r where r.slug=v.content_key limit 1),v.content_key)
        when v.content_type='landing' then coalesce((select l.title from public.site_landing_pages l where l.slug=v.content_key limit 1),v.content_key)
        else case when v.content_key='/' then 'Página inicial' else v.content_key end
      end as label,
      count(*)::bigint as total
    from public.public_content_views v
    where v.view_date >= v_since
    group by v.content_type,v.content_key
    order by count(*) desc
    limit 20
  ) ranked;

  select coalesce(
    jsonb_agg(
      jsonb_build_object('date',day::text,'total',coalesce(total,0))
      order by day
    ),
    '[]'::jsonb
  )
  into v_daily
  from (
    select d::date as day,count(v.id)::bigint as total
    from generate_series(v_since, timezone('America/Sao_Paulo', now())::date, interval '1 day') d
    left join public.public_content_views v on v.view_date=d::date
    group by d::date
    order by d::date
  ) series;

  return jsonb_build_object(
    'period_days',p_days,
    'total_views',v_total,
    'today_views',v_today,
    'by_type',v_by_type,
    'top_items',v_top,
    'daily',v_daily
  );
end
$$;

revoke all on function public.public_view_summary(integer) from public;
grant execute on function public.public_view_summary(integer) to authenticated;

commit;
