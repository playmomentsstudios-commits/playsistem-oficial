import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import {buildSagaInternalPreview,sagaZonedParts} from '../src/lib/sagaInternalDigestPreview.mjs'

const event=(id,created_at,source_table='tasks',event_type='task_status')=>({
 id,created_at,source_table,event_type,title:id,message:'Mensagem '+id
})
const day='2026-10-17',now='2026-10-17T23:00:00Z'
const events=[
 event('prev-evening','2026-10-16T22:00:00Z'),
 event('morning-last','2026-10-17T09:59:00Z'),
 event('midday-start','2026-10-17T10:00:00Z'),
 event('midday-last','2026-10-17T15:59:00Z'),
 event('evening-start','2026-10-17T16:00:00Z'),
 event('evening-last','2026-10-17T21:59:00Z'),
 event('tomorrow-morning','2026-10-17T22:00:00Z'),
 event('disallowed-source','2026-10-17T11:00:00Z','unknown'),
 event('old-digest','2026-10-17T11:00:00Z','tasks','daily_digest'),
]
test('three disjoint Brasília windows use exact boundaries',()=>{
 const ids=slot=>buildSagaInternalPreview({day,slot,now,events}).lines.join('\n')
 assert.match(ids(7),/prev-evening/)
 assert.match(ids(7),/morning-last/)
 assert.doesNotMatch(ids(7),/midday-start/)
 assert.match(ids(13),/midday-start/)
 assert.match(ids(13),/midday-last/)
 assert.doesNotMatch(ids(13),/evening-start/)
 assert.match(ids(19),/evening-start/)
 assert.match(ids(19),/evening-last/)
 for (const slot of [7,13,19]){
   assert.doesNotMatch(ids(slot),/tomorrow-morning|disallowed-source|old-digest/)
 }
});
test('invalid input and future timestamps never produce speculative content',()=>{
 assert.throws(()=>buildSagaInternalPreview({day:'invalid',slot:7,now,events}))
 assert.throws(()=>buildSagaInternalPreview({day,slot:8,now,events}))
 assert.equal(buildSagaInternalPreview({day,slot:19,now:'2026-10-17T10:00:00Z',events}).count,0)
 assert.equal(sagaZonedParts('2026-10-17T10:00:00Z').minute,420)
});
test('deduplicated preview is deterministic without any send side effect',()=>{
 const a=buildSagaInternalPreview({day,slot:13,now,events:[...events,events[2]]})
 const b=buildSagaInternalPreview({day,slot:13,now,events})
 assert.deepEqual(a,b)
 assert.equal(a.count,2)
});
test('UI is integrated only under admin-only route, with read-only Supabase calls',()=>{
 const read=path=>readFileSync(new URL('../'+path,import.meta.url),'utf8')
 const page=read('src/pages/admin/AdminSagaAssistant.tsx')
 const panel=read('src/pages/admin/SagaDigestPreviewPanel.tsx')
 const app=read('src/AppV2.tsx')
 assert.match(page,/view === 'preview' \? <SagaDigestPreviewPanel/)
 assert.match(app,/path="saga" element=\{<AdminPermissionGate adminOnly>/)
 assert.match(panel,/supabase\.auth\.getUser\(\)/)
 assert.match(panel,/profile\?\.role !== 'admin'/)
 assert.match(panel,/sagamente_assistant_events/)
 for(const forbidden of ['wa_bridge_claim','sagamente_assistant_tick','whatsapp_message_outbox','cron.schedule','.insert(','.update(','.rpc(']){
   assert.ok(!panel.includes(forbidden), 'unexpected writable/send operation: '+forbidden)
 }
});
