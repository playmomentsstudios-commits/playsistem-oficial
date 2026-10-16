import test from 'node:test';
import assert from 'node:assert/strict';
import { sagaDueSlot, buildSagaDigestPreview } from '../src/lib/sagaDigestPreview.mjs';
const id='11111111-1111-4111-8111-111111111111';
const other='22222222-2222-4222-8222-222222222222';
const ev={id:'event-1',title:'Projeto',message:'Atualizado',created_at:'2026-10-17T09:00:00Z'};
test('slots are in Sao Paulo local time, only on minute zero',()=>{
 assert.equal(sagaDueSlot('2026-10-17T10:00:00Z'),7);
 assert.equal(sagaDueSlot('2026-10-17T16:00:00Z'),13);
 assert.equal(sagaDueSlot('2026-10-17T22:00:00Z'),19);
 assert.equal(sagaDueSlot('2026-10-17T10:01:00Z'),null);
});
test('never builds a preview without BOTH recipient and event grants',()=>{
 const args={at:'2026-10-17T10:00:00Z',recipientId:id,events:[ev]};
 assert.equal(buildSagaDigestPreview({...args,authorizedRecipientIds:new Set([id]),eventAudience:new Map()}),null);
 assert.equal(buildSagaDigestPreview({...args,authorizedRecipientIds:new Set(),eventAudience:new Map([['event-1',new Set([id])]])}),null);
 assert.equal(buildSagaDigestPreview({...args,authorizedRecipientIds:new Set([id]),eventAudience:new Map([['event-1',new Set([other])]])}),null);
});
test('authorized previews deduplicate events and use deterministic idempotency',()=>{
 const args={at:'2026-10-17T10:00:00Z',recipientId:id,events:[ev,ev],authorizedRecipientIds:new Set([id]),eventAudience:new Map([['event-1',new Set([id])]])};
 const a=buildSagaDigestPreview(args);
 assert.deepEqual(a.eventIds,['event-1']);
 assert.equal(a.key,buildSagaDigestPreview(args).key);
 assert.match(a.title,/Saga/);
});

test('three digest slots never repeat events from a previous slot',()=>{
 const events=[
  {id:'prev19',title:'Folia',message:'21h ontem',created_at:'2026-10-16T22:00:00Z'},
  {id:'morning',title:'Projeto',message:'06h',created_at:'2026-10-17T09:00:00Z'},
  {id:'midday',title:'Projeto',message:'08h',created_at:'2026-10-17T11:00:00Z'},
  {id:'evening',title:'Projeto',message:'14h',created_at:'2026-10-17T17:00:00Z'}
 ];
 const grants=new Map(events.map(event=>[event.id,new Set([id])]));
 const args={recipientId:id,events,eventAudience:grants,authorizedRecipientIds:new Set([id])};
 const morning=buildSagaDigestPreview({...args,at:'2026-10-17T10:00:00Z'});
 const midday=buildSagaDigestPreview({...args,at:'2026-10-17T16:00:00Z'});
 const evening=buildSagaDigestPreview({...args,at:'2026-10-17T22:00:00Z'});
 assert.deepEqual(morning.eventIds,['prev19','morning']);
 assert.deepEqual(midday.eventIds,['midday']);
 assert.deepEqual(evening.eventIds,['evening']);
 assert.equal(new Set([...morning.eventIds,...midday.eventIds,...evening.eventIds]).size,4);
});
