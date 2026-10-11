-- SAGAMENTE: READ-ONLY P0 #359 production preflight (catalog metadata only).
-- Run manually in Supabase SQL Editor with the correct project selected.
-- The result cannot attest to existence/restorability of a backup.
-- Expected normalized fingerprints were read from production on 2026-10-11.
with expected(function_name, function_args, body_md5, expected_anon) as (
  values
    ('academy_refresh_enrollment','p_enrollment_id uuid',
      '2cde6ea773130830e6ee8d93ca81f181',true),
    ('academy_refresh_my_enrollments','',
      '1f616a95576e00b167fc01b815f8b659',true),
    ('academy_issue_my_certificate','p_course_id uuid',
      '116309ee0123f96ccbd9b6a8d9f386c4',true)
), inspected as (
  select e.function_name,
    p.oid is not null as exists_on_server,
    coalesce(pg_get_function_identity_arguments(p.oid)=e.function_args,false) as signature_matches,
    coalesce(md5(regexp_replace(p.prosrc,'[[:space:]]+','','g'))=e.body_md5,false) as body_matches_reviewed_baseline,
    coalesce(p.prosecdef,false) as security_definer,
    coalesce('search_path=public'=any(p.proconfig),false) as search_path_locked,
    coalesce(has_function_privilege('anon',p.oid,'EXECUTE')=e.expected_anon,false) as anonymous_grant_as_expected,
    coalesce(has_function_privilege('authenticated',p.oid,'EXECUTE'),false) as authenticated_can_execute,
    coalesce(has_function_privilege('service_role',p.oid,'EXECUTE'),false) as service_can_execute
  from expected e
  left join pg_proc p on p.proname=e.function_name
    and p.pronamespace='public'::regnamespace
)
select function_name, exists_on_server, signature_matches,
  body_matches_reviewed_baseline, security_definer, search_path_locked,
  anonymous_grant_as_expected, authenticated_can_execute,
  service_can_execute,
  case when exists_on_server and signature_matches and
    body_matches_reviewed_baseline and security_definer and search_path_locked
    and anonymous_grant_as_expected and authenticated_can_execute and service_can_execute
    then 'CATALOG_PRECHECK_OK' else 'STOP_AND_REVIEW' end as verdict
from inspected order by function_name;

-- Independently check if the exact PR #359 version is already recorded.
-- Read-only inventory on 2026-10-11 found 45 remote versions; local/remote histories remain unreconciled by content.
select exists (
  select 1 from supabase_migrations.schema_migrations
  where version='20261011060000'
) as migration_version_already_recorded;
