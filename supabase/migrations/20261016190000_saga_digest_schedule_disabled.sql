-- Saga digests V1: staged schedules only. Does NOT create cron jobs, enqueue WhatsApp,
-- change bridge settings or enable a single new send.
create table if not exists public.saga_digest_schedules (
 id uuid primary key default gen_random_uuid(),
 slot text not null unique check(slot in ('morning','midday','evening')),
 local_hour smallint not null check(local_hour in (7,13,19)),
 local_minute smallint not null default 0 check(local_minute between 0 and 59),
 timezone text not null default 'America/Sao_Paulo' check(timezone='America/Sao_Paulo'),
 enabled boolean not null default false,
 dispatch_enabled boolean not null default false,
 audience_policy text not null default 'event_authorized'
   check(audience_policy='event_authorized'),
 created_at timestamptz not null default now(),
 updated_at timestamptz not null default now(),
 constraint no_dispatch_without_schedule check(not dispatch_enabled or enabled)
);
alter table public.saga_digest_schedules enable row level security;
revoke all on public.saga_digest_schedules from public, anon, authenticated;
grant select, insert, update on public.saga_digest_schedules to service_role;

insert into public.saga_digest_schedules(slot,local_hour)
values ('morning',7),('midday',13),('evening',19)
on conflict(slot) do update set
 local_hour=excluded.local_hour, local_minute=0, timezone='America/Sao_Paulo',
 enabled=false,dispatch_enabled=false,audience_policy='event_authorized',
 updated_at=now();

-- Idempotent ledger for a future audited worker. No recipient defaults or fallback
-- numbers. Every delivery requires consent checks again at dispatch time.
create table if not exists public.saga_digest_runs (
 id uuid primary key default gen_random_uuid(),
 schedule_id uuid not null references public.saga_digest_schedules(id),
 local_day date not null,
 recipient_user_id uuid not null references public.profiles(id),
 state text not null default 'draft'
   check(state in ('draft','validated','cancelled','queued','sent','failed')),
 content jsonb not null default '{}'::jsonb,
 event_ids uuid[] not null default '{}'::uuid[],
 created_at timestamptz not null default now(),
 constraint saga_digest_runs_unique unique(schedule_id,local_day,recipient_user_id)
);
create index if not exists saga_digest_runs_created_idx
 on public.saga_digest_runs(created_at desc);
alter table public.saga_digest_runs enable row level security;
revoke all on public.saga_digest_runs from public,anon,authenticated;
grant select,insert,update on public.saga_digest_runs to service_role;

-- Planning is deliberately read-only and cannot create a message/outbox item.
-- Explicit recipients are resolved ONLY from existing flows/events: never broadcast
-- to all profiles or infer eligibility from membership alone.
create or replace function public.saga_digest_due_slots(p_at timestamptz default now())
returns table(slot text,local_day date,timezone text)
language sql stable security invoker set search_path='' as $$
 select s.slot, (p_at at time zone s.timezone)::date, s.timezone
 from public.saga_digest_schedules s
 where s.enabled
   and extract(hour from p_at at time zone s.timezone)::int=s.local_hour
   and extract(minute from p_at at time zone s.timezone)::int=s.local_minute;
$$;
revoke all on function public.saga_digest_due_slots(timestamptz)
 from public,anon,authenticated;
grant execute on function public.saga_digest_due_slots(timestamptz) to service_role;

-- Guard rail: the operational bridge's consent, project access, destination and
-- limits remain authoritative. Do not connect this table to wa_bridge_claim
-- until end-to-end staging tests and explicit activation approval.
comment on table public.saga_digest_schedules is
 'OFF by default. 07:00/13:00/19:00 America/Sao_Paulo. No cron job provisioned.';
comment on table public.saga_digest_runs is
 'Idempotent digest drafts. Must verify per-event recipient authorization/opt-in at both build and send.';
