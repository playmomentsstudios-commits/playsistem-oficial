import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.117.1';
import { corsHeaders, getDriveAccessToken, json, requireUser, type RequestContext } from '../_shared/chatDriveAuth.ts';
import { beginUpload, checked, fail, reserveUpload, generatedId, thumbnail, verifyUpload, ChatError, UUID } from '../_shared/chatDrive.ts';
const hex=(bytes:ArrayBuffer)=>Array.from(new Uint8Array(bytes),v=>v.toString(16).padStart(2,'0')).join('');
const sha=async(bytes:ArrayBuffer)=>hex(await crypto.subtle.digest('SHA-256',bytes));
// Operator jobs are single-purpose, short-lived, server-only capabilities. They never
// grant user access or accept arbitrary Drive IDs, URLs, SQL, or storage paths.
async function operatorJob(body:any):Promise<{ctx:RequestContext,job:any}> {
  if(!UUID.test(body.job_id||'')||!/^[a-f0-9]{64}$/.test(body.job_token||''))throw new ChatError('Unauthorized',401);
  const db=createClient(Deno.env.get('SUPABASE_URL')!,Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,{auth:{persistSession:false}});
  const digest=await sha(new TextEncoder().encode(body.job_token).buffer);
  const job=checked(await db.from('chat_drive_operator_jobs').update({status:'running'}).eq('id',body.job_id).eq('token_sha256',digest).eq('status','queued').gt('expires_at',new Date().toISOString()).select().maybeSingle());
  if(!job)throw new ChatError('Unauthorized',401);
  return {ctx:{db,userId:'operator',role:'operator',permissions:[]},job};
}
function validImageHeader(bytes:ArrayBuffer,type:string){
 const b=new Uint8Array(bytes);const mime=type.split(';')[0];
 if(mime==='image/jpeg')return b[0]===255&&b[1]===216&&b[2]===255;
 if(mime==='image/png')return [137,80,78,71,13,10,26,10].every((v,i)=>b[i]===v);
 if(mime==='image/webp')return new TextDecoder().decode(b.slice(0,4))==='RIFF'&&new TextDecoder().decode(b.slice(8,12))==='WEBP';
 return true;
}
async function recoverTextDecodedImage(ctx:RequestContext,message:any,legacyHash:string){
 // Recovery is allowed only if reproducing the old UTF-8 conversion yields the
 // EXACT stored SHA-256. Filename similarity alone never authorizes replacement.
 const candidates=checked(await ctx.db.from('client_files').select('id,drive_file_id,mime_type').eq('name',message.attachment_name).eq('storage_provider','google_drive').limit(20));
 const token=await getDriveAccessToken();
 for(const candidate of candidates||[]){
  if(!candidate.drive_file_id)continue;
  const response=await fetch('https://www.googleapis.com/drive/v3/files/'+encodeURIComponent(candidate.drive_file_id)+'?alt=media',{headers:{Authorization:'Bearer '+token}});
  if(!response.ok)continue;
  const original=await response.arrayBuffer();
  if(original.byteLength>52428800||!validImageHeader(original,message.attachment_type))continue;
  const damaged=new TextEncoder().encode(new TextDecoder().decode(original));
  if(await sha(damaged.buffer)===legacyHash)return {bytes:original,source:candidate.drive_file_id};
 }
 return null;
}
export async function migrateMessage(ctx:RequestContext,messageId:string){
  const message=checked(await ctx.db.from('messages').select('*').eq('id',messageId).single());
  if(!message.attachment_path){
    const previous=checked(await ctx.db.from('chat_drive_migration_results').select('*').eq('message_id',messageId).maybeSingle());
    return previous||{status:'missing',error:'Mensagem não possui objeto legado.'};
  }
  const result:any={message_id:message.id,legacy_path:message.attachment_path,status:'pending',original_bytes:message.attachment_size,updated_at:new Date().toISOString()};
  checked(await ctx.db.from('chat_drive_migration_results').upsert(result));
  try{
    const object=await ctx.db.storage.from('chat-attachments').download(message.attachment_path);
    if(object.error||!object.data){result.status='missing';throw new ChatError('Objeto legado não pode ser lido.',404)}
    let bytes=await object.data.arrayBuffer();
    if(bytes.byteLength!==Number(message.attachment_size)){result.status='corrupt';throw new ChatError('Tamanho do original diverge dos metadados.',409)}
    result.sha256=await sha(bytes);
    result.legacy_sha256=result.sha256;
    if(message.attachment_type.startsWith('image/')&&!validImageHeader(bytes,message.attachment_type)){
      result.status='corrupt';
      const recovery=await recoverTextDecodedImage(ctx,message,result.sha256);
      if(!recovery)throw new ChatError('Original foi corrompido por conversão UTF-8. Cópia íntegra não encontrada; é necessário reenviar o arquivo original.',415);
      bytes=recovery.bytes;result.sha256=await sha(bytes);result.source_kind='verified_project_original';result.source_drive_file_id=recovery.source;result.restored_bytes=bytes.byteLength;result.status='pending';
      const previous=checked(await ctx.db.from('chat_drive_uploads').select('*').eq('message_id',message.id).maybeSingle());
      if(previous&&previous.sha256!==result.sha256){
        result.archived_drive_file_id=previous.drive_file_id;
        checked(await ctx.db.from('chat_drive_uploads').update({drive_file_id:await generatedId(),file_size:bytes.byteLength,sha256:result.sha256,verified_at:null,upload_url:null,session_created_at:null}).eq('message_id',message.id).eq('sha256',previous.sha256).select().single());
      }
    }
    const body={message_id:message.id,conversation_id:message.conversation_id,name:message.attachment_name,type:message.attachment_type,size:bytes.byteLength,sha256:result.sha256};
    const row=await reserveUpload(ctx,body,message.sender_id);result.drive_file_id=row.drive_file_id;
    if(!row.verified_at){
      const location=await beginUpload(ctx,row);
      const sent=await fetch(location,{method:'PUT',headers:{'Content-Type':message.attachment_type.split(';')[0]},body:bytes});
      if(!sent.ok)throw new ChatError('Falha ao copiar o original para o Drive.',502);
    }
    const attachment=await verifyUpload(ctx,row);
    const token=await getDriveAccessToken();
    const read=await fetch('https://www.googleapis.com/drive/v3/files/'+encodeURIComponent(row.drive_file_id)+'?alt=media',{headers:{Authorization:'Bearer '+token}});
    if(!read.ok)throw new ChatError('Cópia não pode ser lida no Drive.',502);
    const copy=await read.arrayBuffer();
    if(copy.byteLength!==bytes.byteLength||await sha(copy)!==result.sha256){result.status='corrupt';throw new ChatError('Hash da cópia diverge do original.',409)}
    if(message.attachment_type.startsWith('image/')){
      await thumbnail(row.drive_file_id);result.preview_status='validated';
    }else result.preview_status='original_read_validated';
    checked(await ctx.db.from('messages').update(attachment).eq('id',message.id).eq('attachment_path',message.attachment_path).select('id').single());
    result.status='migrated';result.error=null;
  }catch(error){
    if(result.status==='pending')result.status='failed';
    result.error=error instanceof ChatError?error.message:'Falha no Drive ou no registro da migração. Original preservado.';
  }
  checked(await ctx.db.from('chat_drive_migration_results').upsert({...result,updated_at:new Date().toISOString()}));
  return result;
}
Deno.serve(async(req:Request)=>{
  if(req.method==='OPTIONS')return new Response('ok',{headers:corsHeaders});
  if(req.method!=='POST')return fail(new ChatError('Method not allowed',405));
  let job:any;let ctx:RequestContext|undefined;
  try{
    const body=await req.json();
    let messageId=body.message_id;
    if(body.job_id){const operator=await operatorJob(body);ctx=operator.ctx;job=operator.job;messageId=job.message_id}
    else {ctx=await requireUser(req);if(ctx.role!=='admin')throw new ChatError('Admin required',403)}
    if(!UUID.test(messageId||''))throw new ChatError('Mensagem inválida.');
    const result=await migrateMessage(ctx!,messageId);
    if(job)checked(await ctx!.db.from('chat_drive_operator_jobs').update({status:'finished',result}).eq('id',job.id));
    return json(result);
  }catch(error){
    if(job&&ctx)await ctx.db.from('chat_drive_operator_jobs').update({status:'failed',result:{error:'Falha ao executar migração. Original preservado.'}}).eq('id',job.id);
    return fail(error);
  }
});
