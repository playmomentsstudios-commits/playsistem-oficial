import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';

const read = path=>readFileSync(new URL('../'+path,import.meta.url),'utf8');
const sql=read('supabase/migrations/20261017132349_saga_ops_retry_guard.sql');
const cleanup=read('supabase/migrations/20261017132701_saga_trial_executor_cleanup.sql');

test('Saga uses one existing cron, without changing RKC or globally enabling the bridge',()=>{
 assert.match(sql,/where jobname='saga-owner-ops-minute'/);
 assert.match(sql,/cron\.alter_job/);
 assert.match(sql,/command=>'select public\.saga_ops_retry_tick\(\);'/);
 assert.doesNotMatch(sql,/cron\.schedule\s*\(/);
 assert.doesNotMatch(sql,/update public\.app_settings/i);
 assert.doesNotMatch(sql,/rkc_felipe|wa_bridge_claim/i);
});
test('bridge OFF means no new failed event, no queued messages',()=>{
 assert.match(sql,/app\.wa_bridge_auto_enabled is distinct from true/);
 assert.match(sql,/app\.wa_bridge_delivery_mode not in \('consented_clients','single_client'\)/);
 assert.match(sql,/bridge\.heartbeat_at<now\(\)-interval '35 seconds'/);
 assert.match(sql,/return jsonb_build_object\('status','bridge_paused'\)/);
});
test('retries only failed preflight events without any outbox; otherwise no duplicates',()=>{
 assert.match(sql,/coalesce\(bool_or\(outbox_id is not null\),false\)/);
 assert.match(sql,/if v_has_outbox then/);
 assert.match(sql,/if v_count>=4 then/);
 assert.match(sql,/v_key\|\|'_r'\|\|v_attempt/);
 assert.match(sql,/automation_enqueue_for_flow\(/);
 assert.match(sql,/saga_personal_ops/);
});
test('obsolete parallel trial functions are removed after checking they are not scheduled',()=>{
 assert.match(cleanup,/cron\.job where command like '%saga_personal_tick%'/);
 assert.match(cleanup,/drop function if exists public\.saga_personal_tick/);
 assert.match(cleanup,/drop function if exists public\.saga_personal_brief_at/);
});
