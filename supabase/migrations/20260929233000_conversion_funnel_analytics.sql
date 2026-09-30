-- First-party conversion funnel telemetry for public/checkout journeys.
begin;
create table if not exists public.conversion_events(
 id uuid primary key default gen_random_uuid(),
 event_name text not null check(event_name in('service_interest','product_interest','academy_interest','account_interest','checkout_started','payment_created','payment_failed')),
 anonymous_id text,
 user_id uuid references public.profiles(id) on delete set null,
 path text,
 campaign_code text,
 detail jsonb not null default '{}'::jsonb,
 created_at timestamptz not null default now()
);
create index if not exists conversion_events_name_created_idx on public.conversion_events(event_name,created_at desc);
create index if not exists conversion_events_campaign_created_idx on public.conversion_events(campaign_code,created_at desc);
alter table public.conversion_events enable row level security;
drop policy if exists conversion_events_staff_read on public.conversion_events;
create policy conversion_events_staff_read on public.conversion_events for select to authenticated using(public.current_user_is_staff_or_admin());
grant select on public.conversion_events to authenticated;

create or replace function public.record_conversion_event(p_event_name text,p_anonymous_id text,p_path text,p_campaign_code text default null,p_detail jsonb default '{}'::jsonb)
returns uuid language plpgsql security definer set search_path=public as $$
declare v_id uuid;
begin
 if p_event_name not in('service_interest','product_interest','academy_interest','account_interest','checkout_started','payment_created','payment_failed') then raise exception 'Invalid conversion event'; end if;
 if length(coalesce(p_path,''))>500 or length(coalesce(p_campaign_code,''))>120 then raise exception 'Invalid conversion metadata'; end if;
 insert into public.conversion_events(event_name,anonymous_id,user_id,path,campaign_code,detail)
 values(p_event_name,left(nullif(p_anonymous_id,''),120),auth.uid(),nullif(p_path,''),nullif(p_campaign_code,''),coalesce(p_detail,'{}'::jsonb)-'email'-'phone'-'document_number'-'cpf'-'cnpj')
 returning id into v_id;
 return v_id;
end $$;
revoke all on function public.record_conversion_event(text,text,text,text,jsonb) from public;
grant execute on function public.record_conversion_event(text,text,text,text,jsonb) to anon,authenticated;
commit;
