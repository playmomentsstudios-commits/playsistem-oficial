-- Keep device submission separate from delivery acknowledgement.
alter table public.whatsapp_bridge_attempts add column if not exists destination_jid text;
alter table public.whatsapp_bridge_attempts add column if not exists ack_status text not null default 'unconfirmed';
alter table public.whatsapp_bridge_attempts add column if not exists ack_at timestamptz;
