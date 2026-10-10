import assert from 'node:assert/strict'
import {readFileSync} from 'node:fs'
import test from 'node:test'
import {registeredRecipientJid} from '../services/whatsapp-bridge/phone-utils.mjs'
import {attachDeliveryReceipts} from '../services/whatsapp-bridge/receipt-tracker.mjs'

const expected='5562993241277'
const full=expected+'@s.whatsapp.net'
const legacy='556293241277@s.whatsapp.net'
const worker=readFileSync(new URL('../services/whatsapp-bridge/index.mjs',import.meta.url),'utf8')
const ui=readFileSync(new URL('../src/pages/admin/AdminWhatsappCenter.tsx',import.meta.url),'utf8')
const migration=readFileSync(new URL('../supabase/migrations/20261010235918_wa_bridge_registered_destination.sql',import.meta.url),'utf8')

test('never guess a real destination: require authoritative WhatsApp identity',()=>{
  assert.equal(registeredRecipientJid(expected,[{jid:full,exists:true}]),full)
  assert.equal(registeredRecipientJid(expected,[{jid:legacy,exists:true}]),legacy)
  assert.throws(()=>registeredRecipientJid(expected,[]),/Número não confirmado/)
  assert.throws(()=>registeredRecipientJid(expected,[{jid:full,exists:false}]),/Número não confirmado/)
  assert.throws(()=>registeredRecipientJid(expected,[{jid:'5561993241277@s.whatsapp.net',exists:true}]),/Número não confirmado/)
  assert.throws(()=>registeredRecipientJid(expected,[{jid:'991234567890@lid',exists:true}]),/Número não confirmado/)
  assert.throws(()=>registeredRecipientJid(expected,[{jid:full,exists:true},{jid:legacy,exists:true}]),/mais de uma conta/)
})
test('service queries WhatsApp and database verifies registered recipient before sending',()=>{
  assert.match(worker,/registeredRecipientJid\(destination,await Promise.race/)
  assert.match(worker,/socket.onWhatsApp\(destination\)/)
  assert.match(worker,/wa_bridge_register_destination/)
  assert.match(migration,/destination_phone into v_phone/)
  assert.match(migration,/v_jidphone<>v_phone/)
  assert.match(worker,/if\(!verified\)throw new Error/)
})
test('ack tracking never treats a sendMessage id as successful delivery',async()=>{
  const events={}
  const sent=[]
  let accept=false
  const sock={ev:{on:(name,callback)=>{events[name]=callback}}}
  const tracker=attachDeliveryReceipts(sock,'test-instance',async (method,params)=>{
    sent.push({method,params})
    return accept
  })
  events['messages.update']([{key:{fromMe:true,id:'3EB0EXAMPLEVALID'},update:{status:2}}])
  await new Promise(resolve=>setTimeout(resolve,1))
  assert.equal(sent.length,1)
  assert.equal(sent[0].params.p_code,2)
  accept=true
  await tracker.flush('3EB0EXAMPLEVALID')
  assert.equal(sent.length,2)
  events['messages.update']([{key:{fromMe:true,id:'3EB0EXAMPLEVALID'},update:{status:3}}])
  await new Promise(resolve=>setTimeout(resolve,1))
  assert.equal(sent.at(-1).params.p_code,3)
  // Incoming or manual messages must not be reported as outgoing ack.
  const before=sent.length
  events['messages.update']([{key:{fromMe:false,id:'3EB0OTHERIDAAA'},update:{status:4}}])
  assert.equal(sent.length,before)
})
test('obsolete local bridge cannot claim messages after reactivating the panel',()=>{
  const gate=readFileSync(new URL('../supabase/migrations/20261010235920_wa_block_legacy_bridge_worker.sql',import.meta.url),'utf8')
  assert.match(gate,/before insert on public\.whatsapp_bridge_attempts/)
  assert.match(gate,/worker_capability='registered-jid-receipts-v1'/)
  assert.match(gate,/worker_capability_at>now\(\)-interval '35 seconds'/)
  assert.match(worker,/wa_bridge_worker_capability/)
  assert.match(worker,/if\(allowed\)await sendOne\(\)/)
})
test('admin distinguishes local identifiers, server confirmation and delivery',()=>{
  assert.match(ui,/ID gerado · entrega não comprovada/)
  assert.match(ui,/Confirmação do WhatsApp/)
  assert.match(ui,/Nenhuma confirmação recebida/)
  assert.match(ui,/receiptStats.delivered_today/)
  assert.match(ui,/wa_bridge_receipt_summary/)
})
