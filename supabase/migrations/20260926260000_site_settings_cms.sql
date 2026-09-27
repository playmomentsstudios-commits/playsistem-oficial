-- Persist public website settings managed from the admin CMS.
-- Requires migrations through 20260926250000_operational_notifications_preferences.sql.

create table if not exists public.site_settings (
  id boolean primary key default true check (id=true),
  company_name text not null default 'Play Moments',
  description text not null default 'Studio de criação, design digital e tecnologia em equipamentos.',
  hero_headline text not null default 'O que você precisa hoje?',
  hero_cta text not null default 'Falar agora',
  primary_color text not null default '#E30613',
  instagram_url text,
  youtube_url text,
  tiktok_url text,
  linkedin_url text,
  whatsapp text,
  contact_email text,
  contact_phone text,
  address text,
  meta_description text not null default 'Play Moments — Studio criativo de vídeo, design e tecnologia.',
  updated_at timestamptz not null default now(),
  updated_by uuid references auth.users(id) on delete set null
);

insert into public.site_settings(id,contact_email)
values(true,'contato@playmoments.com.br')
on conflict(id) do nothing;

alter table public.site_settings enable row level security;

drop policy if exists "public read site settings" on public.site_settings;
create policy "public read site settings"
on public.site_settings for select
using (true);

drop policy if exists "staff manage site settings" on public.site_settings;
create policy "staff manage site settings"
on public.site_settings for all to authenticated
using (
  exists(
    select 1 from public.profiles p
    where p.id=auth.uid() and p.role in ('admin','staff') and p.status='active'
  )
)
with check (
  exists(
    select 1 from public.profiles p
    where p.id=auth.uid() and p.role in ('admin','staff') and p.status='active'
  )
);

grant select on public.site_settings to anon,authenticated;
grant insert,update on public.site_settings to authenticated;
