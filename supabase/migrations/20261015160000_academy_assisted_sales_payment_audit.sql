-- Academy assisted sales: gifts, verified cash and checkout-linked Pix.
-- Never infer receipts from a grant, screenshot, redirect or client payment claim.
create table if not exists public.academy_work_prices (
 work_id uuid not null references public.academy_library_works(id) on delete cascade,
 format text not null check (format in ('ebook','audiobook','combo')),
 price_cents integer check (price_cents between 100 and 100000000),
 enabled boolean not null default false,
 updated_by uuid references auth.users(id),
 updated_at timestamptz not null default now(),
 primary key(work_id,format),
 constraint enabled_price_required check (not enabled or price_cents is not null)
);
alter table public.academy_work_prices enable row level security;
drop policy if exists academy_work_prices_admin_all on public.academy_work_prices;
create policy academy_work_prices_admin_all on public.academy_work_prices
 for all to authenticated using (public.is_active_admin()) with check (public.is_active_admin());
revoke all on public.academy_work_prices from public,anon,authenticated;
grant select,insert,update on public.academy_work_prices to authenticated;

create table if not exists public.academy_payment_settings (
 id boolean primary key default true check (id=true),
 infinitepay_handle text check (infinitepay_handle is null or infinitepay_handle ~ '^[A-Za-z0-9_.-]{3,80}$'),
 infinitepay_enabled boolean not null default false,
 updated_at timestamptz not null default now(),
 updated_by uuid references auth.users(id),
 constraint infinitepay_requires_tag check (not infinitepay_enabled or infinitepay_handle is not null)
);
insert into public.academy_payment_settings(id) values(true) on conflict(id) do nothing;
alter table public.academy_payment_settings enable row level security;
drop policy if exists academy_payment_settings_admin on public.academy_payment_settings;
create policy academy_payment_settings_admin on public.academy_payment_settings
 for all to authenticated using (public.is_active_admin()) with check (public.is_active_admin());
revoke all on public.academy_payment_settings from public,anon,authenticated;
grant select,update on public.academy_payment_settings to authenticated;

create table if not exists public.academy_work_sales (
 id uuid primary key default gen_random_uuid(),
 request_key uuid not null unique,
 work_id uuid not null references public.academy_library_works(id) on delete restrict,
 customer_id uuid not null references public.profiles(id) on delete restrict,
 format text not null check (format in ('ebook','audiobook','combo')),
 payment_method text not null check (payment_method in ('gift','cash','infinitepay_pix')),
 amount_cents integer not null check (amount_cents between 0 and 100000000),
 status text not null check(status in ('pending','completed','cancelled','failed','refunded')),
 note text,
 provider text,
 payment_url text,
 provider_slug text,
 transaction_nsu text,
 receipt_url text,
 created_by uuid not null references auth.users(id),
 created_at timestamptz not null default now(),
 completed_at timestamptz,
 updated_at timestamptz not null default now(),
 constraint academy_work_sales_consistent check(
   (payment_method='gift' and amount_cents=0 and status='completed')
   or (payment_method='cash' and amount_cents>0 and status='completed')
   or (payment_method='infinitepay_pix' and amount_cents>0
      and status in ('pending','completed','cancelled','failed','refunded'))
 )
);
create index if not exists academy_work_sales_customer on public.academy_work_sales(customer_id,created_at desc);
create index if not exists academy_work_sales_work on public.academy_work_sales(work_id,created_at desc);
create index if not exists academy_work_sales_financial on public.academy_work_sales(status,payment_method,created_at desc);
create unique index if not exists academy_work_sales_infinitepay_nsu on public.academy_work_sales(transaction_nsu)
 where transaction_nsu is not null;

alter table public.academy_work_sales enable row level security;
drop policy if exists academy_work_sales_admin_read on public.academy_work_sales;
create policy academy_work_sales_admin_read on public.academy_work_sales
 for select to authenticated using (public.is_active_admin());
revoke all on public.academy_work_sales from public,anon,authenticated;
grant select on public.academy_work_sales to authenticated;

