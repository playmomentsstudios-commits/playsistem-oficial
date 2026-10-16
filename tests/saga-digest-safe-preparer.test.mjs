import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
const sql=readFileSync(new URL(
 '../supabase/migrations/20261016223121_saga_digest_safe_preparer.sql',import.meta.url
),'utf8');

test('Saga digest preparation and dispatch have TWO independent OFF switches',()=>{
 assert.match(sql,/create table if not exists public\.saga_digest_runtime_controls/i);
 assert.match(sql,/prepare_enabled boolean not null default false/i);
 assert.match(sql,/dispatch_enabled boolean not null default false/i);
 assert.match(sql,/cfg\.enabled is distinct from true/i);
 assert.match(sql,/cfg\.whatsapp_notifications is distinct from false/i);
 assert.match(sql,/ctrl\.prepare_enabled is distinct from true/i);
 assert.match(sql,/ctrl\.dispatch_enabled is distinct from false/i);
});
test('Preview and preparer are backend-only, not public RPCs',()=>{
 assert.match(sql,/revoke all on function public\.saga_digest_preview_at\(timestamptz\)[\s\S]*?from public, anon, authenticated/i);
 assert.match(sql,/revoke all on function public\.saga_digest_prepare_tick\(timestamptz\)[\s\S]*?from public,anon,authenticated/i);
 assert.match(sql,/grant execute on function public\.saga_digest_prepare_tick\(timestamptz\) to service_role/i);
 assert.match(sql,/alter table public\.saga_digest_runtime_controls enable row level security/i);
 assert.match(sql,/revoke all on public\.saga_digest_runtime_controls from public, anon, authenticated/i);
});
test('No mutation of live WhatsApp or notifications in staged backend',()=>{
 for (const unsafe of [/insert into public\.notifications/i,
 /insert into public\.whatsapp_message_outbox/i,
 /create or replace function public\.wa_bridge_claim/i,
 /cron\.schedule\s*\(/i,
 /update public\.sagamente_assistant_settings/i]){
  assert.doesNotMatch(sql,unsafe);
 }
 assert.match(sql,/insert into public\.saga_digest_runs/i);
 assert.match(sql,/on conflict\(slot,local_day,recipient_user_id\) do nothing/i);
});
test('Recipient privacy and local time window boundaries are explicit',()=>{
 assert.match(sql,/cfg\.timezone<>'America\/Sao_Paulo'/i);
 assert.match(sql,/v_clock not in \('07:00','13:00','19:00'\)/i);
 assert.match(sql,/stage\.client_visible is true/i);
 assert.match(sql,/project\.project_type<>'internal'/i);
 assert.match(sql,/pref\.notify_project_updates is true/i);
 assert.match(sql,/pref\.wa_automatic_opt_in is true/i);
 assert.match(sql,/pref\.wa_opt_in_at is not null/i);
 assert.match(sql,/public\.wa_bridge_customer_eligible\(recipient\.id\)/i);
 assert.match(sql,/having count\(\*\) between 1 and 30/i);
 assert.match(sql,/e\.created_at>=v_start and e\.created_at<v_end/i);
});
