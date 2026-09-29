import test from 'node:test'
import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'

const pix=await readFile(new URL('../supabase/functions/asaas-create-payment/index.ts',import.meta.url),'utf8')
const card=await readFile(new URL('../supabase/functions/asaas-card-payment/index.ts',import.meta.url),'utf8')
const checkout=await readFile(new URL('../supabase/functions/asaas-create-checkout/index.ts',import.meta.url),'utf8')
const cart=await readFile(new URL('../src/pages/public/CartPage.tsx',import.meta.url),'utf8')
const webhook=await readFile(new URL('../supabase/functions/asaas-webhook/index.ts',import.meta.url),'utf8')

test('generic Asaas charge endpoint is PIX-only',()=>{
 assert.match(pix,/billing_type!=="PIX"/)
 assert.match(pix,/const method="pix_gateway"/)
 assert.match(pix,/pixQrCode/)
})

test('card flow requires customer ownership and does not persist full card data',()=>{
 assert.match(card,/eq\("customer_id",userId\)/)
 assert.match(card,/remoteIp/)
 assert.match(card,/last4:card\.number\.slice\(-4\)/)
 assert.doesNotMatch(card,/provider_payload:\{[^}]*number:card\.number/)
 assert.doesNotMatch(card,/provider_payload:\{[^}]*ccv/)
})

test('Asaas webhook authenticates, deduplicates and covers financial terminal states',()=>{
 assert.match(webhook,/ASAAS_WEBHOOK_TOKEN/)
 assert.match(webhook,/payment_webhook_events/)
 for(const event of ['PAYMENT_CONFIRMED','PAYMENT_RECEIVED','PAYMENT_REFUNDED','PAYMENT_OVERDUE','PAYMENT_CREDIT_CARD_CAPTURE_REFUSED','PAYMENT_CHARGEBACK_REQUESTED']){
  assert.match(webhook,new RegExp(event))
 }
})


test('card checkout is hosted by Asaas so PAN and CVV do not cross Play Moments',()=>{
 assert.match(checkout,/billingTypes:\["CREDIT_CARD"\]/)
 assert.match(cart,/createAsaasCheckout/)
 assert.doesNotMatch(cart,/credit_card/)
 assert.doesNotMatch(cart,/ccv/)
 assert.doesNotMatch(cart,/expiryMonth/)
})


test('hosted checkout remains resumable when buyer cancels or leaves Asaas',async()=>{
 const payments=await readFile(new URL('../src/pages/customer/PaymentsPage.tsx',import.meta.url),'utf8')
 assert.match(payments,/asaas_checkout/)
 assert.match(payments,/Continuar pagamento/)
 const cardBranch=cart.slice(cart.indexOf("paymentMethod==='CARD'"))
 assert.doesNotMatch(cardBranch.slice(0,cardBranch.indexOf('catch(paymentError')),/clearCart\(\)/)
})
