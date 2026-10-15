import test from 'node:test'
import assert from 'node:assert/strict'
import {createHandler,testMessage} from '../supabase/functions/automation-notifications/handler.mjs'
const token='a'.repeat(48)
function setup(result={status:'queued',duplicate:false}) {
 const calls=[]
 const handler=createHandler({token,url:'https://example.supabase.co',serviceKey:'private',fetcher:async(...args)=>{calls.push(args);return Response.json(result)},log:()=>{}})
 const request=(body={source:'chatgpt',flow:'rkc_felipe',kind:'test'},headers={})=>new Request('https://example.test',{method:'POST',headers:{authorization:`Bearer ${token}`,'content-type':'application/json',...headers},body:JSON.stringify(body)})
 return {handler,calls,request}
}
test('rejects missing credential without backend call',async()=>{const {handler,calls,request}=setup();assert.equal((await handler(request(undefined,{authorization:''}))).status,401);assert.equal(calls.length,0)})
test('fails closed when secret is missing',async()=>{assert.equal((await createHandler({url:'x',serviceKey:'x'})(new Request('https://x'))).status,503)})
test('rejects untrusted source and unknown flows',async()=>{const {handler,calls,request}=setup();for(const body of [{source:'other',flow:'rkc_felipe',kind:'test'},{source:'chatgpt',flow:'other',kind:'test'}]) assert.equal((await handler(request(body))).status,422);assert.equal(calls.length,0)})
test('test uses server text and stable single-dispatch key',async()=>{const {handler,calls,request}=setup();assert.equal((await handler(request())).status,202);assert.deepEqual(JSON.parse(calls[0][1].body),{p_key:'play-sistem:first-whatsapp-test:v1',p_title:'TESTE — PLAY SISTEM',p_body:testMessage})})
test('manual requires valid idempotency key and bounded content',async()=>{const {handler,calls,request}=setup();const body={source:'chatgpt',flow:'rkc_felipe',kind:'manual',title:'Check-in',message:'Pendência'};assert.equal((await handler(request(body))).status,422);assert.equal((await handler(request({...body,message:'x'.repeat(4001)},{'idempotency-key':'rkc:2026-10-15'}))).status,422);assert.equal((await handler(request(body,{'idempotency-key':'rkc:2026-10-15'}))).status,202);assert.equal(calls.length,1)})
test('duplicate returns 200 and failed preflight returns 409',async()=>{for(const [data,status] of [[{status:'queued',duplicate:true},200],[{status:'failed',error_code:'bridge_preflight_failed'},409]]){const {handler,request}=setup(data);assert.equal((await handler(request())).status,status)}})
test('rejects oversized streamed request',async()=>{const {handler,request,calls}=setup();assert.equal((await handler(request({data:'x'.repeat(21000)}))).status,413);assert.equal(calls.length,0)})
test('status reads evidence without sending a second message',async()=>{const {handler,calls}=setup([]);const res=await handler(new Request('https://example.test?key=play-sistem:first-whatsapp-test:v1',{headers:{authorization:`Bearer ${token}`}}));assert.equal(res.status,200);assert.match(calls[0][0],/automation_delivery_status/);assert.equal(calls[0][1].method,undefined)})
test('backend faults never return secrets or payload',async()=>{const handler=createHandler({token,url:'https://example.test',serviceKey:'private',fetcher:async()=>{throw new Error('network')},log:()=>{}});const {request}=setup();const res=await handler(request());assert.equal(res.status,503);assert.doesNotMatch(await res.text(),/private|TESTE/);})

test('database hash authentication fails closed and accepts only validated token',async()=>{
 const {request}=setup()
 for(const [authenticate,status] of [[async()=>false,401],[async()=>{throw new Error('offline')},503],[async()=>true,202]]){
  const handler=createHandler({url:'https://example.test',serviceKey:'private',authenticate,fetcher:async()=>Response.json({status:'queued'}),log:()=>{}})
  assert.equal((await handler(request())).status,status)
 }
})
