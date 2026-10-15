import test from 'node:test'
import assert from 'node:assert/strict'
import vm from 'node:vm'
import {readFileSync} from 'node:fs'
import ts from 'typescript'

const orderId='30000000-0000-4000-8000-000000000001'
function handler(name,{rows={},verification={},phone=''}={}){
 let serve
 const writes=[],calls=[],grants=[]
 const db={
  auth:{getUser:async()=>({data:{user:{id:orderId,email:'buyer@example.com',email_confirmed_at:'2026-10-15'}}})},
  rpc:async(...args)=>{grants.push(args);return {data:'fulfilled'}},
  from(table){
   const query={select(){return this},eq(){return this},in(){return this},gte(){return this},maybeSingle(){return this},
    insert(value){writes.push({table,value});return this},update(value){writes.push({table,value});return this},
    then(resolve,reject){return Promise.resolve({data:rows[table]??null,count:0}).then(resolve,reject)}}
   return query
  }
 }
 let source=readFileSync(new URL(`../supabase/functions/${name}/index.ts`,import.meta.url),'utf8')
 source=source.replace(/^import .*\n/,'')
 const code=ts.transpileModule(source,{compilerOptions:{target:ts.ScriptTarget.ES2022,module:ts.ModuleKind.None}}).outputText
 vm.runInNewContext(code,{
  createClient:()=>db,Deno:{env:{get:key=>({SUPABASE_URL:'https://example.supabase.co',SUPABASE_SERVICE_ROLE_KEY:'test'})[key]},serve:fn=>{serve=fn}},
  fetch:async(url,options)=>{calls.push({url,body:JSON.parse(options.body)});return new Response(JSON.stringify(name.endsWith('checkout')?{url:'https://checkout.infinitepay.com.br/test?lenc=test'}:verification))},
  Response,URL,crypto,console
 })
 return {request:body=>serve(new Request('https://example.test',{method:'POST',headers:{Authorization:'Bearer test'},body:JSON.stringify(body)})),writes,calls,grants}
}
test('Webhook rejects an unverified or mismatched payment without writing access',async()=>{
 for(const verification of [{success:true,paid:false,amount:299,capture_method:'pix'},{success:true,paid:true,amount:99,capture_method:'pix'}]){
  const h=handler('academy-infinitepay-webhook',{rows:{academy_work_purchases:{id:orderId,status:'pending',amount_cents:299},academy_infinitepay_settings:{infinitepay_handle:'merchant'}},verification})
  const result=await h.request({order_nsu:orderId,invoice_slug:'invoice-test',transaction_nsu:'transaction-test'})
  assert.ok([400,409].includes(result.status))
  assert.equal(h.writes.length,0);assert.equal(h.grants.length,0)
 }
})
test('Webhook checks the provider before forwarding a confirmed payment to fulfillment',async()=>{
 const h=handler('academy-infinitepay-webhook',{rows:{academy_work_purchases:{id:orderId,status:'pending',amount_cents:299},academy_infinitepay_settings:{infinitepay_handle:'merchant'}},verification:{success:true,paid:true,amount:299,capture_method:'pix'}})
 assert.equal((await h.request({order_nsu:orderId,invoice_slug:'invoice-test',transaction_nsu:'transaction-test'})).status,200)
 assert.equal(h.calls.length,1);assert.equal(h.calls[0].body.order_nsu,orderId)
 assert.equal(h.writes[0].value.status,'paid_waiting_email')
 assert.equal(h.grants[0][0],'academy_fulfill_verified_purchase')
})
test('Checkout preserves Brazilian country code and derives amount from server prices',async()=>{
 for(const [phone,expected] of [['+55 62 99324-1277','+5562993241277'],['62 99324-1277','+5562993241277'],['55 99999-1234','+5555999991234']]){
  const h=handler('academy-infinitepay-checkout',{rows:{
   academy_infinitepay_settings:{checkout_enabled:true,infinitepay_handle:'merchant'},
   profiles:{role:'customer',status:'active',first_name:'Buyer',phone},
   academy_library_works:{id:orderId,title:'Obra',landing_page_id:orderId},
   site_landing_pages:{status:'published'},academy_work_prices:{ebook_cents:99,checkout_enabled:true},
   academy_library_items:[{format:'ebook',status:'published'}]
  }})
  assert.equal((await h.request({release_code:'01',requested_format:'ebook',amount_cents:1})).status,200)
  assert.equal(h.calls[0].body.customer.phone_number,expected)
  assert.equal(h.calls[0].body.items[0].price,99)
 }
})
