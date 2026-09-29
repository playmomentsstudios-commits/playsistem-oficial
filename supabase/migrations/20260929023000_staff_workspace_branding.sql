-- Master-controlled branding for the collaborator workspace.
begin;
alter table public.app_settings
  add column if not exists staff_logo_url text default '/staff-logo.svg',
  add column if not exists staff_platform_name text not null default 'Área do colaborador',
  add column if not exists staff_primary_color text not null default '#E30613',
  add column if not exists staff_background_color text not null default '#F4F6F8',
  add column if not exists staff_surface_color text not null default '#FFFFFF',
  add column if not exists staff_text_color text not null default '#17171A';
update public.app_settings
set staff_logo_url=coalesce(staff_logo_url,'/staff-logo.svg')
where id=true;
commit;
