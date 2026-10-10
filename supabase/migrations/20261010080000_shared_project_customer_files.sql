-- Project membership grants read access to customer-shareable project files.
-- Internal/private assets remain hidden through client_visible and project_type.
drop policy if exists client_files_read on public.client_files;
create policy client_files_read on public.client_files for select to authenticated
using (
  (select public.current_user_is_admin())
  or (select public.current_user_has_permission('files.view'))
  or (select public.current_user_has_permission('files.manage'))
  or (
    client_visible
    and (select public.current_user_is_active_customer())
    and (
      (project_id is null and customer_id=(select auth.uid()))
      or (
        project_id is not null
        and exists (
          select 1 from public.projects p
          where p.id=client_files.project_id
            and p.project_type<>'internal'
            and (
              p.customer_id=(select auth.uid())
              or exists (
                select 1 from public.project_customer_access a
                where a.project_id=p.id and a.customer_id=(select auth.uid())
              )
            )
        )
      )
    )
  )
);
-- Review decisions remain restricted to the primary contractual customer.
