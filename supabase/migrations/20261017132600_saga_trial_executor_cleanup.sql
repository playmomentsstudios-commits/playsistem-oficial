-- De-duplicate concurrent Saga efforts: only saga-owner-ops-minute remains.
-- The two trial RPCs were never scheduled, and are superseded by the
-- production saga_ops_retry_tick + saga_ops_summary_preview functions.
do $$
begin
 if exists(select 1 from cron.job where command like '%saga_personal_tick%') then
  raise exception 'Refusing to remove a scheduled function';
 end if;
 if exists(select 1 from public.automation_flows where event_key='saga_personal' and enabled) then
  raise exception 'Refusing cleanup of an active extra Saga flow';
 end if;
end $$;
drop function if exists public.saga_personal_tick(timestamptz);
drop function if exists public.saga_personal_brief_at(timestamptz);
