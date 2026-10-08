-- PWA identity: publicly readable metadata, exclusively editable by active admin.
-- The Drive stores binaries; the database stores only verified Drive file identifiers.
create table if not exists public.pwa_settings (
  id boolean primary key default true check (id = true),
  name text not null default 'Sagamente' check (char_length(btrim(name)) between 1 and 80),
  short_name text not null default 'Sagamente' check (char_length(btrim(short_name)) between 1 and 24),
  description text not null default 'Projetos, serviços, arquivos, cursos e tecnologia em um só lugar.'
    check (char_length(description) between 1 and 250),
  theme_color text not null default '#0a0a0b' check (theme_color ~ '^#[0-9A-Fa-f]{6}$'),
  background_color text not null default '#0a0a0b' check (background_color ~ '^#[0-9A-Fa-f]{6}$'),
  icon_180_drive_file_id text,
  icon_192_drive_file_id text,
  icon_512_drive_file_id text,
  icon_maskable_drive_file_id text,
  updated_at timestamptz not null default now(),
  updated_by uuid references auth.users(id),
  constraint pwa_icon_180_valid check (icon_180_drive_file_id is null or icon_180_drive_file_id ~ '^[a-zA-Z0-9_-]{10,128}$'),
  constraint pwa_icon_192_valid check (icon_192_drive_file_id is null or icon_192_drive_file_id ~ '^[a-zA-Z0-9_-]{10,128}$'),
  constraint pwa_icon_512_valid check (icon_512_drive_file_id is null or icon_512_drive_file_id ~ '^[a-zA-Z0-9_-]{10,128}$'),
  constraint pwa_icon_maskable_valid check (icon_maskable_drive_file_id is null or icon_maskable_drive_file_id ~ '^[a-zA-Z0-9_-]{10,128}$')
);
insert into public.pwa_settings (id) values (true) on conflict (id) do nothing;
alter table public.pwa_settings enable row level security;

create policy "Anyone can read public PWA identity" on public.pwa_settings
  for select to anon, authenticated using (true);

create policy "Only active master admin updates PWA identity" on public.pwa_settings
  for update to authenticated
  using (exists (
    select 1 from public.profiles p
    where p.id = (select auth.uid()) and p.role = 'admin' and p.status = 'active'
  ))
  with check (exists (
    select 1 from public.profiles p
    where p.id = (select auth.uid()) and p.role = 'admin' and p.status = 'active'
  ));

revoke all on table public.pwa_settings from anon, authenticated;
grant select on public.pwa_settings to anon, authenticated;
grant update (name,short_name,description,theme_color,background_color,
  icon_180_drive_file_id,icon_192_drive_file_id,icon_512_drive_file_id,
  icon_maskable_drive_file_id,updated_at,updated_by)
  on public.pwa_settings to authenticated;
