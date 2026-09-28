-- Structured commercial information for service self-service and briefing.
alter table public.services
  add column if not exists estimated_deadline text,
  add column if not exists deliverables text[] not null default '{}',
  add column if not exists revision_count integer check (revision_count is null or revision_count >= 0),
  add column if not exists delivery_format text,
  add column if not exists customer_requirements text[] not null default '{}',
  add column if not exists included_items text[] not null default '{}',
  add column if not exists excluded_items text[] not null default '{}';

comment on column public.services.estimated_deadline is 'Commercial estimate shown to customers; not a contractual due date.';
comment on column public.services.deliverables is 'Structured list of expected deliverables.';
comment on column public.services.revision_count is 'Number of revision rounds included when applicable.';
comment on column public.services.customer_requirements is 'Information or materials the customer must provide.';
