-- Prevent anonymous callers from reaching customer file review SECURITY DEFINER RPCs.
-- Keep authenticated customer access and trusted server-side access intact.
revoke all on function public.submit_file_review(uuid, text, text) from public, anon;
grant execute on function public.submit_file_review(uuid, text, text) to authenticated, service_role;

revoke all on function public.submit_file_review_v2(uuid, text, text, text, jsonb, jsonb) from public, anon;
grant execute on function public.submit_file_review_v2(uuid, text, text, text, jsonb, jsonb) to authenticated, service_role;
