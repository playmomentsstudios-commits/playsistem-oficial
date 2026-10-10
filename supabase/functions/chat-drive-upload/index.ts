import { corsHeaders, json, requireUser } from '../_shared/chatDriveAuth.ts';
import { authorizeConversation, beginUpload, checked, fail, reserveUpload, verifyUpload, fileMetadata, ChatError } from '../_shared/chatDrive.ts';
Deno.serve(async(req:Request)=>{
  if(req.method==='OPTIONS')return new Response('ok',{headers:corsHeaders});
  if(req.method!=='POST')return fail(new ChatError('Method not allowed',405));
  try{
    const ctx=await requireUser(req);const body=await req.json();
    await authorizeConversation(ctx,String(body.conversation_id||''));
    const row=await reserveUpload(ctx,body);
    if(body.action==='finalize'||row.verified_at)return json({attachment:await verifyUpload(ctx,row)});
    // Recover a lost successful upload response before reopening any session.
    if(row.upload_url&&row.upload_url!=='pending'){
      const metadata=await fileMetadata(row.drive_file_id);
      if(metadata.sha256Checksum===row.sha256)return json({attachment:await verifyUpload(ctx,row)});
    }
    if(row.upload_url==='pending'&&Date.now()-new Date(row.session_created_at).getTime()<60000)throw new ChatError('Envio está sendo preparado. Tente novamente em alguns segundos.',409);
    let uploadUrl=row.upload_url==='pending'?null:row.upload_url;
    let nextOffset=0;
    if(uploadUrl&&Date.now()-new Date(row.session_created_at).getTime()<6*24*3600000){
      const status=await fetch(uploadUrl,{method:'PUT',headers:{'Content-Length':'0','Content-Range':'bytes */'+row.file_size}});
      if(status.status===308){
        const match=status.headers.get('Range')?.match(/bytes=0-(\d+)/);
        nextOffset=match?Number(match[1])+1:0;
      }else if(status.ok)return json({attachment:await verifyUpload(ctx,row)});
      else if(status.status===404||status.status===410)uploadUrl=null;
      else throw new ChatError('Não foi possível recuperar o envio no Drive. Código '+status.status+'.',502);
    }else uploadUrl=null;
    if(!uploadUrl){
      // Atomic session reservation: concurrent tabs must not get independent
      // write capabilities for the same original after one has been finalized.
      let claim=ctx.db.from('chat_drive_uploads').update({upload_url:'pending',session_created_at:new Date().toISOString()}).eq('message_id',row.message_id).is('verified_at',null);
      claim=row.upload_url?claim.eq('upload_url',row.upload_url):claim.is('upload_url',null);
      const reserved=checked(await claim.select('message_id').maybeSingle());
      if(!reserved)throw new ChatError('Outro envio desta mensagem está em andamento. Tente novamente.',409);
      try{uploadUrl=await beginUpload(ctx,row)}catch(error){
        await ctx.db.from('chat_drive_uploads').update({upload_url:null}).eq('message_id',row.message_id).eq('upload_url','pending');
        throw error;
      }
      checked(await ctx.db.from('chat_drive_uploads').update({upload_url:uploadUrl,session_created_at:new Date().toISOString()}).eq('message_id',row.message_id));
    }
    return new Response(JSON.stringify({upload_url:uploadUrl,next_offset:nextOffset}),{headers:{...corsHeaders,'Content-Type':'application/json','Cache-Control':'private, no-store'}});
  }catch(error){return fail(error)}
});
