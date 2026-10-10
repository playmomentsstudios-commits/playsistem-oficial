import { corsHeaders, getDriveAccessToken, requireUser } from '../_shared/chatDriveAuth.ts';
import { assertPrivate, authorizeConversation, checked, fail, fileMetadata, thumbnail, ChatError, UUID } from '../_shared/chatDrive.ts';
Deno.serve(async(req:Request)=>{
  if(req.method==='OPTIONS')return new Response('ok',{headers:corsHeaders});
  if(req.method!=='POST')return fail(new ChatError('Method not allowed',405));
  try{
    const ctx=await requireUser(req);const body=await req.json();
    if(!UUID.test(body.message_id||''))throw new ChatError('Mensagem inválida.');
    const message=checked(await ctx.db.from('messages').select('id,conversation_id,deleted_at,attachment_drive_file_id,attachment_name,attachment_type').eq('id',body.message_id).maybeSingle());
    if(!message||message.deleted_at||!message.attachment_drive_file_id)throw new ChatError('Anexo não encontrado.',404);
    await authorizeConversation(ctx,message.conversation_id);
    if(body.mode==='thumbnail'||body.mode==='expanded')return await thumbnail(message.attachment_drive_file_id,body.mode==='expanded');
    if(!['original','download'].includes(body.mode))throw new ChatError('Modo inválido.');
    assertPrivate(await fileMetadata(message.attachment_drive_file_id));
    const token=await getDriveAccessToken();
    const response=await fetch('https://www.googleapis.com/drive/v3/files/'+encodeURIComponent(message.attachment_drive_file_id)+'?alt=media',{headers:{Authorization:'Bearer '+token}});
    if(!response.ok)throw new ChatError('Original indisponível no Drive.',502);
    const safeType=/^(audio|video)\//.test(message.attachment_type)?message.attachment_type:'application/octet-stream';
    return new Response(response.body,{headers:{...corsHeaders,'Content-Type':safeType,'Content-Disposition':"attachment; filename*=UTF-8''"+encodeURIComponent(message.attachment_name),'Cache-Control':'private, no-store','Vary':'Authorization','X-Content-Type-Options':'nosniff'}});
  }catch(error){return fail(error)}
});
