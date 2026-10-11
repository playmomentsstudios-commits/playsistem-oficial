-- Track what the local WhatsApp worker actually submitted, separate from delivery.
-- Zero on old attempts; no historical replays or customer sends.
alter table public.whatsapp_bridge_attempts
  add column if not exists media_planned_count integer not null default 0,
  add column if not exists media_submitted_count integer not null default 0,
  add column if not exists media_fallback_count integer not null default 0;
alter table public.whatsapp_bridge_attempts
  drop constraint if exists wa_bridge_media_attempt_count_valid;
alter table public.whatsapp_bridge_attempts
  add constraint wa_bridge_media_attempt_count_valid check (
    media_planned_count between 0 and 3
    and media_submitted_count between 0 and 3
    and media_fallback_count between 0 and 3
    and media_submitted_count+media_fallback_count<=media_planned_count
  );