create table if not exists public.academy_work_sale_events (
 id uuid primary key default gen_random_uuid(),
 sale_id uuid not null references public.academy_work_sales(id) on delete restrict,
 event_type text not null,
 actor_id uuid references auth.users(id),
 data jsonb not null default '{}'::jsonb,
 created_at timestamptz not null default now()
);
create index if not exists academy_work_sale_events_history
 on public.academy_work_sale_events(sale_id,created_at);
alter table public.academy_work_sale_events enable row level security;
drop policy if exists academy_sale_events_admin_read on public.academy_work_sale_events;
create policy academy_sale_events_admin_read on public.academy_work_sale_events
 for select to authenticated using (public.is_active_admin());
revoke all on public.academy_work_sale_events from public,anon,authenticated;
grant select on public.academy_work_sale_events to authenticated;

create or replace function public.academy_admin_create_sale(
 p_work_id uuid,p_customer_id uuid,p_format text,
 p_payment_method text,p_amount_cents integer,p_note text,p_request_key uuid
) returns uuid
language plpgsql security definer set search_path='' as $$
declare
 v_sale_id uuid;
 v_count integer;
 v_price integer;
 v_status text;
 v_customer record;
begin
 if auth.uid() is null or not public.is_active_admin() then
  raise exception 'Operação restrita ao administrador' using errcode='42501';
 end if;
 if p_request_key is null or p_work_id is null or p_customer_id is null then
  raise exception 'Informe obra, cliente e identificador da operação' using errcode='22023';
 end if;
 -- A retry with the same request id can never create a duplicate receipt.
 select s.id into v_sale_id from public.academy_work_sales s
 where s.request_key=p_request_key;
 if found then return v_sale_id; end if;
 if p_format not in ('ebook','audiobook','combo') or
    p_payment_method not in ('gift','cash','infinitepay_pix') then
  raise exception 'Formato ou forma de recebimento inválida' using errcode='22023';
 end if;
 select id,role,status into v_customer from public.profiles where id=p_customer_id;
 if not found or v_customer.role<>'customer' or v_customer.status<>'active' then
  raise exception 'Selecione um cliente ativo' using errcode='22023';
 end if;
 select count(*) into v_count from public.academy_library_items i
 where i.work_id=p_work_id and i.status in ('published','private_beta')
 and (p_format='combo' or i.format=p_format);
 if (p_format='combo' and v_count<>2) or (p_format<>'combo' and v_count<>1) then
  raise exception 'A obra não tem este formato disponível' using errcode='22023';
 end if;
 select price_cents into v_price from public.academy_work_prices
 where work_id=p_work_id and format=p_format and enabled=true;
 if p_payment_method='gift' then
  if coalesce(p_amount_cents,-1)<>0 or char_length(btrim(coalesce(p_note,'')))<5 then
   raise exception 'Uma cortesia exige valor zero e justificativa de pelo menos 5 caracteres' using errcode='22023';
  end if;
 elsif p_amount_cents is null or p_amount_cents<100 or p_amount_cents>100000000 then
  raise exception 'Informe um valor de venda válido em centavos' using errcode='22023';
 elsif v_price is not null and v_price<>p_amount_cents and char_length(btrim(coalesce(p_note,'')))<5 then
  raise exception 'Informe o motivo do valor negociado, diferente do preço configurado' using errcode='22023';
 end if;
 if p_payment_method='infinitepay_pix' and
    not exists(select 1 from public.academy_payment_settings
      where id=true and infinitepay_enabled and infinitepay_handle is not null) then
  raise exception 'Configure a InfiniteTag antes de gerar cobranças Pix' using errcode='22023';
 end if;
 v_status:=case when p_payment_method='infinitepay_pix' then 'pending' else 'completed' end;
 insert into public.academy_work_sales
 (request_key,work_id,customer_id,format,payment_method,amount_cents,status,note,provider,created_by,completed_at)
 values(p_request_key,p_work_id,p_customer_id,p_format,p_payment_method,p_amount_cents,
 v_status,nullif(btrim(coalesce(p_note,'')),''),case when p_payment_method='infinitepay_pix' then 'infinitepay' else 'manual' end,
 auth.uid(),case when v_status='completed' then now() else null end)
 on conflict (request_key) do nothing returning id into v_sale_id;
 if v_sale_id is null then
  select id into v_sale_id from public.academy_work_sales where request_key=p_request_key;
  return v_sale_id;
 end if;
 insert into public.academy_work_sale_events(sale_id,event_type,actor_id,data)
 values(v_sale_id,case when v_status='completed' then 'completed_manual' else 'pix_pending' end,
 auth.uid(),jsonb_build_object('format',p_format,'method',p_payment_method,'amount_cents',p_amount_cents,'note',coalesce(p_note,'')));
 if v_status='completed' then
  insert into public.academy_library_grants(item_id,user_id,source,active,granted_at)
  select i.id,p_customer_id,case when p_payment_method='gift' then 'gift' else 'purchase' end,true,now()
  from public.academy_library_items i
  where i.work_id=p_work_id and i.status in ('published','private_beta')
   and (p_format='combo' or i.format=p_format)
  on conflict(item_id,user_id) do update set active=true,source=excluded.source,granted_at=now();
 end if;
 return v_sale_id;
