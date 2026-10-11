\set ON_ERROR_STOP on
-- Verify the actual ACL effect of PRs #356 and #361, not application behavior.
do $$
declare
  sig text;
begin
  sig := 'public.release_order_stock(uuid)';
  if has_function_privilege('anon',sig,'execute')
     or has_function_privilege('authenticated',sig,'execute')
     or not has_function_privilege('service_role',sig,'execute')
    then raise exception 'Stock release RPC permissions are not service-only';
  end if;

  foreach sig in array ARRAY[
    'public.submit_file_review(uuid,text,text)',
    'public.submit_file_review_v2(uuid,text,text,text,jsonb,jsonb)'
  ] loop
    if has_function_privilege('anon',sig,'execute')
      or not has_function_privilege('authenticated',sig,'execute')
      or not has_function_privilege('service_role',sig,'execute')
      then raise exception 'File review RPC permissions are wrong for %',sig;
    end if;
  end loop;

  if exists (
    select 1 from pg_proc p
    join pg_namespace n on n.oid=p.pronamespace
    join aclexplode(coalesce(p.proacl,acldefault('f',p.proowner))) as acl on true
      where n.nspname='public' and p.proname in
        ('release_order_stock','submit_file_review','submit_file_review_v2')
        and acl.grantee=0 and acl.privilege_type='EXECUTE'
  ) then raise exception 'Unexpected inherited PUBLIC execution privilege remains'; end if;
end $$;
select 'PASS: stock server-only; file reviews authenticated-only; service access retained' as result;
