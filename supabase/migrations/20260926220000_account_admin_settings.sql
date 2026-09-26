-- Persistent customer preferences and admin operational settings.

create table if not exists public.user_preferences (
  user_id uuid primary key references public.profiles(id) on delete cascade,
  sidebar_expanded boolean not null default false,
  floating_chat_enabled boolean not null default true,
  updated_at timestamptz not null default now()
);

insert into public.user_preferences(user_id)
select id from public.profiles
on conflict(user_id) do nothing;

create table if not exists public.app_settings (
  id boolean primary key default true check(id=true),
  business_name text not null default 'Play Moments',
  currency text not null default 'BRL',
  timezone text not null default 'America/Sao_Paulo',
  default_project_priority text not null default 'medium'
    check(default_project_priority in ('low','medium','high','urgent')),
  default_quote_valid_days integer not null default 7
    check(default_quote_valid_days between 1 and 90),
  default_client_file_visibility boolean not null default false,
  drive_upload_limit_gb integer not null default 50
    check(drive_upload_limit_gb between 1 and 50),
  updated_at timestamptz not null default now(),
  updated_by uuid references public.profiles(id) on delete set null
);

insert into public.app_settings(id)
values(true)
on conflict(id) do nothing;

alter table public.user_preferences enable row level security;
alter table public.app_settings enable row level security;

drop policy if exists user_preferences_own on public.user_preferences;
create policy user_preferences_own
on public.user_preferences
for all to authenticated
using(user_id=auth.uid())
with check(user_id=auth.uid());

drop policy if exists app_settings_read on public.app_settings;
create policy app_settings_read
on public.app_settings
for select to authenticated
using(public.current_user_is_staff_or_admin());

drop policy if exists app_settings_admin_write on public.app_settings;
create policy app_settings_admin_write
on public.app_settings
for all to authenticated
using(public.current_user_is_admin())
with check(public.current_user_is_admin());

grant select,insert,update on public.user_preferences to authenticated;
grant select on public.app_settings to authenticated;
grant insert,update on public.app_settings to authenticated;

create or replace function public.set_settings_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at=now();
  return new;
end;
$$;

drop trigger if exists user_preferences_updated_at on public.user_preferences;
create trigger user_preferences_updated_at
before update on public.user_preferences
for each row execute function public.set_settings_updated_at();

drop trigger if exists app_settings_updated_at on public.app_settings;
create trigger app_settings_updated_at
before update on public.app_settings
for each row execute function public.set_settings_updated_at();
