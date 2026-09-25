-- Persistent support conversations, protected by the existing Supabase Auth profiles.
create table public.conversations (
  id uuid primary key default gen_random_uuid(),
  customer_id uuid not null unique references public.profiles(id) on delete cascade,
  created_at timestamptz not null default now()
);
create table public.messages (
  id uuid primary key default gen_random_uuid(),
  conversation_id uuid not null references public.conversations(id) on delete cascade,
  sender_id uuid not null references public.profiles(id),
  content text not null check (char_length(trim(content)) between 1 and 5000),
  created_at timestamptz not null default now()
);
create index messages_conversation_created on public.messages(conversation_id, created_at, id);
alter table public.conversations enable row level security;
alter table public.messages enable row level security;
revoke all on public.conversations, public.messages from anon, authenticated;
grant select on public.conversations, public.messages to authenticated;
grant insert (id, conversation_id, sender_id, content) on public.messages to authenticated;
create policy conversations_read on public.conversations for select to authenticated
using (public.current_user_is_staff_or_admin() or (customer_id = auth.uid() and exists (
  select 1 from public.profiles where id = auth.uid() and status = 'active' and role = 'customer'
)));
-- Parent SELECT is itself subject to RLS, including active-account checks.
create policy messages_read on public.messages for select to authenticated
using (exists (select 1 from public.conversations where id = conversation_id));
create policy messages_send on public.messages for insert to authenticated
with check (sender_id = auth.uid() and exists (
  select 1 from public.conversations where id = conversation_id
));
-- Atomic and idempotent, including requests from concurrent tabs.
create function public.open_customer_conversation()
returns uuid language plpgsql security definer set search_path = public
as $$
declare conversation_uuid uuid;
begin
  if not exists (select 1 from public.profiles where id = auth.uid()
    and status = 'active' and role = 'customer') then
    raise exception 'Customer access required' using errcode = '42501';
  end if;
  insert into public.conversations(customer_id) values (auth.uid())
    on conflict (customer_id) do nothing;
  select id into conversation_uuid from public.conversations where customer_id = auth.uid();
  return conversation_uuid;
end;
$$;
revoke all on function public.open_customer_conversation() from public;
grant execute on function public.open_customer_conversation() to authenticated;
