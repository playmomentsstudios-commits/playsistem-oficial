import test from 'node:test'
import assert from 'node:assert/strict'
import {readFile} from 'node:fs/promises'
import {PGlite} from '@electric-sql/pglite'
import ts from 'typescript'
const root=new URL('../',import.meta.url)
const read=path=>readFile(new URL(path,root),'utf8')

test('verified Drive ledger binds file, message, conversation, sender and metadata under RLS',async()=>{
 const db=new PGlite()
 try{
 await db.exec(`create role anon;create role authenticated;create role service_role bypassrls;
 create schema auth;create schema storage;
 create table auth.users(id uuid primary key,email text,raw_user_meta_data jsonb);
 create function auth.uid() returns uuid language sql stable as $$select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid$$;
 create table storage.buckets(id text primary key,name text,public boolean,file_size_limit bigint);
 create table storage.objects(id uuid default gen_random_uuid(),bucket_id text,name text,metadata jsonb);
 alter table storage.objects enable row level security;
 grant usage on schema auth,public,storage to anon,authenticated,service_role;
 grant execute on function auth.uid() to authenticated;
 grant select,insert,delete on storage.objects to authenticated;`)
 for(const name of ['20260925010000_create_profiles_auth','20260925040000_create_conversations','20260925050000_chat_attachments','20261010133000_chat_persistent_thumbnails','20261010150000_chat_drive_metadata','20261010150100_chat_drive_verified_uploads'])await db.exec(await read('supabase/migrations/'+name+'.sql'))
 const customer='10000000-0000-0000-0000-000000000001',other='10000000-0000-0000-0000-000000000002',admin='10000000-0000-0000-0000-000000000003';
 for(const id of [customer,other,admin])await db.query('insert into auth.users(id,email) values($1,$2)',[id,id+'@test.invalid'])
 await db.query("update profiles set role='admin' where id=$1",[admin])
 const as=async id=>{await db.exec('reset role');await db.query("select set_config('request.jwt.claim.sub',$1,false)",[id]);await db.exec('set role authenticated')}
 await as(customer)
 const conversation=(await db.query('select open_customer_conversation() id')).rows[0].id
 const message='20000000-0000-0000-0000-000000000001'
 const insert='insert into messages(id,conversation_id,sender_id,content,attachment_drive_file_id,attachment_name,attachment_type,attachment_size) values($1,$2,$3,$4,$5,$6,$7,$8)'
 const args=[message,conversation,customer,'','private-drive-file-1','big.jpg','image/jpeg',24098744]
 await assert.rejects(db.query(insert,args),/not verified/)
 // An SQL NULL path may not sneak attachment metadata through CHECK.
 await assert.rejects(db.query(insert,[...args.slice(0,4),null,...args.slice(5)]))
 await assert.rejects(db.exec('select * from chat_drive_uploads'),/permission denied/)
 await assert.rejects(db.exec('select * from chat_drive_operator_jobs'),/permission denied/)
 await db.exec('reset role')
 await db.query(`insert into chat_drive_uploads(message_id,conversation_id,sender_id,drive_file_id,drive_folder_id,file_name,mime_type,file_size,sha256) values($1,$2,$3,$4,'folder',$5,$6,$7,$8)`,[message,conversation,customer,args[4],args[5],args[6],args[7],'a'.repeat(64)])
 await as(customer);await assert.rejects(db.query(insert,args),/not verified/)
 await db.exec('reset role');await db.query('update chat_drive_uploads set verified_at=now() where message_id=$1',[message]);await as(customer)
 await assert.rejects(db.query(insert,[...args.slice(0,7),24098743]),/not verified/)
 await db.query(insert,args)
 assert.equal((await db.query('select * from messages')).rows.length,1)
 assert.equal((await db.query('select * from storage.objects')).rows.length,0)
 await assert.rejects(db.query(insert,[...args.slice(0,1),conversation,other,...args.slice(3)]))
 await as(other);assert.equal((await db.query('select * from messages')).rows.length,0)
 await as(admin);assert.equal((await db.query('select * from messages')).rows.length,1)
 await db.exec('reset role');await db.exec(await read('supabase/migrations/20261010150300_chat_drive_storage_cutover.sql'));await as(customer)
 await assert.rejects(db.query('insert into storage.objects(bucket_id,name,metadata) values($1,$2,$3)',['chat-attachments',conversation+'/'+customer+'/'+message,{size:1,mimetype:'image/jpeg'}]),/row-level security/)
 }finally{await db.close()}
})

