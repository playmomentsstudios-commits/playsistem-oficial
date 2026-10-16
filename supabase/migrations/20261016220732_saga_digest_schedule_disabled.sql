-- Saga digest staging: SINGLE schedule authority = sagamente_assistant_settings.
-- Depends on existing v1 Saga migration (PR #490), already installed in Play Supabase.
-- This migration creates NO cron jobs, notifications, WhatsApp messages or workers.
-- The Saga's existing enabled=false and whatsapp_notifications=false flags are UNCHANGED.

-- Idempotent ledger for a future audited backend worker; no destination phone column.
create table if not exists public.saga_digest_runs (
 id uuid primary key default gen_random_uuid(),
 slot text not null check(slot in ('morning','midday','evening')),
 local_day date not null,
 recipient_user_id uuid not null references public.profiles(id),
 state text not null default 'draft'
   check(state in ('draft','validated','cancelled','queued','sent','failed')),
 content jsonb not null default '{}'::jsonb,
 event_ids uuid[] not null default '{}'::uuid[],
 created_at timestamptz not null default now(),
 constraint saga_digest_runs_unique unique(slot,local_day,recipient_user_id)
);
create index if not exists saga_digest_runs_created_idx
 on public.saga_digest_runs(created_at desc);
alter table public.saga_digest_runs enable row level security;
revoke all on public.saga_digest_runs from public,anon,authenticated;
grant select,insert,update on public.saga_digest_runs to service_role;

-- Read-only due-slot probe. The Saga settings are the SINGLE source of truth.
-- The existing agent must be enabled through a separate explicit approval before
-- this returns any due slot; reading it cannot enqueue or dispatch anything.
-- Only the agreed 07:00, 13:00 and 19:00 slots can appear.
create or replace function public.saga_digest_due_slots(p_at timestamptz default now())
returns table(slot text,local_day date,timezone text)
language sql stable security invoker set search_path='' as $$
 select case v.hhmm
   when '07:00' then 'morning'
   when '13:00' then 'midday'
   when '19:00' then 'evening'
 end as slot,
 (p_at at time zone s.timezone)::date as local_day,
 s.timezone
 from public.sagamente_assistant_settings s
 cross join lateral (
  select to_char(p_at at time zone s.timezone,'HH24:MI') as hhmm
 ) v
 where s.id = true
   and s.enabled = true
   and s.timezone = 'America/Sao_Paulo'
   and v.hhmm = any(s.digest_times)
   and v.hhmm in ('07:00','13:00','19:00');
$$;
revoke all on function public.saga_digest_due_slots(timestamptz)
 from public,anon,authenticated;
grant execute on function public.saga_digest_due_slots(timestamptz) to service_role;

-- Guardrails: this ledger is not connected to wa_bridge_claim; the old
-- assistant_tick is also not activated. A new backend must reconcile any
-- legacy daily_digest notification before enabling scheduled sends.
comment on table public.saga_digest_runs is
 'OFFLINE audit ledger for future Saga digest worker. Unique slot/day/user. Revalidate consent and project access at send time.';
