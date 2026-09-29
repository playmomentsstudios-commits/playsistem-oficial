-- #203 — Landing Pages + Campanhas (estrutura enxuta)
begin;

create table if not exists public.site_campaigns (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  code text not null unique,
  status text not null default 'draft' check (status in ('draft','active','paused','finished')),
  source text,
  medium text,
  starts_at timestamptz,
  ends_at timestamptz,
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  created_by uuid references auth.users(id) on delete set null,
  updated_by uuid references auth.users(id) on delete set null
);

create table if not exists public.site_landing_pages (
  id uuid primary key default gen_random_uuid(),
  campaign_id uuid references public.site_campaigns(id) on delete set null,
  title text not null,
  slug text not null unique,
  status text not null default 'draft' check (status in ('draft','published','paused')),
  eyebrow text,
  headline text not null,
  subheadline text,
  cta_label text not null default 'Quero saber mais',
  cta_href text not null default '/contato',
  secondary_cta_label text,
  secondary_cta_href text,
  hero_image_url text,
  hero_image_drive_file_id text,
  hero_image_mime_type text,
  hero_image_file_size bigint,
  sections jsonb not null default '[]'::jsonb,
  seo_title text,
  seo_description text,
  canonical_url text,
  noindex boolean not null default false,
  published_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  created_by uuid references auth.users(id) on delete set null,
  updated_by uuid references auth.users(id) on delete set null,
  constraint site_landing_sections_array check (jsonb_typeof(sections)='array')
);

create index if not exists site_campaigns_status_idx on public.site_campaigns(status);
create index if not exists site_landing_pages_status_idx on public.site_landing_pages(status);
create index if not exists site_landing_pages_campaign_idx on public.site_landing_pages(campaign_id);

alter table public.site_campaigns enable row level security;
alter table public.site_landing_pages enable row level security;

drop policy if exists "public read published landing pages" on public.site_landing_pages;
create policy "public read published landing pages" on public.site_landing_pages
for select to anon,authenticated using(status='published' and (published_at is null or published_at<=now()));

drop policy if exists "admins manage site campaigns" on public.site_campaigns;
create policy "admins manage site campaigns" on public.site_campaigns
for all to authenticated using(public.is_active_admin()) with check(public.is_active_admin());

drop policy if exists "admins manage site landing pages" on public.site_landing_pages;
create policy "admins manage site landing pages" on public.site_landing_pages
for all to authenticated using(public.is_active_admin()) with check(public.is_active_admin());

commit;
