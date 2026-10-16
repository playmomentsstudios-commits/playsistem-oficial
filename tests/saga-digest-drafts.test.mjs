import test from 'node:test';
import assert from 'node:assert/strict';
import {prepareSagaDigestDrafts} from '../src/lib/sagaDigestDrafts.mjs';
const id='11111111-1111-4111-8111-111111111111', other='22222222-2222-4222-8222-222222222222';
const events=[{id:'evt1',title:'Privado',message:'Só A',created_at:'2026-10-17T09:00:00Z'},
{id:'evt2',title:'Somente B',message:'Só B',created_at:'2026-10-17T09:00:00Z'}];
const defaults={at:'2026-10-17T10:00:00Z',settings:{enabled:true,preview_enabled:true,dispatch_enabled:false},
recipientIds:[id,other],events};
test('defaults and missing permissions fail closed',async()=>{
 for(const settings of [undefined,{}, {enabled:true}, {enabled:true,preview_enabled:true,dispatch_enabled:true}])
  assert.equal((await prepareSagaDigestDrafts({...defaults,settings})).drafts.length,0);
 assert.equal((await prepareSagaDigestDrafts(defaults)).drafts.length,0);
});
test('strict per-event checks exclude another recipients data',async()=>{
 const result=await prepareSagaDigestDrafts({...defaults,
 resolveRecipientAuthorization:async()=>true,
 resolveEventAuthorization:async(event,recipient)=>event.id==='evt1' ? recipient===id : recipient===other});
 assert.equal(result.status,'preview_only');
 assert.equal(result.drafts.length,2);
 assert.deepEqual(result.drafts[0].eventIds,['evt1']);
 assert.deepEqual(result.drafts[1].eventIds,['evt2']);
 assert.doesNotMatch(result.drafts[0].message,/Somente B/);
});
test('resolver exceptions revoke permissions; no send action exists',async()=>{
 const result=await prepareSagaDigestDrafts({...defaults,
 resolveRecipientAuthorization:async(recipient)=>{if(recipient===id)throw Error('offline');return true;},
 resolveEventAuthorization:async()=>{throw Error('offline')}});
 assert.deepEqual(result.drafts,[]);
 assert.equal(result.status,'preview_only');
});
