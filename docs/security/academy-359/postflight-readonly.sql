-- SAGAMENTE: READ-ONLY post-deployment verification for PR #359.
-- Execute ONLY AFTER authorized Supabase migration. No test user accounts.
-- No calls to the mutable RPC itself; only catalog metadata are inspected.
with expected(function_name,function_args,expected_body_md5) as (
  values
    ('academy_refresh_enrollment','p_enrollment_id uuid','d8f10ef24cba1890fcbec63c15a95809'),
    ('academy_refresh_my_enrollments','','1f616a95576e00b167fc01b815f8b659'),
    ('academy_issue_my_certificate','p_course_id uuid','116309ee0123f96ccbd9b6a8d9f386c4')
), functions as (
  select e.function_name,e.function_args,e.expected_body_md5,p.oid,p.prosrc,p.prosecdef,p.proconfig,
    md5(regexp_replace(p.prosrc,'[[:space:]]+','','g')) as body_fingerprint,
    coalesce(has_function_privilege('anon',p.oid,'EXECUTE'),false) as anon_exec,
    coalesce(has_function_privilege('authenticated',p.oid,'EXECUTE'),false) as auth_exec,
    coalesce(has_function_privilege('service_role',p.oid,'EXECUTE'),false) as service_exec
  from expected e
  left join pg_proc p
    on p.proname=e.function_name
   and p.pronamespace='public'::regnamespace
   and pg_get_function_identity_arguments(p.oid)=e.function_args
)
select function_name,oid is not null as exists_on_server,anon_exec,auth_exec,service_exec,
  coalesce(prosecdef,false) as security_definer,
  coalesce('search_path=public'=any(proconfig),false) as expected_search_path,
  coalesce(body_fingerprint=expected_body_md5,false) as matches_reviewed_source,
  case
    when oid is null then 'STOP_AND_REVIEW'
    when function_name='academy_refresh_enrollment'
      and not anon_exec and auth_exec and service_exec and prosecdef
      and ('search_path=public'=any(proconfig))
      and body_fingerprint=expected_body_md5
      and position('if auth.uid() is null then' in prosrc)>0
      then 'TARGET_ACL_AND_BODY_OK'
    when function_name in ('academy_refresh_my_enrollments','academy_issue_my_certificate')
      and body_fingerprint=expected_body_md5
      then 'WRAPPER_UNCHANGED'
    else 'STOP_AND_REVIEW'
  end as verdict
from functions order by function_name;

select exists(
  select 1 from supabase_migrations.schema_migrations
  where version='20261011060000'
) as target_version_recorded;

-- If the postcheck fails, stop any additional migration deployment.
-- A successful metadata check DOES NOT validate the end-user app workflows.
