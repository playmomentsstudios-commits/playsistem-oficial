import { corsHeaders, driveJson, getDriveAccessToken, type RequestContext } from './chatDriveAuth.ts';
export class ChatError extends Error { constructor(message:string, public status=400){super(message)} }
export const UUID=/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
export function fail(error:unknown) {
  const message=error instanceof Error?error.message:'';
  const status=error instanceof ChatError?error.status:message==='Unauthorized'||message==='Inactive user'?401:502;
  return new Response(JSON.stringify({error:error instanceof ChatError?message:status===401?'Sessão inválida. Entre novamente.':'Falha na integração com o Drive. Tente novamente ou contate o suporte.'}),{status,headers:{...corsHeaders,'Content-Type':'application/json','Cache-Control':'private, no-store'}});
}
export function checked<T extends {error:any,data:any}>(result:T):T['data'] {if(result.error)throw new ChatError('Falha ao registrar metadados do anexo.',503);return result.data}
export async function authorizeConversation(ctx:RequestContext,id:string){
  if(!UUID.test(id))throw new ChatError('Conversa inválida.');
  const conversation=checked(await ctx.db.from('conversations').select('id,customer_id,assigned_to').eq('id',id).maybeSingle());
  const permitted=conversation&&(ctx.role==='admin'||ctx.role==='customer'&&conversation.customer_id===ctx.userId||ctx.role==='staff'&&(ctx.permissions.includes('*')||ctx.permissions.includes('conversations.view_all')||conversation.assigned_to===ctx.userId&&ctx.permissions.includes('conversations.access')));
  if(!permitted)throw new ChatError('Conversa não autorizada.',403);
  return conversation;
}
export async function generatedId(){return (await driveJson('https://www.googleapis.com/drive/v3/files/generateIds?count=1&space=drive&type=files')).ids[0] as string}
export async function fileMetadata(id:string){return driveJson('https://www.googleapis.com/drive/v3/files/'+encodeURIComponent(id)+'?fields=id,name,mimeType,size,sha256Checksum,md5Checksum,parents,appProperties,trashed,thumbnailLink,permissions(id,type,role)')}
export function assertPrivate(metadata:any){
  if(metadata.trashed||!metadata.permissions?.length||metadata.permissions.some((p:any)=>p.role!=='owner'))throw new ChatError('Anexo indisponível: permissões privadas do Drive precisam ser verificadas.',409);
}
// IDs are reserved in Postgres before creation, so concurrent retries use one folder.
export async function privateFolder(ctx:RequestContext,key:string,parent:string,name:string){
  let row=checked(await ctx.db.from('chat_drive_folders').select('*').eq('folder_key',key).maybeSingle());
  if(!row){
    const result=await ctx.db.from('chat_drive_folders').insert({folder_key:key,drive_folder_id:await generatedId()}).select().single();
    if(result.error&&result.error.code!=='23505')checked(result);
    row=result.data||checked(await ctx.db.from('chat_drive_folders').select('*').eq('folder_key',key).single());
  }
  const token=await getDriveAccessToken();
  const response=await fetch('https://www.googleapis.com/drive/v3/files?fields=id',{method:'POST',headers:{Authorization:'Bearer '+token,'Content-Type':'application/json'},body:JSON.stringify({id:row.drive_folder_id,name,mimeType:'application/vnd.google-apps.folder',parents:[parent],appProperties:{sagamenteChatFolder:key}})});
  if(!response.ok&&response.status!==409)throw new ChatError('Não foi possível criar a pasta privada no Drive.',502);
  const metadata=await fileMetadata(row.drive_folder_id);assertPrivate(metadata);
  if(!metadata.parents?.includes(parent==='root'?metadata.parents[0]:parent)||metadata.appProperties?.sagamenteChatFolder!==key)throw new ChatError('Pasta do chat inválida.',409);
  return row.drive_folder_id as string;
}
export async function conversationFolder(ctx:RequestContext,id:string){
  const root=await privateFolder(ctx,'root','root','SAGAMENTE - CONVERSAS PRIVADAS');
  return privateFolder(ctx,id,root,'CONVERSA - '+id);
}
export function validateUpload(body:any){
  if(!UUID.test(body.message_id||'')||!UUID.test(body.conversation_id||''))throw new ChatError('Identificador inválido.');
  if(typeof body.name!=='string'||body.name.length<1||body.name.length>255||typeof body.type!=='string'||!/^[-\w.+]+\/[-\w.+]+(?:;[^\r\n]*)?$/.test(body.type)||body.type.length>255||!Number.isSafeInteger(body.size)||body.size<1||body.size>52428800||!/^([a-f0-9]{64})$/.test(body.sha256||''))throw new ChatError('Arquivo inválido. Limite: 50 MB.');
}
export async function reserveUpload(ctx:RequestContext,body:any,senderId=ctx.userId){
  validateUpload(body);
  let row=checked(await ctx.db.from('chat_drive_uploads').select('*').eq('message_id',body.message_id).maybeSingle());
  if(!row){
    const folder=await conversationFolder(ctx,body.conversation_id);
    const result=await ctx.db.from('chat_drive_uploads').insert({message_id:body.message_id,conversation_id:body.conversation_id,sender_id:senderId,drive_file_id:await generatedId(),drive_folder_id:folder,file_name:body.name,mime_type:body.type,file_size:body.size,sha256:body.sha256}).select().single();
    if(result.error&&result.error.code!=='23505')checked(result);
    row=result.data||checked(await ctx.db.from('chat_drive_uploads').select('*').eq('message_id',body.message_id).single());
  }
  if(row.sender_id!==senderId||row.conversation_id!==body.conversation_id||row.file_name!==body.name||row.mime_type!==body.type||Number(row.file_size)!==body.size||row.sha256!==body.sha256)throw new ChatError('Esta tentativa pertence a outro arquivo. Selecione o arquivo novamente.',409);
  return row;
}
export async function beginUpload(ctx:RequestContext,row:any){
  const token=await getDriveAccessToken();
  // Create one immutable ID before opening resumable sessions. A lost response cannot duplicate it.
  const created=await fetch('https://www.googleapis.com/drive/v3/files?fields=id',{method:'POST',headers:{Authorization:'Bearer '+token,'Content-Type':'application/json'},body:JSON.stringify({id:row.drive_file_id,name:row.file_name,mimeType:row.mime_type.split(';')[0],parents:[row.drive_folder_id],appProperties:{sagamenteChatMessage:row.message_id,sagamenteChatConversation:row.conversation_id}})});
  if(!created.ok&&created.status!==409)throw new ChatError('Falha ao reservar arquivo no Drive.',502);
  assertPrivate(await fileMetadata(row.drive_file_id));
  const response=await fetch('https://www.googleapis.com/upload/drive/v3/files/'+encodeURIComponent(row.drive_file_id)+'?uploadType=resumable&fields=id',{method:'PATCH',headers:{Authorization:'Bearer '+token,'Content-Type':'application/json','X-Upload-Content-Type':row.mime_type.split(';')[0],'X-Upload-Content-Length':String(row.file_size)},body:'{}'});
  const location=response.headers.get('location');
  if(!response.ok||!location||new URL(location).origin!=='https://www.googleapis.com')throw new ChatError('Falha ao iniciar envio no Drive.',502);
  return location;
}
export async function verifyUpload(ctx:RequestContext,row:any){
  const metadata=await fileMetadata(row.drive_file_id);assertPrivate(metadata);
  if(Number(metadata.size)!==Number(row.file_size)||metadata.sha256Checksum!==row.sha256||metadata.mimeType!==row.mime_type.split(';')[0]||!metadata.parents?.includes(row.drive_folder_id)||metadata.appProperties?.sagamenteChatMessage!==row.message_id||metadata.appProperties?.sagamenteChatConversation!==row.conversation_id)throw new ChatError('Upload incompleto ou integridade divergente. Reenvie o original.',409);
  checked(await ctx.db.from('chat_drive_uploads').update({verified_at:new Date().toISOString()}).eq('message_id',row.message_id));
  return {attachment_drive_file_id:row.drive_file_id,attachment_path:null,attachment_preview_path:null,attachment_name:row.file_name,attachment_type:row.mime_type,attachment_size:Number(row.file_size)};
}
export async function thumbnail(id:string,expanded=false){
  const token=await getDriveAccessToken();
  const metadata=await fileMetadata(id);assertPrivate(metadata);
  if(!metadata.thumbnailLink)throw new ChatError('Miniatura ainda indisponível, ou arquivo corrompido/incompatível. Tente novamente ou baixe o original.',415);
  const url=new URL(metadata.thumbnailLink);
  if(url.protocol!=='https:'||!(url.hostname==='drive.google.com'||url.hostname==='googleusercontent.com'||url.hostname.endsWith('.googleusercontent.com')))throw new ChatError('Origem da miniatura inválida.',502);
  // A noisy PNG can exceed 3 MB even at 1600px. Reduce resolution a bounded
  // number of times instead of falling back to its heavy original.
  for(const width of expanded?[1600,1024,720]:[720,480]){
    const sized=new URL(url.href.replace(/=s\d+(?:-[a-z]+)?$/,'=s'+width));
    const response=await fetch(sized,{headers:{Authorization:'Bearer '+token}});
    const type=response.headers.get('content-type')||'';
    if(!response.ok||!/^image\/(jpeg|png|webp|gif)(?:;|$)/i.test(type))throw new ChatError('Drive não conseguiu gerar a miniatura deste arquivo.',415);
    if(Number(response.headers.get('content-length')||0)>3*1024*1024){await response.body?.cancel();continue}
    const bytes=await response.arrayBuffer();
    if(bytes.byteLength>3*1024*1024)continue;
    return new Response(bytes,{headers:{...corsHeaders,'Content-Type':type,'Content-Length':String(bytes.byteLength),'Cache-Control':'private, no-store','Vary':'Authorization','X-Content-Type-Options':'nosniff'}});
  }
  throw new ChatError('Drive não conseguiu gerar uma miniatura leve. Baixe o original.',413);
}
