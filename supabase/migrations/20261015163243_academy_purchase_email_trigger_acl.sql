-- This privileged trigger is invoked by auth.users, never as a public RPC.
revoke all on function public.academy_complete_after_email_verification()
 from public,anon,authenticated;
