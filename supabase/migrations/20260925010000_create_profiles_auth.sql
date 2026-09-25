create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  email text not null,
  first_name text not null default '',
  last_name text not null default '',
  phone text,
  avatar_url text,
  role text not null default 'customer'
    check (role in ('customer', 'staff', 'admin')),
  status text not null default 'active'
    check (status in ('active', 'inactive', 'blocked')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create or replace function public.set_profiles_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists profiles_set_updated_at on public.profiles;

create trigger profiles_set_updated_at
before update on public.profiles
for each row
execute function public.set_profiles_updated_at();

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles (
    id,
    email,
    first_name,
    last_name,
    phone,
    role,
    status
  )
  values (
    new.id,
    coalesce(new.email, ''),
    coalesce(new.raw_user_meta_data ->> 'first_name', ''),
    coalesce(new.raw_user_meta_data ->> 'last_name', ''),
    nullif(new.raw_user_meta_data ->> 'phone', ''),
    'customer',
    'active'
  )
  on conflict (id) do nothing;

  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;

create trigger on_auth_user_created
after insert on auth.users
for each row
execute function public.handle_new_user();

insert into public.profiles (
  id,
  email,
  first_name,
  last_name,
  phone,
  role,
  status
)
select
  id,
  coalesce(email, ''),
  coalesce(raw_user_meta_data ->> 'first_name', ''),
  coalesce(raw_user_meta_data ->> 'last_name', ''),
  nullif(raw_user_meta_data ->> 'phone', ''),
  'customer',
  'active'
from auth.users
on conflict (id) do nothing;

alter table public.profiles enable row level security;

create or replace function public.current_user_is_staff_or_admin()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.profiles
    where id = auth.uid()
      and status = 'active'
      and role in ('admin', 'staff')
  );
$$;

revoke all on function public.current_user_is_staff_or_admin() from public;
grant execute on function public.current_user_is_staff_or_admin() to authenticated;

drop policy if exists "profiles_select" on public.profiles;
create policy "profiles_select"
on public.profiles
for select
to authenticated
using (
  id = auth.uid()
  or public.current_user_is_staff_or_admin()
);

drop policy if exists "profiles_update_own" on public.profiles;
create policy "profiles_update_own"
on public.profiles
for update
to authenticated
using (
  id = auth.uid()
  and status = 'active'
)
with check (
  id = auth.uid()
);

revoke all on table public.profiles from anon;
grant select on table public.profiles to authenticated;

revoke update on table public.profiles from authenticated;
grant update (
  first_name,
  last_name,
  phone,
  avatar_url
) on table public.profiles to authenticated;
