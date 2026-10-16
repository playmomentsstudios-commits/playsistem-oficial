import test from 'node:test';
import assert from 'node:assert/strict';
import {isAuthorizedSagaStageRecipient} from '../src/lib/sagaDigestRecipientPolicy.mjs';
import {prepareAuthorizedSagaCustomerPreviews} from '../src/lib/sagaDigestCustomerPreview.mjs';
const uid='11111111-1111-4111-8111-111111111111';
const outsider='22222222-2222-4222-8222-222222222222';
const eventId='33333333-3333-4333-8333-333333333333';
const stageId='44444444-4444-4444-8444-444444444444';
const projectId='55555555-5555-4555-8555-555555555555';
function fixture(){
 return {
 sagamente_assistant_events:[{id:eventId,event_type:'project_stage_status',source_table:'project_stages',source_id:stageId}],
 profiles:[{id:uid,role:'customer',status:'active',phone:'62993241277'},
 {id:outsider,role:'customer',status:'active',phone:'62993241278'}],
 user_preferences:[{user_id:uid,wa_automatic_opt_in:true,wa_opt_in_phone:'5562993241277',wa_opt_in_at:'2026-10-16T00:00:00Z',notify_project_updates:true},
 {user_id:outsider,wa_automatic_opt_in:true,wa_opt_in_phone:'5562993241278',wa_opt_in_at:'2026-10-16T00:00:00Z',notify_project_updates:true}],
 project_stages:[{id:stageId,project_id:projectId,client_visible:true}],
 projects:[{id:projectId,customer_id:uid,project_type:'customer'}],
 project_customer_access:[],
 };
}
function fakeDb(tables){
 return {from(table){
  const filters=[];
  const q={
   select(){return q},
   eq(k,v){filters.push([k,v]);return q},
   async maybeSingle(){
    const rows=tables[table];
    if(!Array.isArray(rows))return {data:null,error:new Error('missing table')};
    return {data:rows.find(row=>filters.every(([k,v])=>row[k]===v))??null,error:null};
   }
  };
  return q;
 }};
}
const check=(tables,user=uid)=>isAuthorizedSagaStageRecipient({db:fakeDb(tables),eventId,recipientId:user});
test('only a consenting active customer with client-visible stage project access is granted',async()=>{
 const tables=fixture();
 assert.equal(await check(tables),true);
 assert.equal(await check(tables,outsider),false);
 tables.project_customer_access=[{project_id:projectId,customer_id:outsider}];
 assert.equal(await check(tables,outsider),true);
});
test('revocations, internal projects, unknown events, hidden stages and missing consent fail closed',async()=>{
 const tables=fixture();
 tables.user_preferences[0].wa_automatic_opt_in=false;assert.equal(await check(tables),false);
 tables.user_preferences[0].wa_automatic_opt_in=true;
 tables.user_preferences[0].wa_opt_in_at=null;assert.equal(await check(tables),false);
 tables.user_preferences[0].wa_opt_in_at='2026-10-16T00:00:00Z';
 tables.project_stages[0].client_visible=false;assert.equal(await check(tables),false);
 tables.project_stages[0].client_visible=true;
 tables.projects[0].project_type='internal';assert.equal(await check(tables),false);
 tables.projects[0].project_type='customer';
 tables.sagamente_assistant_events[0].event_type='academy_purchase_paid';assert.equal(await check(tables),false);
 tables.sagamente_assistant_events=[];assert.equal(await check(tables),false);
});
test('only matched authorized source events reach staged preview; dispatch remains off',async()=>{
 const tables=fixture();
 const args={db:fakeDb(tables),at:'2026-10-17T10:00:00Z',
  settings:{enabled:true,preview_enabled:true,dispatch_enabled:false},
  recipientIds:[uid,outsider],
  events:[{id:eventId,title:'Etapa concluída',message:'Revisão disponível',source_table:'project_stages',created_at:'2026-10-17T09:00:00Z'}]};
 const result=await prepareAuthorizedSagaCustomerPreviews(args);
 assert.equal(result.status,'preview_only');
 assert.equal(result.drafts.length,1);
 assert.equal(result.drafts[0].recipientId,uid);
 assert.equal(result.drafts[0].eventIds.length,1);
 assert.equal((await prepareAuthorizedSagaCustomerPreviews({...args,settings:{enabled:false,preview_enabled:true,dispatch_enabled:false}})).drafts.length,0);
 assert.equal((await prepareAuthorizedSagaCustomerPreviews({...args,settings:{enabled:true,preview_enabled:true,dispatch_enabled:true}})).drafts.length,0);
});
