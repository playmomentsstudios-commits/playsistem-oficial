-- SAGA NEGRA direct checkout: priced works, verified payments and automatic private entitlement.
-- Existing academy_work_interests are historical data only; nothing is deleted.
create table if not exists public.academy_work_prices(
 work_id uuid primary key references public.academy_library_works(id) on delete cascade,
 ebook_cents integer not null default 99 check(ebook_cents between 1 and 10000000),
 audiobook_cents integer not null default 280 check(audiobook_cents between 1 and 10000000),
 combo_cents integer not null default 299 check(combo_cents between 1 and 10000000),
 checkout_enabled boolean not null default false,
 updated_at timestamptz not null default now(),
 updated_by uuid
);
alter table public.academy_work_prices enable row level security;
drop policy if exists academy_work_prices_admin on public.academy_work_prices;
create policy academy_work_prices_admin on public.academy_work_prices
 for all to authenticated using(public.is_active_admin())
 with check(public.is_active_admin());
revoke all on public.academy_work_prices from public,anon,authenticated;
grant select,insert,update on public.academy_work_prices to authenticated;

-- Editable starting prices; live checkout remains disabled until the provider is
-- configured, checked and deliberately enabled by a site administrator.
insert into public.academy_work_prices(work_id,ebook_cents,audiobook_cents,combo_cents)
select w.id,99,280,299 from public.academy_library_works w
on conflict(work_id) do nothing;

create table if not exists public.academy_work_purchases(
 id uuid primary key default gen_random_uuid(),
 work_id uuid not null references public.academy_library_works(id) on delete restrict,
 user_id uuid not null references auth.users(id) on delete restrict,
 buyer_email text not null,
 requested_format text not null check(requested_format in ('ebook','audiobook','combo')),
 amount_cents integer not null check(amount_cents>0),
 currency text not null default 'BRL' check(currency='BRL'),
 provider text not null default 'infinitepay' check(provider='infinitepay'),
 provider_order_nsu text not null unique,
 provider_checkout_url text,
 provider_invoice_slug text,
 provider_transaction_nsu text unique,
 provider_capture_method text,
 status text not null default 'creating'
  check(status in ('creating','pending','paid_waiting_email','fulfilled','failed','expired','refunded')),
 paid_at timestamptz,
 fulfilled_at timestamptz,
 created_at timestamptz not null default now(),
 updated_at timestamptz not null default now(),
 constraint academy_work_purchases_provider_order_match check(provider_order_nsu=id::text)
);
create index if not exists academy_work_purchases_user_created on public.academy_work_purchases(user_id,created_at desc);
create index if not exists academy_work_purchases_work_status on public.academy_work_purchases(work_id,status);
alter table public.academy_work_purchases enable row level security;
drop policy if exists academy_work_purchases_owner_read on public.academy_work_purchases;
drop policy if exists academy_work_purchases_admin_read on public.academy_work_purchases;
create policy academy_work_purchases_owner_read on public.academy_work_purchases
 for select to authenticated using(user_id=auth.uid());
create policy academy_work_purchases_admin_read on public.academy_work_purchases
 for select to authenticated using(public.is_active_admin());
revoke all on public.academy_work_purchases from public,anon,authenticated;
grant select on public.academy_work_purchases to authenticated;

create or replace function public.academy_public_work_prices()
returns table(release_code text,ebook_cents integer,audiobook_cents integer,combo_cents integer,checkout_enabled boolean)
language sql stable security definer set search_path='' as $$
 select w.release_code,p.ebook_cents,p.audiobook_cents,p.combo_cents,p.checkout_enabled
 from public.academy_work_prices p
 join public.academy_library_works w on w.id=p.work_id
 join public.site_landing_pages l on l.id=w.landing_page_id
 where l.status='published' and (l.published_at is null or l.published_at<=now())
 order by w.release_code;
$$;
revoke all on function public.academy_public_work_prices() from public,anon,authenticated;
grant execute on function public.academy_public_work_prices() to anon,authenticated;

