-- Register the new personal-owner brief scheduler INACTIVE.
-- It can only be enabled after end-to-end delivery checks and confirming that
-- the shared WhatsApp bridge has not been intentionally paused.
do $$
declare jid bigint;
begin
 select jobid into jid from cron.job where jobname='saga-owner-brief-minute';
 if jid is null then
   jid:=cron.schedule('saga-owner-brief-minute','* * * * *',
      'select public.saga_owner_brief_tick(false);');
 end if;
 perform cron.alter_job(job_id=>jid,active=>false);
 if not exists(select 1 from cron.job where jobid=jid and active=false
   and command='select public.saga_owner_brief_tick(false);') then
   raise exception 'The Saga owner cron must remain disabled';
 end if;
end $$;
