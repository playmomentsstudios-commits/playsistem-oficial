-- Owner-requested small increase across the Academy digital catalog.
-- Purchases keep their original contracted amount; activation flags are preserved.
alter table public.academy_work_prices
 alter column ebook_cents set default 149,
 alter column audiobook_cents set default 349,
 alter column combo_cents set default 399;

update public.academy_work_prices
set ebook_cents=149,audiobook_cents=349,combo_cents=399,updated_at=now();
