-- Expand customer account settings with contact/address, notifications and privacy.

alter table public.profiles
  add column if not exists document_number text,
  add column if not exists postal_code text,
  add column if not exists street text,
  add column if not exists address_number text,
  add column if not exists address_complement text,
  add column if not exists neighborhood text,
  add column if not exists city text,
  add column if not exists state text;

alter table public.user_preferences
  add column if not exists notify_portal boolean not null default true,
  add column if not exists notify_email boolean not null default true,
  add column if not exists notify_project_updates boolean not null default true,
  add column if not exists notify_file_updates boolean not null default true,
  add column if not exists notify_commercial_updates boolean not null default true,
  add column if not exists profile_contact_visible_to_team boolean not null default true;

revoke update on table public.profiles from authenticated;
grant update (
  first_name,
  last_name,
  phone,
  avatar_url,
  document_number,
  postal_code,
  street,
  address_number,
  address_complement,
  neighborhood,
  city,
  state
) on table public.profiles to authenticated;
