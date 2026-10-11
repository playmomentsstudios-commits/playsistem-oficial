-- SAGAMENTE: read-only production security inventory.
-- Run ONLY as SELECT in the intended Supabase project.
-- Never print function source code, secrets, users, or customer rows.
select p.proname as function_name,
       pg_get_function_identity_arguments(p.oid) as signature,
       p.prosecdef as security_definer,
       coalesce(array_to_string(p.proconfig, ','), '') as function_settings,
       has_function_privilege('anon',p.oid,'EXECUTE') as anon_execute,
       has_function_privilege('authenticated',p.oid,'EXECUTE') as authenticated_execute,
       has_function_privilege('service_role',p.oid,'EXECUTE') as service_execute,
       md5(pg_get_functiondef(p.oid)) as source_fingerprint
from pg_proc p
join pg_namespace n on n.oid=p.pronamespace
where n.nspname='public'
  and p.proname in (
    'admin_set_member_role',
    'academy_refresh_enrollment',
    'academy_refresh_program_enrollment',
    'release_order_stock',
    'academy_accept_document',
    'submit_file_review',
    'submit_file_review_v2'
  )
order by p.proname,pg_get_function_identity_arguments(p.oid);
