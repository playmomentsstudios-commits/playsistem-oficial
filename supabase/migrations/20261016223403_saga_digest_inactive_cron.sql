-- Saga future scheduler registration — INACTIVE on purpose.
-- Does not run digest preparation until a separate, explicitly reviewed enablement.
-- Preserve existing sagamente-push-v1 and all WhatsApp/RKC cron jobs.
do $$
declare v_job bigint;
begin
 select jobid into v_job from cron.job
 where jobname='saga-digest-draft-preparer-minute';
 if v_job is null then
   v_job := cron.schedule('saga-digest-draft-preparer-minute','* * * * *',
     'select public.saga_digest_prepare_tick();');
 end if;
 -- Mandatory postcondition in the same transaction: NEVER leave it active.
 perform cron.alter_job(job_id=>v_job, active=>false);
 if not exists (select 1 from cron.job where jobid=v_job
    and active=false and command='select public.saga_digest_prepare_tick();')
 then
   raise exception 'Saga draft cron must be registered INACTIVE';
 end if;
end $$;
