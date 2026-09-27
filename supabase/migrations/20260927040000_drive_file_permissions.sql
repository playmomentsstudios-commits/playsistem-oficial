-- Stage 5: granular Drive/file permissions.
-- Replaces the legacy "any staff" access on client_files with explicit file permissions.

drop policy if exists client_files_read on public.client_files;
drop policy if exists client_files_staff_write on public.client_files;

create policy client_files_read
on public.client_files
for select to authenticated
using (
  (
    customer_id = auth.uid()
    and client_visible
    and public.current_user_is_active_customer()
  )
  or public.current_user_is_admin()
  or public.current_user_has_permission('files.view')
  or public.current_user_has_permission('files.manage')
);

create policy client_files_manage
on public.client_files
for all to authenticated
using (
  public.current_user_is_admin()
  or public.current_user_has_permission('files.manage')
)
with check (
  public.current_user_is_admin()
  or public.current_user_has_permission('files.manage')
);

-- Keep review history aligned with the same permission model.
drop policy if exists file_reviews_read on public.file_reviews;
create policy file_reviews_read
on public.file_reviews
for select to authenticated
using (
  (
    customer_id = auth.uid()
    and public.current_user_is_active_customer()
  )
  or public.current_user_is_admin()
  or public.current_user_has_permission('files.view')
  or public.current_user_has_permission('files.manage')
);
