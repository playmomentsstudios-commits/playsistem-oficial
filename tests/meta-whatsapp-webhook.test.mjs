import test from 'node:test'
import assert from 'node:assert/strict'
import { createHmac } from 'node:crypto'
import { createMetaWebhookHandler } from '../supabase/functions/meta-whatsapp-webhook/webhook-core.mjs'

const url='https://example.test/functions/v1/meta-whatsapp-webhook'
const verify='secure-test-token-for-meta-123456789'
const appSecret='a-secure-test-meta-app-secret-123456789'
const handler=createMetaWebhookHandler(name=>({
  META_WA_VERIFY_TOKEN:verify,META_WA_APP_SECRET:appSecret,
})[name]||'')

test('GET challenge only with matching verify token',async()=>{
  const ok=await handler(new Request(url+'?hub.mode=subscribe&hub.verify_token='+verify+'&hub.challenge=123456'))
  assert.equal(ok.status,200)
  assert.equal(await ok.text(),'123456')
  const bad=await handler(new Request(url+'?hub.mode=subscribe&hub.verify_token=wrong&hub.challenge=123456'))
  assert.equal(bad.status,403)
  const noChallenge=await handler(new Request(url+'?hub.mode=subscribe&hub.verify_token='+verify))
  assert.equal(noChallenge.status,403)
})

test('unconfigured webhook rejects verification and POST',async()=>{
  const closed=createMetaWebhookHandler(()=>undefined)
  assert.equal((await closed(new Request(url+'?hub.mode=subscribe&hub.verify_token=123&hub.challenge=123'))).status,503)
  assert.equal((await closed(new Request(url,{method:'POST',body:'{}'}))).status,503)
})

function signed(body,secret=appSecret){
  const raw=JSON.stringify(body)
  return new Request(url,{method:'POST',headers:{
    'content-type':'application/json',
    'x-hub-signature-256':'sha256='+createHmac('sha256',secret).update(raw).digest('hex'),
  },body:raw})
}

test('valid signed Meta payload acknowledged but not processed',async()=>{
  const result=await handler(signed({object:'whatsapp_business_account',entry:[]}))
  assert.equal(result.status,200)
  assert.deepEqual(await result.json(),{received:true,processed:false})
  assert.equal(result.headers.get('cache-control'),'no-store')
})

test('missing or incorrect Meta signature is rejected',async()=>{
  assert.equal((await handler(new Request(url,{method:'POST',headers:{'content-type':'application/json'},body:'{}'}))).status,403)
  assert.equal((await handler(signed({object:'whatsapp_business_account',entry:[]},'wrong-secret'))).status,403)
})

test('invalid signed payloads are rejected',async()=>{
  assert.equal((await handler(signed({object:'something_else',entry:[]}))).status,400)
  assert.equal((await handler(signed({object:'whatsapp_business_account',entry:null}))).status,400)
})

test('only GET and POST are allowed',async()=>{
  const resp=await handler(new Request(url,{method:'PUT'}))
  assert.equal(resp.status,405)
})
