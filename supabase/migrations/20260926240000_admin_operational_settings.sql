-- Administrative operational settings - stage 2.

alter table public.app_settings
  add column if not exists crm_default_follow_up_days integer not null default 2
    check(crm_default_follow_up_days between 1 and 30),
  add column if not exists orders_default_filter text not null default 'all'
    check(orders_default_filter in ('all','awaiting_payment','paid','in_production','completed','cancelled')),
  add column if not exists internal_operation_notifications boolean not null default true,
  add column if not exists commercial_notifications boolean not null default true;
