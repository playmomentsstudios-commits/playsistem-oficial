\set ON_ERROR_STOP on
-- PostgreSQL role/JWT access assertions against the exact PR #359 SQL and
-- extracted repository wrapper definitions. No real customer records.
do $$
begin
  if has_function_privilege('anon','public.academy_refresh_enrollment(uuid)','execute')
    or not has_function_privilege('authenticated','public.academy_refresh_enrollment(uuid)','execute')
    or not has_function_privilege('service_role','public.academy_refresh_enrollment(uuid)','execute')
    then raise exception 'P0: wrong enrollment refresh ACL';
  end if;
end $$;

set role anon;
select set_config('request.jwt.claim.sub','',false);
do $$
declare denied boolean:=false;
begin
  begin
    perform public.academy_refresh_enrollment(
      '70000000-0000-4000-8000-000000000001');
  exception when insufficient_privilege then denied:=true;
  end;
  if not denied then raise exception 'Anonymous direct refresh was allowed'; end if;
  if (select count(*) from public.academy_refresh_my_enrollments()) <> 0 then
    raise exception 'Anonymous own-enrollments wrapper exposed an enrollment';
  end if;
end $$;
reset role;

set role service_role;
select set_config('request.jwt.claim.sub','',false);
do $$
declare denied boolean:=false;
begin
  begin
    perform public.academy_refresh_enrollment(
      '70000000-0000-4000-8000-000000000001');
  exception when insufficient_privilege then denied:=true;
  end;
  if not denied then raise exception 'Service call without user identity was allowed'; end if;
end $$;
reset role;

set role authenticated;
select set_config('request.jwt.claim.sub','10000000-0000-4000-8000-000000000002',false);
do $$
declare denied boolean:=false;
begin
  begin
    perform public.academy_refresh_enrollment(
      '70000000-0000-4000-8000-000000000001');
  exception when insufficient_privilege then denied:=true;
  end;
  if not denied then raise exception 'Other student could refresh another enrollment'; end if;
end $$;

select set_config('request.jwt.claim.sub','10000000-0000-4000-8000-000000000004',false);
do $$
declare denied boolean:=false;
begin
  begin
    perform public.academy_refresh_enrollment(
      '70000000-0000-4000-8000-000000000001');
  exception when insufficient_privilege then denied:=true;
  end;
  if not denied then raise exception 'Inactive admin could refresh another enrollment'; end if;
end $$;
reset role;

do $$
begin
  if (select status from public.course_enrollments
      where id='70000000-0000-4000-8000-000000000001') <> 'active'
    or (select progress_percent from public.course_enrollments
      where id='70000000-0000-4000-8000-000000000001') <> 5
    or (select count(*) from public.academy_events) <> 0
    or (select count(*) from public.notifications) <> 0
    then raise exception 'A rejected call changed enrollment state';
  end if;
end $$;

set role authenticated;
select set_config('request.jwt.claim.sub','10000000-0000-4000-8000-000000000001',false);
do $$
declare e public.course_enrollments; c public.academy_certificates;
begin
  e:=public.academy_refresh_enrollment(
    '70000000-0000-4000-8000-000000000001');
  if e.status <> 'completed' or e.progress_percent <> 100
    or e.attendance_percent <> 100 or e.final_grade <> 80 then
    raise exception 'Student completion/progress result incorrect';
  end if;
  if (select count(*) from public.academy_refresh_my_enrollments()) <> 1 then
    raise exception 'Student own-enrollments wrapper failed';
  end if;
  c:=public.academy_issue_my_certificate(
    '20000000-0000-4000-8000-000000000001');
  if c.user_id <> '10000000-0000-4000-8000-000000000001'::uuid then
    raise exception 'Certificate belongs to wrong user';
  end if;
  -- Issuing the same certificate again must not duplicate rows or notifications.
  c:=public.academy_issue_my_certificate(
    '20000000-0000-4000-8000-000000000001');
end $$;
reset role;

do $$
begin
  if (select count(*) from public.academy_certificates) <> 1
    or (select count(*) from public.academy_events) <> 1
    or (select count(*) from public.notifications) <> 1 then
    raise exception 'Certificate/notification flow duplicated records';
  end if;
end $$;

set role authenticated;
select set_config('request.jwt.claim.sub','10000000-0000-4000-8000-000000000003',false);
do $$
declare e public.course_enrollments;
begin
  e:=public.academy_refresh_enrollment(
    '70000000-0000-4000-8000-000000000002');
  if e.status <> 'active' then raise exception 'Admin refresh broke incomplete course'; end if;
end $$;
reset role;

do $$
begin
  if (select count(*) from public.academy_certificates) <> 1
    or (select count(*) from public.academy_events) <> 1
    or (select count(*) from public.notifications) <> 1
    then raise exception 'Unexpected secondary effects from admin refresh';
  end if;
end $$;

select 'PASS: scoped identities, completion, own enrollment, certificate, events and notifications' as result;
