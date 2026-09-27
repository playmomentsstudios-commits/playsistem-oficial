-- Asaas gateway metadata and webhook idempotency.
-- Apply after 20260926280000_customer_avatar_storage.sql.

alter table public.payments add column if not exists provider_customer_id text;
alter table public.payments add column if not exists provider_payload jsonb not null default '{}'::jsonb;

create unique index if not exists payments_provider_reference_unique
  on public.payments(provider,provider_reference)
  where provider_reference is not null;

create table if not exists public.payment_webhook_events (
  id text primary key,
  provider text not null,
  event_type text not null,
  provider_reference text,
  payload jsonb not null,
  processed_at timestamptz not null default now()
);

alter table public.payment_webhook_events enable row level security;
-- Service-role Edge Functions bypass RLS; no client policy is intentionally created.
