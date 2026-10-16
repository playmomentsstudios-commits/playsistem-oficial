-- Saga: require an ACTIVE admin for reads and preference writes.
-- Defense in depth: the React admin route checks status, but RLS must agree.
-- No changes to enabled/WhatsApp flags, jobs, grants, capture, or queue.
alter policy "sagamente_assistant_settings_admin_select"
on public.sagamente_assistant_settings
using (exists (
  select 1 from public.profiles p
  where p.id = (select auth.uid())
    and p.role = 'admin' and p.status = 'active'
));

alter policy "sagamente_assistant_settings_admin_update"
on public.sagamente_assistant_settings
using (exists (
  select 1 from public.profiles p
  where p.id = (select auth.uid())
    and p.role = 'admin' and p.status = 'active'
))
with check (exists (
  select 1 from public.profiles p
  where p.id = (select auth.uid())
    and p.role = 'admin' and p.status = 'active'
));

alter policy "sagamente_assistant_events_admin_select"
on public.sagamente_assistant_events
using (exists (
  select 1 from public.profiles p
  where p.id = (select auth.uid())
    and p.role = 'admin' and p.status = 'active'
));
