import test from 'node:test';import assert from 'node:assert/strict';import{readFile,access}from'node:fs/promises';
const webhook=await readFile(new URL('../supabase/functions/asaas-webhook/index.ts',import.meta.url),'utf8');
test('webhook relies on DB transactional notification trigger',()=>{assert.doesNotMatch(webhook,/type:\s*["']payment_confirmed["']/);assert.match(webhook,/db\.from\("payments"\)\.update/)});
test('legacy direct card edge function is retired',async()=>{let exists=true;try{await access(new URL('../supabase/functions/asaas-card-payment/index.ts',import.meta.url))}catch{exists=false}assert.equal(exists,false)});