// Execute the backend's real permission/hash/thumbnail code with deterministic Drive responses.
test('backend denies other customers, checks checksum and uses lightweight authenticated thumbnails',async()=>{
 const source=(await read('supabase/functions/_shared/chatDrive.ts')).replace(/import .* from '.\/chatDriveAuth.ts';/,'const {corsHeaders,driveJson,getDriveAccessToken}=globalThis.chatDriveFixture;')
 const js=ts.transpileModule(source,{compilerOptions:{module:ts.ModuleKind.ESNext,target:ts.ScriptTarget.ES2022}}).outputText
 let row={id:'10000000-0000-0000-0000-000000000001',customer_id:'customer',assigned_to:'staff'}
 let metadata={id:'drive',size:'24098744',sha256Checksum:'a'.repeat(64),mimeType:'image/jpeg',parents:['folder'],appProperties:{sagamenteChatMessage:'message',sagamenteChatConversation:row.id},permissions:[{role:'owner',type:'user'}],thumbnailLink:'https://lh3.googleusercontent.com/private=s220'}
 let updated=false
 globalThis.chatDriveFixture={corsHeaders:{},getDriveAccessToken:async()=> 'server-only-token',driveJson:async()=>metadata}
 const realFetch=globalThis.fetch
 let url,authorization
 globalThis.fetch=async(input,options)=>{url=String(input);authorization=options.headers.Authorization;return new Response(new Uint8Array([255,216,255,217]),{headers:{'Content-Type':'image/jpeg'}})}
 const mod=await import('data:text/javascript;base64,'+Buffer.from(js).toString('base64'))
 const chain={select(){return this},eq(){return this},maybeSingle:async()=>({data:row,error:null}),update(){updated=true;return this},then(resolve){return Promise.resolve({data:null,error:null}).then(resolve)}}
 const ctx={db:{from:()=>chain},role:'customer',userId:'customer',permissions:[]}
 try{
 await mod.authorizeConversation(ctx,row.id)
 await assert.rejects(mod.authorizeConversation({...ctx,userId:'other'},row.id),e=>e.status===403)
 await assert.rejects(mod.authorizeConversation({...ctx,role:'staff',userId:'other',permissions:['conversations.access']},row.id),e=>e.status===403)
 await mod.authorizeConversation({...ctx,role:'staff',userId:'staff',permissions:['conversations.access']},row.id)
 const upload={message_id:'message',conversation_id:row.id,sender_id:'customer',drive_file_id:'drive',drive_folder_id:'folder',sha256:'a'.repeat(64),file_size:24098744,mime_type:'image/jpeg',file_name:'big.jpg'}
 const attachment=await mod.verifyUpload(ctx,upload);assert.equal(attachment.attachment_path,null);assert.equal(updated,true)
 metadata.sha256Checksum='b'.repeat(64);await assert.rejects(mod.verifyUpload(ctx,upload),/integridade/);metadata.sha256Checksum=upload.sha256
 const response=await mod.thumbnail('drive');assert.equal(response.status,200);assert.equal((await response.arrayBuffer()).byteLength,4);assert.ok(url.endsWith('=s720'));assert.equal(authorization,'Bearer server-only-token')
 await mod.thumbnail('drive',true);assert.ok(url.endsWith('=s1600'))
 globalThis.fetch=async(input)=>{url=String(input);return url.endsWith('=s1600')?new Response(null,{headers:{'Content-Type':'image/png','Content-Length':String(4*1024*1024)}}):new Response(new Uint8Array([255,216,255,217]),{headers:{'Content-Type':'image/jpeg'}})}
 await mod.thumbnail('drive',true);assert.ok(url.endsWith('=s1024'))
 metadata.permissions.push({type:'anyone',role:'reader'});await assert.rejects(mod.thumbnail('drive'),/permissões/);metadata.permissions.pop()
 metadata.thumbnailLink='https://evil.invalid/file';await assert.rejects(mod.thumbnail('drive'),/Origem/)
 delete metadata.thumbnailLink;await assert.rejects(mod.thumbnail('drive'),e=>e.status===415)
 }finally{globalThis.fetch=realFetch;delete globalThis.chatDriveFixture}
})

test('binary image/audio/video responses are preserved, never decoded as text',async()=>{
 const source=(await read('src/lib/privateFunctionFile.ts')).replace(/import .* from '.\/supabase'/,'const {supabase,supabaseUrl,supabaseAnonKey}=globalThis.binaryFixture;')
 const js=ts.transpileModule(source,{compilerOptions:{module:ts.ModuleKind.ESNext,target:ts.ScriptTarget.ES2022}}).outputText
 globalThis.binaryFixture={supabase:{auth:{getSession:async()=>({data:{session:{access_token:'session'}},error:null})}},supabaseUrl:'https://test.invalid',supabaseAnonKey:'public-key'}
 const realFetch=globalThis.fetch
 const bytes=new Uint8Array([255,216,255,224,0,16,128,200,255,217])
 const mod=await import('data:text/javascript;base64,'+Buffer.from(js).toString('base64'))
 try{
 for(const mime of ['image/jpeg','image/png','image/webp','audio/webm','video/mp4','application/pdf']){
  globalThis.fetch=async(url,options)=>{assert.equal(options.headers.Authorization,'Bearer session');return new Response(bytes,{headers:{'Content-Type':mime}})}
  const blob=await mod.privateFunctionFile('chat-drive-media',{message_id:'message',mode:'original'})
  assert.deepEqual(new Uint8Array(await blob.arrayBuffer()),bytes)
  assert.equal(blob.type,mime)
 }
 // Reproduce the previous path: Response.text() -> new Blob destroys binary signatures.
 const corrupted=new Blob([await new Response(bytes).text()])
 assert.notDeepEqual(new Uint8Array(await corrupted.arrayBuffer()),bytes)
 assert.ok(corrupted.size>bytes.byteLength)
 globalThis.fetch=async()=>new Response(JSON.stringify({error:'Conversa não autorizada.'}),{status:403,headers:{'Content-Type':'application/json'}})
 await assert.rejects(mod.privateFunctionFile('chat-drive-media',{}),/não autorizada/)
 }finally{globalThis.fetch=realFetch;delete globalThis.binaryFixture}
})
