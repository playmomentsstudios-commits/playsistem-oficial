import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
const file=readFileSync(new URL('../supabase/migrations/20261016223403_saga_digest_inactive_cron.sql',import.meta.url),'utf8');

test('cron registration is inactive in the SAME transaction',()=>{
 assert.match(file,/cron\.schedule\('saga-digest-draft-preparer-minute','\* \* \* \* \*'/i);
 assert.match(file,/select public\.saga_digest_prepare_tick\(\);/i);
 assert.match(file,/cron\.alter_job\(job_id=>v_job, active=>false\)/i);
 assert.match(file,/and active=false/i);
 assert.match(file,/raise exception 'Saga draft cron must be registered INACTIVE'/i);
});
test('cron registration never activates bridge or existing push jobs',()=>{
 assert.doesNotMatch(file,/cron\.unschedule/i);
 assert.doesNotMatch(file,/wa_bridge_claim|whatsapp_message_outbox|update public\.app_settings/i);
 assert.doesNotMatch(file,/active\s*=>\s*true/i);
});
