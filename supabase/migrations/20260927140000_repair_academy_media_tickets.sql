-- Repair Academy media ticket table when the original foundation migration
-- was recorded/applied without the table being visible to PostgREST.
-- Safe to run whether the table already exists or not.

create table if not exists public.academy_media_tickets (
  token uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  drive_file_id text not null,
  purpose text not null check (purpose in ('lesson_video','material')),
  expires_at timestamptz not null default (now() + interval '15 minutes'),
  created_at timestamptz not null default now()
);

create index if not exists academy_media_tickets_expiry_idx
  on public.academy_media_tickets(expires_at);

alter table public.academy_media_tickets enable row level security;

do $$
begin
  if not exists (
    select 1 from pg_policies
    where schemaname='public'
      and tablename='academy_media_tickets'
      and policyname='academy users view own media tickets'
  ) then
    create policy "academy users view own media tickets"
      on public.academy_media_tickets
      for select
      using (user_id = auth.uid());
  end if;

  if not exists (
    select 1 from pg_policies
    where schemaname='public'
      and tablename='academy_media_tickets'
      and policyname='academy admins manage media tickets'
  ) then
    create policy "academy admins manage media tickets"
      on public.academy_media_tickets
      for all
      using (public.is_active_admin())
      with check (public.is_active_admin());
  end if;
end
$$;

-- Force PostgREST to refresh its schema cache immediately after the repair.
notify pgrst, 'reload schema';
