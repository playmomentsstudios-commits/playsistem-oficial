-- Safe payment cleanup: explicit environment + reversible archive.
alter table public.payments
  add column if not exists environment text not null default 'unknown',
  add column if not exists archived_at timestamptz,
  add column if not exists archived_by uuid references auth.users(id);

do $$ begin
  alter table public.payments add constraint payments_environment_check
    check (environment in ('unknown','sandbox','production'));
exception when duplicate_object then null;
end $$;

create table if not exists public.payment_admin_audit (
  id uuid primary key default gen_random_uuid(),
  payment_id uuid not null,
  actor_id uuid not null references auth.users(id),
  action text not null check (action in ('archive','restore')),
  environment text not null,
  payment_status text,
  provider text,
  provider_reference text,
  created_at timestamptz not null default now()
);
alter table public.payment_admin_audit enable row level security;

create or replace function public.admin_set_payment_archived(p_payment_id uuid,p_archived boolean)
returns void language plpgsql security definer set search_path=public as $$
declare v_actor uuid:=auth.uid(); v_payment public.payments%rowtype;
begin
  if v_actor is null or not exists(select 1 from public.profiles where id=v_actor and role='admin' and status='active')
    then raise exception 'Admin access required'; end if;
  select * into v_payment from public.payments where id=p_payment_id for update;
  if not found then raise exception 'Payment not found'; end if;
  if v_payment.environment <> 'sandbox' then raise exception 'Only confirmed Sandbox payments can be archived from cleanup.'; end if;
  update public.payments set archived_at=case when p_archived then now() else null end,
    archived_by=case when p_archived then v_actor else null end,updated_at=now() where id=p_payment_id;
  insert into public.payment_admin_audit(payment_id,actor_id,action,environment,payment_status,provider,provider_reference)
  values(v_payment.id,v_actor,case when p_archived then 'archive' else 'restore' end,v_payment.environment,v_payment.status,v_payment.provider,v_payment.provider_reference);
end $$;
revoke all on function public.admin_set_payment_archived(uuid,boolean) from public;
grant execute on function public.admin_set_payment_archived(uuid,boolean) to authenticated;

drop policy if exists "Admins read payment admin audit" on public.payment_admin_audit;
create policy "Admins read payment admin audit" on public.payment_admin_audit for select to authenticated
using(exists(select 1 from public.profiles p where p.id=auth.uid() and p.role='admin' and p.status='active'));

create index if not exists payments_environment_archived_idx on public.payments(environment,archived_at);
create index if not exists payment_admin_audit_payment_idx on public.payment_admin_audit(payment_id,created_at desc);