-- Only provider-confirming service-role backend may invoke grant fulfillment.
-- This function never trusts a browser or a webhook's unverified 'paid' flag.
create or replace function public.academy_fulfill_verified_purchase(p_purchase_id uuid)
returns text language plpgsql security definer set search_path='' as $$
declare v_order public.academy_work_purchases%rowtype;
 v_verified_at timestamptz;
 v_item record;
 v_count integer:=0;
begin
 select * into v_order from public.academy_work_purchases where id=p_purchase_id for update;
 if not found then return 'not_found'; end if;
 if v_order.status='fulfilled' then return 'already_fulfilled'; end if;
 if v_order.status not in ('paid_waiting_email') then return 'not_paid'; end if;
 select u.email_confirmed_at into v_verified_at from auth.users u
 where u.id=v_order.user_id and lower(u.email)=lower(v_order.buyer_email);
 if v_verified_at is null then return 'waiting_email'; end if;
 for v_item in
  select i.id from public.academy_library_items i
  where i.work_id=v_order.work_id
    and i.status in ('published','private_beta')
    and (v_order.requested_format='combo' or v_order.requested_format=i.format)
 loop
  insert into public.academy_library_grants(item_id,user_id,source,active)
  values(v_item.id,v_order.user_id,'purchase',true)
  on conflict(item_id,user_id) do update set active=true
   -- Never demote a manual/grant provenance when extending a real purchase.
   ,source=case when public.academy_library_grants.source='purchase' then 'purchase'
       else public.academy_library_grants.source end;
  v_count:=v_count+1;
 end loop;
 if v_count=0 then raise exception 'No format available to fulfill purchase %',p_purchase_id; end if;
 update public.academy_work_purchases
 set status='fulfilled',fulfilled_at=now(),updated_at=now()
 where id=p_purchase_id;
 return 'fulfilled';
end $$;
revoke all on function public.academy_fulfill_verified_purchase(uuid) from public,anon,authenticated;
grant execute on function public.academy_fulfill_verified_purchase(uuid) to service_role;

-- Email may be confirmed before OR after the Pix webhook arrives.
create or replace function public.academy_complete_after_email_verification()
returns trigger language plpgsql security definer set search_path='' as $$
declare v_order record;
begin
 if new.email_confirmed_at is null or (tg_op='UPDATE' and old.email_confirmed_at is not null) then return new; end if;
 for v_order in select p.id from public.academy_work_purchases p
  where p.user_id=new.id and p.status='paid_waiting_email'
 loop
  perform public.academy_fulfill_verified_purchase(v_order.id);
 end loop;
 return new;
end $$;
drop trigger if exists zz_academy_complete_after_email_verification on auth.users;
create trigger zz_academy_complete_after_email_verification
 after update of email_confirmed_at on auth.users
 for each row when (new.email_confirmed_at is not null)
 execute function public.academy_complete_after_email_verification();

-- Authenticated paid buyers can request a retry on fulfillment, never alter
-- payment status; the function still requires an email verified by Supabase.
create or replace function public.academy_finalize_my_paid_works()
returns integer language plpgsql security definer set search_path='' as $$
declare v_order record;v_count integer:=0;
begin
 if auth.uid() is null then raise exception 'Authentication required' using errcode='42501'; end if;
 for v_order in select p.id from public.academy_work_purchases p
  where p.user_id=auth.uid() and p.status='paid_waiting_email'
 loop
  if public.academy_fulfill_verified_purchase(v_order.id)='fulfilled' then v_count:=v_count+1; end if;
 end loop;
 return v_count;
end $$;
revoke all on function public.academy_finalize_my_paid_works() from public,anon,authenticated;
grant execute on function public.academy_finalize_my_paid_works() to authenticated;

-- Administrative editing of prices is subject to active-admin RLS.
-- No public SELECT grants of raw pricing / orders / protected media.
