import test from 'node:test';import assert from 'node:assert/strict';import{readFile}from'node:fs/promises';
const sql=await readFile(new URL('../supabase/migrations/20260929183000_transactional_email_outbox.sql',import.meta.url),'utf8');
test('outbox is provider neutral and retry ready',()=>{assert.match(sql,/transactional_email_outbox/);assert.match(sql,/status in \('pending','processing','sent','failed','cancelled'\)/);assert.match(sql,/attempts integer/);assert.match(sql,/next_attempt_at/);assert.match(sql,/provider_message_id/)})
test('transactional portal events feed the outbox idempotently',()=>{for(const x of ['payment_confirmed','academy_enrollment','project_completed'])assert.match(sql,new RegExp(x));assert.match(sql,/unique\(event_key,entity_type,entity_id,user_id\)/)})
