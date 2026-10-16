import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {previewSagaCustomerDigestsFromDb} from '../src/lib/sagaDigestDbDryRun.mjs';
const uid='11111111-1111-4111-8111-111111111111';
const outsider='22222222-2222-4222-8222-222222222222';
const eventId='33333333-3333-4333-8333-333333333333';
const stageId='44444444-4444-4444-8444-444444444444';
const projectId='55555555-5555-4555-8555-555555555555';
const at='2026-10-17T10:00:00Z';
function fixture() {
 return {
 sagamente_assistant_settings:[{id:true,enabled:false,whatsapp_notifications:false,
   timezone:'America/Sao_Paulo',digest_times:['07:00','13:00','19:00']}],
 sagamente_assistant_events:[{id:eventId,title:'Etapa revisada',message:'Prévia disponível',
   event_type:'project_stage_status',source_table:'project_stages',source_id:stageId,created_at:'2026-10-17T09:00:00Z'}],
 profiles:[{id:uid,role:'customer',status:'active',phone:'62993241277'},
   {id:outsider,role:'customer',status:'active',phone:'62993241278'}],
 user_preferences:[{user_id:uid,wa_automatic_opt_in:true,wa_opt_in_phone:'5562993241277',
   wa_opt_in_at:'2026-10-16T00:00:00Z',notify_project_updates:true},
   {user_id:outsider,wa_automatic_opt_in:true,wa_opt_in_phone:'5562993241278',
   wa_opt_in_at:'2026-10-16T00:00:00Z',notify_project_updates:true}],
 project_stages:[{id:stageId,project_id:projectId,client_visible:true}],
 projects:[{id:projectId,customer_id:uid,project_type:'customer'}],
 project_customer_access:[]
 };
}
function db(tables){
 return {from(table){
   let rows=Array.isArray(tables[table])?[...tables[table]]:[];
   const query={
     select(){return query},
     eq(k,v){rows=rows.filter(r=>r[k]===v);return query},
     gte(k,v){rows=rows.filter(r=>String(r[k])>=String(v));return query},
     lte(k,v){rows=rows.filter(r=>String(r[k])<=String(v));return query},
     order(k,{ascending}){rows.sort((a,b)=>String(a[k]).localeCompare(String(b[k]))*(ascending?1:-1));return query},
     limit(n){return Promise.resolve({data:rows.slice(0,n),error:null})},
     maybeSingle(){return Promise.resolve({data:rows[0]??null,error:null})}
   };
   return query;
 }};
}
test('existing Saga settings are the only schedule source in staging migration',()=>{
 const sql=readFileSync(new URL('../supabase/migrations/20261016220732_saga_digest_schedule_disabled.sql',import.meta.url),'utf8');
 assert.doesNotMatch(sql,/create table if not exists public\.saga_digest_schedules/i);
 assert.doesNotMatch(sql,/from public\.saga_digest_schedules/i);
 assert.match(sql,/from public\.sagamente_assistant_settings s/i);
 assert.match(sql,/s\.enabled = true/i);
 assert.match(sql,/revoke all on public\.saga_digest_runs from public,anon,authenticated/i);
 assert.doesNotMatch(sql,/cron\.schedule|whatsapp_message_outbox|wa_bridge_claim\(/i);
});
test('never accesses DB without explicit dry-run approval',async()=>{
 const broken={from(){throw Error('DB must not be called')}};
 assert.deepEqual(await previewSagaCustomerDigestsFromDb({at,db:broken,recipientIds:[uid]}),
   {status:'approval_required',drafts:[]});
});
test('reads disabled canonical settings and only shows explicitly authorized project event',async()=>{
 const tables=fixture();
 const good=await previewSagaCustomerDigestsFromDb({at,db:db(tables),recipientIds:[uid,outsider],dryRunApproved:true});
 assert.equal(good.status,'preview_only');
 assert.equal(good.drafts.length,1);
 assert.equal(good.drafts[0].recipientId,uid);
 assert.deepEqual(good.drafts[0].eventIds,[eventId]);
 assert.match(good.drafts[0].message,/Prévia disponível/);
 tables.user_preferences[0].wa_automatic_opt_in=false;
 const rejected=await previewSagaCustomerDigestsFromDb({at,db:db(tables),recipientIds:[uid],dryRunApproved:true});
 assert.deepEqual(rejected.drafts,[]);
});
test('if Saga is on or WhatsApp enabled, staging dry-run refuses to run',async()=>{
 const tables=fixture();
 for(const [key,value] of [['enabled',true],['whatsapp_notifications',true],
   ['timezone','UTC'],['digest_times',[]]]) {
  const original=tables.sagamente_assistant_settings[0][key];
  tables.sagamente_assistant_settings[0][key]=value;
  const result=await previewSagaCustomerDigestsFromDb({at,db:db(tables),recipientIds:[uid],dryRunApproved:true});
  assert.equal(result.status,'staging_gate_closed');
  tables.sagamente_assistant_settings[0][key]=original;
 }
});
test('missing/oversized data fails closed; no cron or dispatch code',async()=>{
 const missing=fixture(); delete missing.sagamente_assistant_events;
 assert.deepEqual((await previewSagaCustomerDigestsFromDb({at,db:db(missing),recipientIds:[uid],dryRunApproved:true})).drafts,[]);
 const tooMany=fixture(); tooMany.sagamente_assistant_events=Array.from({length:201},(_,i)=>({
 ...tooMany.sagamente_assistant_events[0],id:`e-${i}`
 }));
 const bulk=await previewSagaCustomerDigestsFromDb({at,db:db(tooMany),recipientIds:[uid],dryRunApproved:true});
 assert.equal(bulk.status,'too_many_events');
 const file=readFileSync(new URL('../src/lib/sagaDigestDbDryRun.mjs',import.meta.url),'utf8');
 for(const op of ['.insert(','.update(','.rpc(','whatsapp_message_outbox','cron.schedule','wa_bridge_claim']){
  assert.ok(!file.includes(op),'unexpected mutation or send: '+op);
 }
});
