-- Native Web Push for installed Sagamente PWA, no private files in browser caches.
-- Public browser users never read subscription keys or the VAPID private key.
create extension if not exists pg_net;
create extension if not exists pg_cron;

create schema if not exists push_private;
revoke all on schema push_private from public, anon, authenticated;
create table if not exists push_private.config (
  singleton boolean primary key default true check (singleton),
  vapid_public text,
  vapid_private text,
  dispatch_key text not null default encode(gen_random_bytes(32),'hex'),
  endpoint_url text not null default 'https://lfmjqctiutajgtacvxfq.supabase.co/functions/v1/push-dispatch',
  updated_at timestamptz not null default now()
);
insert into push_private.config(singleton) values(true) on conflict do nothing;
revoke all on push_private.config from public, anon, authenticated;
grant usage on schema push_private to service_role;
grant select,update on push_private.config to service_role;

create table if not exists public.push_subscriptions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  endpoint text not null unique,
  p256dh text not null,
  auth_secret text not null,
  device_label text not null default 'Dispositivo',
  categories jsonb not null default '{"messages":true,"projects":true,"files":true,"commercial":true,"deadlines":true}'::jsonb,
  enabled boolean not null default true,
  failures int not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  last_sent_at timestamptz,
  constraint push_subscriptions_endpoint_length check(length(endpoint) between 20 and 2048),
  constraint push_subscriptions_keys_length check(length(p256dh) between 40 and 256 and length(auth_secret) between 15 and 256),
  constraint push_subscriptions_label_length check(length(device_label) between 1 and 100)
);
create index if not exists push_subscriptions_user on public.push_subscriptions(user_id);
alter table public.push_subscriptions enable row level security;
revoke all on public.push_subscriptions from anon,authenticated;
grant all on public.push_subscriptions to service_role;

alter table public.user_preferences add column if not exists notify_push boolean not null default true;

create table if not exists public.push_delivery_queue (
  id uuid primary key default gen_random_uuid(),
  notification_id uuid not null unique references public.notifications(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  status text not null default 'pending' check (status in ('pending','processing','retry','sent','failed')),
  attempts integer not null default 0,
  available_at timestamptz not null default now(),
  locked_at timestamptz,
  finished_at timestamptz,
  created_at timestamptz not null default now()
);
create index if not exists push_delivery_queue_pending on public.push_delivery_queue(status,available_at)
  where status in ('pending','retry','processing');
alter table public.push_delivery_queue enable row level security;
revoke all on public.push_delivery_queue from anon,authenticated;
grant all on public.push_delivery_queue to service_role;

create or replace function public.push_internal_config()
returns jsonb language plpgsql security definer set search_path=public,push_private
as $$
begin
  if auth.role() is distinct from 'service_role' then raise exception 'Access denied' using errcode='42501'; end if;
  return (select to_jsonb(c) from push_private.config c where singleton);
end $$;
revoke all on function public.push_internal_config() from public,anon,authenticated;
grant execute on function public.push_internal_config() to service_role;

create or replace function public.push_install_keys(p_public text,p_private text)
returns text language plpgsql security definer set search_path=public,push_private
as $$
declare key text;
begin
  if auth.role() is distinct from 'service_role' then raise exception 'Access denied' using errcode='42501'; end if;
  if p_public !~ '^[a-zA-Z0-9_-]{80,100}$' or p_private !~ '^[a-zA-Z0-9_-]{40,60}$'
    then raise exception 'Invalid VAPID keys' using errcode='22023'; end if;
  update push_private.config set vapid_public=p_public,vapid_private=p_private,updated_at=now()
    where singleton and vapid_public is null and vapid_private is null;
  select vapid_public into key from push_private.config where singleton;
  return key;
end $$;
revoke all on function public.push_install_keys(text,text) from public,anon,authenticated;
grant execute on function public.push_install_keys(text,text) to service_role;

-- A short-lived claim prevents concurrent webhook and scheduled dispatch duplication.
create or replace function public.push_claim_notifications(p_limit integer default 12)
returns table(queue_id uuid,notification_id uuid,user_id uuid,type text,title text,message text,link text,metadata jsonb)
language sql security definer set search_path=public
as $$
  with selected as (
    select q.id from public.push_delivery_queue q
    where (q.status in ('pending','retry') and q.available_at<=now() and q.attempts<5)
       or (q.status='processing' and q.locked_at<now()-interval '3 minutes' and q.attempts<5)
    order by q.created_at asc
    for update skip locked limit least(greatest(p_limit,1),20)
  ), claimed as (
    update public.push_delivery_queue q
       set status='processing',attempts=q.attempts+1,locked_at=now()
    where q.id in (select id from selected)
    returning q.id,q.notification_id,q.user_id
  )
  select c.id,c.notification_id,c.user_id,n.type,n.title,n.message,n.link,n.metadata
    from claimed c join public.notifications n on n.id=c.notification_id;
$$;
revoke all on function public.push_claim_notifications(integer) from public,anon,authenticated;
grant execute on function public.push_claim_notifications(integer) to service_role;

-- The SQL function is executed by postgres/cron, never by logged-in browser users.
create or replace function public.push_enqueue_dispatch()
returns void language plpgsql security definer set search_path=public,push_private
as $$
declare config push_private.config%rowtype;
begin
  select * into config from push_private.config where singleton;
  if config.vapid_public is null or config.vapid_private is null then return; end if;
  if not exists (select 1 from public.push_delivery_queue
    where (status in ('pending','retry') and available_at<=now() and attempts<5)
       or (status='processing' and locked_at<now()-interval '3 minutes' and attempts<5)) then return; end if;
  perform net.http_post(
    url := config.endpoint_url,
    headers := jsonb_build_object('Content-Type','application/json','x-sagamente-dispatch',config.dispatch_key),
    body := '{}'::jsonb,timeout_milliseconds := 20000);
end $$;
revoke all on function public.push_enqueue_dispatch() from public,anon,authenticated,service_role;

create or replace function public.push_queue_notification()
returns trigger language plpgsql security definer set search_path=public
as $$
begin
  if exists(select 1 from public.push_subscriptions s
    left join public.user_preferences p on p.user_id=s.user_id
    where s.user_id=new.user_id and s.enabled and coalesce(p.notify_push,true))
  then
    insert into public.push_delivery_queue(notification_id,user_id)
      values(new.id,new.user_id) on conflict(notification_id) do nothing;
    perform public.push_enqueue_dispatch();
  end if;
  return new;
end $$;
drop trigger if exists notifications_push_queue on public.notifications;
create trigger notifications_push_queue after insert on public.notifications
  for each row execute function public.push_queue_notification();

-- Recheck missed deliveries if the HTTP webhook was interrupted.
select cron.schedule('sagamente-push-v1', '* * * * *', $$select public.push_enqueue_dispatch();$$);