end $$;
revoke all on function public.academy_admin_create_sale(uuid,uuid,text,text,integer,text,uuid)
 from public,anon,authenticated;
grant execute on function public.academy_admin_create_sale(uuid,uuid,text,text,integer,text,uuid)
 to authenticated;

-- Called ONLY by a trusted backend AFTER validating transaction with InfinitePay.
create or replace function public.academy_complete_verified_infinitepay_sale(
 p_sale_id uuid,p_invoice_slug text,p_transaction_nsu text,p_amount_cents integer,p_receipt_url text default null
) returns boolean language plpgsql security definer set search_path='' as $$
declare v_sale public.academy_work_sales%rowtype; v_expected integer;
begin
 if auth.role()<>'service_role' then
  raise exception 'Service role required' using errcode='42501';
 end if;
 select * into v_sale from public.academy_work_sales where id=p_sale_id for update;
 if not found or v_sale.payment_method<>'infinitepay_pix' then
  raise exception 'Pix sale not found' using errcode='22023';
 end if;
 if v_sale.status='completed' then
  return v_sale.transaction_nsu=p_transaction_nsu and v_sale.provider_slug=p_invoice_slug;
 end if;
 if v_sale.status<>'pending' or v_sale.amount_cents<>p_amount_cents
    or coalesce(p_invoice_slug,'')='' or coalesce(p_transaction_nsu,'')='' then
  raise exception 'Unverified Pix payment' using errcode='22023';
 end if;
 update public.academy_work_sales set status='completed',
  provider_slug=p_invoice_slug,transaction_nsu=p_transaction_nsu,
  receipt_url=nullif(p_receipt_url,''),completed_at=now(),updated_at=now()
 where id=p_sale_id;
 insert into public.academy_library_grants(item_id,user_id,source,active,granted_at)
 select i.id,v_sale.customer_id,'purchase',true,now()
 from public.academy_library_items i where i.work_id=v_sale.work_id
  and i.status in ('published','private_beta')
  and (v_sale.format='combo' or i.format=v_sale.format)
 on conflict(item_id,user_id) do update set active=true,source='purchase',granted_at=now();
 insert into public.academy_work_sale_events(sale_id,event_type,data)
 values(p_sale_id,'pix_provider_verified',jsonb_build_object(
 'transaction_nsu',p_transaction_nsu,'slug',p_invoice_slug,'amount_cents',p_amount_cents));
 return true;
end $$;
revoke all on function public.academy_complete_verified_infinitepay_sale(uuid,text,text,integer,text)
 from public,anon,authenticated;
grant execute on function public.academy_complete_verified_infinitepay_sale(uuid,text,text,integer,text)
 to service_role;
