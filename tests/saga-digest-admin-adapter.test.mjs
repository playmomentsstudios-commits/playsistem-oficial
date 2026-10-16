import test from 'node:test';
import assert from 'node:assert/strict';
import {previewInternalSagaAdminDigest} from '../src/lib/sagaDigestAdminAdapter.mjs';
const admin='11111111-1111-4111-8111-111111111111';
const records=[{id:'event-a',source_table:'tasks',title:'Atividade interna',message:'OK',created_at:'2026-10-17T09:00:00Z'},
{id:'event-b',source_table:'unknown_private',title:'Não permitido',message:'Não incluir',created_at:'2026-10-17T09:00:00Z'}];
function db(role='admin'){
 const q={select(){return this},eq(){return this},lte(){return this},order(){return this},limit(){return Promise.resolve({data:records,error:null})},maybeSingle(){return Promise.resolve({data:{id:admin,role,status:'active'},error:null})}};
 return {from(table){if(!['profiles','sagamente_assistant_events'].includes(table))throw Error('unknown table');return Object.create(q)}};
}
test('disabled adapter does not touch database',async()=>{
 const broken={from(){throw Error('should not call')}};
 assert.deepEqual((await previewInternalSagaAdminDigest({at:'2026-10-17T10:00:00Z',adminId:admin,db:broken})).drafts,[]);
});
test('only active admins receive internal event previews',async()=>{
 const args={at:'2026-10-17T10:00:00Z',adminId:admin,enabledForPreview:true};
 assert.equal((await previewInternalSagaAdminDigest({...args,db:db('customer')})).drafts.length,0);
 const got=await previewInternalSagaAdminDigest({...args,db:db()});
 assert.equal(got.status,'preview_only');
 assert.deepEqual(got.drafts[0].eventIds,['event-a']);
 assert.doesNotMatch(got.drafts[0].message,/Não incluir/);
});
test('invalid/unauthorized contexts are denied',async()=>{
 assert.equal((await previewInternalSagaAdminDigest({at:'2026-10-17T10:00:00Z',adminId:'bad',db:db(),enabledForPreview:true})).drafts.length,0);
});
