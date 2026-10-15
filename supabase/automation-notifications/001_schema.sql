-- Play Sistem | Automações e Notificações (V1)
-- Isolado do fluxo existente de notificações/WhatsApp.
-- Aplicar somente após revisão e testes em ambiente de homologação.
create table if not exists public.automation_flows (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  source text not null default 'play_sistem',
  event_key text not null unique,
  enabled boolean not null default false,
  recipient_user_id uuid not null references public.profiles(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create table if not exists public.automation_events (
  id uuid primary key default gen_random_uuid(),
  flow_id uuid not null references public.automation_flows(id),
  idempotency_key text not null unique,
  event_type text not null,
  title text not null,
  message_body text not null,
  status text not null default 'draft'
    check (status in ('draft','approved','queued','sent','failed','cancelled')),
  source_payload jsonb not null default '{}'::jsonb,
  notification_id uuid references public.notifications(id),
  created_at timestamptz not null default now(),
  approved_at timestamptz,
  sent_at timestamptz
);
create index if not exists automation_events_flow_created_idx
  on public.automation_events(flow_id,created_at desc);
create table if not exists public.automation_delivery_attempts (
  id uuid primary key default gen_random_uuid(),
  event_id uuid not null references public.automation_events(id),
  channel text not null check(channel in ('whatsapp','portal')),
  status text not null,
  provider_message_id text,
  error_code text,
  attempted_at timestamptz not null default now()
);
create index if not exists automation_delivery_attempts_event_idx
  on public.automation_delivery_attempts(event_id,attempted_at desc);
alter table public.automation_flows enable row level security;
alter table public.automation_events enable row level security;
alter table public.automation_delivery_attempts enable row level security;
-- Sem policies para anon/authenticated: acesso restrito a backend autorizado.
-- Não cria triggers na tabela notifications nem modifica o WhatsApp atual.
