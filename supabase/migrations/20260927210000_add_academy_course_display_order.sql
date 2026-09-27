alter table public.courses
  add column if not exists display_order integer not null default 0;

create index if not exists courses_display_order_idx
  on public.courses(display_order, created_at);
