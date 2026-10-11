import assert from 'node:assert/strict'
import test from 'node:test'
import {
 attachmentReferences,attachmentPlan,messageAfterAttachments,downloadAttachment,
 sendAttachmentsForNotification
} from '../services/whatsapp-bridge/media-attachments.mjs'

const root='https://lfmjqctiutajgtacvxfq.supabase.co'
const url=token=>root+'/functions/v1/whatsapp-file-open?t='+token.repeat(64)
const sample=[
 '✨ *Seu projeto deu mais um passo!*',
 '',
 'Tarefa: Cartaz',
 '',
 '📂 *Arquivos desta tarefa:*',
 '',
 '🖼️ *Cartaz A4 NOV - CINECLUBE.jpg*',
 url('a'),
 '',
 '🖼️ *Cartaz A4 OUT - CINECLUBE.jpg*',
 url('b'),
 '',
 '📄 Apoio: *Pauta Cartaz.pdf*',
 url('c'),
 '',
 '🔎 *Acompanhe a tarefa:*',
 'https://playsistem-oficial.playmomentsstudios.workers.dev/n/1234567890123456789012'
].join('\n')

function response(data,options={}){
 return new Response(data,{
   status:options.status||200,
   headers:{'content-type':options.mime||'application/octet-stream',...options.headers}
 })
}
test('extract exactly 3 authenticated file references in their displayed order',()=>{
 const files=attachmentReferences(sample,root)
 assert.deepEqual(files.map(f=>f.name),[
   'Cartaz A4 NOV - CINECLUBE.jpg','Cartaz A4 OUT - CINECLUBE.jpg',
   'Pauta Cartaz.pdf'
 ])
 assert.equal(attachmentPlan(sample,root).length,3)
})
test('never download attacker-controlled links, malformed bearer tokens, or other service URLs',async()=>{
 const bad='📎 *arquivo.pdf*\nhttps://evil.example/functions/v1/whatsapp-file-open?t='+'a'.repeat(64)
 assert.equal(attachmentPlan(bad,root).length,0)
 assert.equal(attachmentPlan(sample,root.replace('https:','http:')).length,0)
 assert.equal(attachmentPlan('📎 *file.pdf*\n'+url('a')+'&next=https://evil.example',root).length,0)
 assert.equal(attachmentPlan('📎 *file.pdf*\n'+url('a').replace(/a{64}/,'AAAA'),root).length,0)
 await assert.rejects(()=>downloadAttachment({name:'x.pdf',url:'https://evil.example/x'},root),/fora do endereço autorizado/)
})
test('send the original JPG and PDF bytes as WhatsApp DOCUMENTS then task text, no redundant links',async()=>{
 const sent=[]
 const body=Buffer.from('original bytes')
 const socket={sendMessage:async (jid,message)=>{
   sent.push({jid,message})
   return {key:{id:'3EB0-valid-'+sent.length}}
 }}
 const fetchImpl=async()=>response(body,{mime:'application/octet-stream'})
 const out=await sendAttachmentsForNotification({text:sample,supabaseUrl:root,address:'556493241277@s.whatsapp.net',socket,fetchImpl})
 assert.equal(out.attached,3)
 assert.equal(out.failed,0)
 assert.equal(sent.length,3)
 assert.deepEqual(sent.map(x=>x.message.fileName),[
  'Cartaz A4 NOV - CINECLUBE.jpg','Cartaz A4 OUT - CINECLUBE.jpg','Pauta Cartaz.pdf'
 ])
 assert.equal(sent[0].message.mimetype,'image/jpeg')
 assert.equal(sent[2].message.mimetype,'application/pdf')
 assert.deepEqual(sent[0].message.document,body)
 assert.ok(!out.text.includes('/whatsapp-file-open?t='))
 assert.match(out.text,/https:\/\/playsistem-oficial\.playmomentsstudios\.workers\.dev\/n\//)
 assert.match(out.text,/Cartaz A4 NOV/)
})
test('keep direct links for expired file or failed WhatsApp upload, without resending accepted documents',async()=>{
 const events=[]
 const socket={sendMessage:async (_jid,msg)=>{
  events.push(msg)
  if(msg.fileName?.includes('OUT'))throw Error('upload not accepted')
  return {key:{id:'ABCDEF-VALID-MESSAGE'}}
 }}
 const fetchImpl=async urlText=>urlText===url('c')?
    response('expired',{status:410,mime:'text/plain'}):
    response(Buffer.from('safe'),{mime:'application/pdf'})
 const out=await sendAttachmentsForNotification({text:sample,supabaseUrl:root,address:'jid',socket,fetchImpl})
 assert.equal(out.attached,1)
 assert.equal(out.failed,2)
 assert.equal(events.length,3)
 assert.ok(!out.text.includes(url('a')))
 assert.ok(out.text.includes(url('b')))
 assert.ok(out.text.includes(url('c')))
 assert.match(out.text,/Acompanhe a tarefa/)
})
test('reject expired/broken media and size headers before loading the file',async()=>{
 const ref=attachmentPlan(sample,root)[0]
 await assert.rejects(()=>downloadAttachment(ref,root,async()=>response('bad',{status:410})),/link expirado/)
 await assert.rejects(()=>downloadAttachment(ref,root,async()=>response('invalid',{mime:'text/html'})),/não é um arquivo/)
 await assert.rejects(()=>downloadAttachment(ref,root,async()=>response('too large',{headers:{'content-length':'99999999'}})),/12 MB/)
})
test('send at most three files from an eight-file notification, keeping other URLs',async()=>{
 const long=Array.from({length:8},(_,i)=>'📎 *Arquivo '+i+'.pdf*\n'+root+'/functions/v1/whatsapp-file-open?t='+String(i).padStart(64,'0')).join('\n\n')
 const sent=[]
 const out=await sendAttachmentsForNotification({
   text:long,supabaseUrl:root,address:'test',
   socket:{sendMessage:async (_jid,data)=>{sent.push(data);return {key:{id:'safeid'}}}},
   fetchImpl:async()=>response('pdf',{mime:'application/pdf'})
 })
 assert.equal(out.attached,3)
 assert.equal(sent.length,3)
 assert.equal((out.text.match(/whatsapp-file-open/g)||[]).length,5)
})
