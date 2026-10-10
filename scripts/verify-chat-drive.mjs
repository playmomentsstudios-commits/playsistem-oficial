// Real integration checks using disposable, operator-provisioned test accounts.
// Never use customer credentials. Credentials and media paths stay outside the repo.
import assert from 'node:assert/strict'
import {readFile,writeFile} from 'node:fs/promises'
import {createClient} from '@supabase/supabase-js'
import ts from 'typescript'
import {createHash,randomUUID} from 'node:crypto'
const credentials=JSON.parse(await readFile(process.env.CHAT_DRIVE_TEST_CREDENTIALS,'utf8'))
const info=await readFile(new URL('../utils/supabase/info.tsx',import.meta.url),'utf8')
const project=info.match(/projectId\s*=\s*["']([^"']+)/)[1]
const key=info.match(/publicAnonKey\s*=\s*["']([^"']+)/)[1]
const url='https://'+project+'.supabase.co'
const root=new URL('../',import.meta.url)
const compile=source=>'data:text/javascript;base64,'+Buffer.from(ts.transpileModule(source,{compilerOptions:{module:ts.ModuleKind.ESNext,target:ts.ScriptTarget.ES2022}}).outputText).toString('base64')
const attachments=await import(compile(await readFile(new URL('src/lib/attachments.ts',root),'utf8')))
const clients=[];const apis=[];const sessions=[]
for(const user of credentials.users){
 console.log('Signing in disposable '+user.role)
 const supabase=createClient(url,key,{auth:{persistSession:false,autoRefreshToken:false},global:{fetch:(input,init)=>fetch(input,{...init,signal:init?.signal||AbortSignal.timeout(60000)})}})
 const {data,error}=await supabase.auth.signInWithPassword({email:user.email,password:credentials.password});if(error)throw error
 sessions.push(data.session);clients.push(supabase)
 globalThis.integrationFile={supabase,supabaseUrl:url,supabaseAnonKey:key}
 const source=(await readFile(new URL('src/lib/privateFunctionFile.ts',root),'utf8')).replace(/^import .*$/m,'const {supabase,supabaseUrl,supabaseAnonKey}=globalThis.integrationFile;')+'\n//'+user.id
 const {privateFunctionFile}=await import(compile(source))
 globalThis.integrationApi={supabase,privateFunctionFile,...attachments}
 const apiSource=(await readFile(new URL('src/api/conversations.ts',root),'utf8')).replace(/^import .*$/gm,'')+'\n//'+user.id
 const mod=await import(compile('const {supabase,privateFunctionFile,attachmentMime,validateAttachment}=globalThis.integrationApi;\n'+apiSource))
 apis.push(mod.conversationsApi)
}
const conversation=await apis[0].open();const otherConversation=await apis[1].open()
const results=[];const messages=[]
const hash=bytes=>createHash('sha256').update(bytes).digest('hex')
const cases=process.env.CHAT_DRIVE_EXTRA_ONLY?[['video','/tmp/chat-test-video.mp4','video/mp4'],['document','/tmp/chat-test-document.txt','text/plain']]:[['small-image','/tmp/chat-test-small.jpg','image/jpeg'],['large-image','/tmp/chat-test-large.png','image/png'],['audio','/tmp/chat-test-audio.wav','audio/wav'],['pdf','/tmp/chat-test.pdf','application/pdf']]
for(const actor of [0,2]){
 for(const [label,path,type] of cases){
  const bytes=await readFile(path);const file=new File([bytes],path.split('/').pop(),{type});const id=randomUUID()
  console.log('Starting '+credentials.users[actor].role+' '+label)
  const before=Date.now()
  const attachment=await apis[actor].upload(conversation,credentials.users[actor].id,id,file)
  assert.equal(attachment.attachment_path,null);assert.ok(attachment.attachment_drive_file_id)
  // Same pending upload, including lost responses, must return the same Drive file.
  const retry=await apis[actor].upload(conversation,credentials.users[actor].id,id,file)
  assert.equal(retry.attachment_drive_file_id,attachment.attachment_drive_file_id)
  const message=await apis[actor].send(conversation,credentials.users[actor].id,'',id,attachment)
  messages.push(message)
  const repeat=await apis[actor].send(conversation,credentials.users[actor].id,'',id,attachment);assert.equal(repeat.id,message.id)
  for(const reader of [0,2]){
   const blobUrl=await apis[reader].mediaUrl(message,'download')
   const downloaded=await (await fetch(blobUrl)).arrayBuffer();URL.revokeObjectURL(blobUrl)
   assert.equal(hash(new Uint8Array(downloaded)),hash(bytes))
  }
  if(type.startsWith('image/')){
   // Google may finish thumbnail processing shortly after upload. Three bounded attempts.
   for(const mode of ['thumbnail','expanded']){
    let blobUrl
    for(let attempt=0;attempt<3;attempt++){
     try{blobUrl=await apis[0].mediaUrl(message,mode);break}catch(error){if(attempt===2)throw error;await new Promise(resolve=>setTimeout(resolve,2000))}
    }
    const blob=await (await fetch(blobUrl)).blob();URL.revokeObjectURL(blobUrl)
    assert.ok(blob.size>0&&blob.size<=3*1024*1024);assert.ok(blob.type.startsWith('image/'))
    await writeFile('/tmp/chat-'+label+'-'+mode+'.bin',Buffer.from(await blob.arrayBuffer()))
   }
  }
  await assert.rejects(apis[1].mediaUrl(message,'download'),/não autorizada/)
  const unauthorized=await clients[1].from('messages').select('id').eq('id',id);assert.equal(unauthorized.data.length,0)
  results.push({actor:credentials.users[actor].role,label,bytes:bytes.byteLength,drive_file_id:attachment.attachment_drive_file_id,message_id:id,duration_ms:Date.now()-before,status:'passed'})
  console.log(JSON.stringify(results.at(-1)))
 }
}
const reloaded=await apis[0].messages(conversation);assert.ok(messages.every(message=>reloaded.some(row=>row.id===message.id)))
assert.equal((await apis[1].messages(otherConversation)).length,0)
// Old Storage upload is retained until the explicit cutover. Assert new uploads created no objects.
for(const message of messages){
 const {data}=await clients[0].storage.from('chat-attachments').info(conversation+'/'+message.sender_id+'/'+message.id)
 assert.equal(data,null)
}
await writeFile(process.env.CHAT_DRIVE_RESULT_PATH||'/tmp/chat-drive-integration-results.json',JSON.stringify({conversation,otherConversation,results,messages:messages.map(m=>m.id),sessions,users:credentials.users},null,2))
console.log('PASS: '+results.length+' real uploads, binary downloads, available media previews, duplicate retries, reload and cross-customer denial.')
for(const client of clients)await client.auth.signOut()
