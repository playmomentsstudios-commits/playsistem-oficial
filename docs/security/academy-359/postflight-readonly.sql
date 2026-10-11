-- SAGAMENTE: READ-ONLY post-deployment verification for PR #359.
-- Execute ONLY AFTER authorized Supabase migration. No test user accounts.
-- No calls to the mutable RPC itself; only catalog metadata are inspected.
with functions as (
  select p.proname,p.prosrc,p.prosecdef,p.proconfig,p.oid,
    md5(regexp_replace(p.prosrc,'[[:space:]]+','','g')) as body_fingerprint,
    has_function_privilege('anon',p.oid,'EXECUTE') as anon_exec,
    has_function_privilege('authenticated',p.oid,'EXECUTE') as auth_exec,
    has_function_privilege('service_role',p.oid,'EXECUTE') as service_exec
  from pg_proc p join pg_namespace n on n.oid=p.pronamespace
  where n.nspname='public'
    and p.proname in (
      'academy_refresh_enrollment',
      'academy_refresh_my_enrollments',
      'academy_issue_my_certificate'
    )
)
select proname,anon_exec,auth_exec,service_exec,prosecdef as security_definer,
  ('search_path=public'=any(proconfig)) as expected_search_path,
  case when proname='academy_refresh_enrollment' then
    position('if auth.uid() is null then' in prosrc)>0
    and position('caller_role' in prosrc)=0
    else true end as intended_guard_present,
  case
    when proname='academy_refresh_enrollment'
      and not anon_exec and auth_exec and service_exec and prosecdef
      and ('search_path=public'=any(proconfig))
      and position('if auth.uid() is null then' in prosrc)>0
      and body_fingerprint <> '2cde6ea773130830e6ee8d93ca81f181'
      then 'TARGET_ACL_AND_GUARD_OK'
    when proname='academy_refresh_my_enrollments'
      and body_fingerprint='1f616a95576e00b167fc01b815f8b659'
      then 'WRAPPER_UNCHANGED'
    when proname='academy_issue_my_certificate'
      and body_fingerprint='116309ee0123f96ccbd9b6a8d9f386c4'
      then 'WRAPPER_UNCHANGED'
    else 'STOP_AND_REVIEW'
  end as verdict
from functions order by proname;

select exists(
  select 1 from supabase_migrations.schema_migrations
  where version='20261011060000'
) as target_version_recorded;

-- If the postcheck fails, stop any additional migration deployment.
-- A successful metadata check DOES NOT validate the end-user app workflows.
