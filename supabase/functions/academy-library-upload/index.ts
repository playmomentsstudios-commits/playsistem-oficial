import {corsHeaders,ensureAcademyLibraryFolder,getDriveAccessToken,json,requireUser} from '../_shared/googleDrive.ts'

/** Admin-only upload. The original remains private in the institutional Drive. */
Deno.serve(async request=>{
 if(request.method==='OPTIONS')return new Response('ok',{headers:corsHeaders})
 if(request.method!=='POST')return json({ok:false,error:'Method not allowed'},405)
 try{
  const ctx=await requireUser(request)
  if(ctx.role!=='admin')return json({ok:false,error:'Admin access required'},403)
  const data=await request.json()
  const action=String(data.action||'start')
  const releaseCode=String(data.release_code||'').trim()
  const format=String(data.format||'')
  const name=String(data.file_name||'').trim()
  const size=Number(data.file_size)
  const expectedType=format==='ebook'?'application/pdf':format==='audiobook'?'audio/mpeg':null
  if(!/^[a-zA-Z0-9_-]{1,80}$/.test(releaseCode)||!expectedType){
    return json({ok:false,error:'Código ou formato inválido'},400)
  }
  if(!name||name.length>180||/[\\/]/.test(name)||
    !(format==='ebook'?/\.pdf$/i.test(name):/\.mp3$/i.test(name))||
    !Number.isSafeInteger(size)||size<=0||size>350*1024*1024){
    return json({ok:false,error:'Selecione um PDF ou MP3 de até 350 MB'},400)
  }
  const folder=await ensureAcademyLibraryFolder(ctx.db,ctx.userId,releaseCode)
  const token=await getDriveAccessToken()
  const auth={Authorization:'Bearer '+token}
  if(action==='confirm'){
    const id=String(data.drive_file_id||'')
    if(!/^[a-zA-Z0-9_-]{12,100}$/.test(id))return json({ok:false,error:'Arquivo inválido'},400)
    const response=await fetch('https://www.googleapis.com/drive/v3/files/'+encodeURIComponent(id)+'?fields=id,name,mimeType,size,parents,trashed,appProperties',
      {headers:auth,signal:AbortSignal.timeout(15000)})
    if(!response.ok)return json({ok:false,error:'O arquivo não foi encontrado no Drive'},400)
    const file=await response.json()
    if(file.trashed||file.name!==name||Number(file.size)!==size||
      !Array.isArray(file.parents)||!file.parents.includes(folder.folderId)||
      file.appProperties?.playMomentsKind!=='academy-library-private'||
      file.appProperties?.playMomentsEntityId!==releaseCode||
      file.mimeType!==expectedType){
       return json({ok:false,error:'O arquivo não pertence à pasta ou ao formato selecionado'},400)
    }
    return json({ok:true,file:{id:file.id,name:file.name,size:file.size,mimeType:file.mimeType}})
  }
  if(action!=='start')return json({ok:false,error:'Operação desconhecida'},400)
  const upload=await fetch('https://www.googleapis.com/upload/drive/v3/files?uploadType=resumable&fields=id,name,size,mimeType',
   {method:'POST',headers:{...auth,'Content-Type':'application/json; charset=UTF-8',
      'X-Upload-Content-Type':expectedType,'X-Upload-Content-Length':String(size)},
    body:JSON.stringify({name,mimeType:expectedType,parents:[folder.folderId],
      appProperties:{playMomentsKind:'academy-library-private',playMomentsEntityId:releaseCode}}),
    signal:AbortSignal.timeout(15000)})
  if(!upload.ok)throw new Error('Google Drive não iniciou o upload ('+upload.status+').')
  const uploadUrl=upload.headers.get('Location')
  if(!uploadUrl)throw new Error('Google Drive não retornou sessão de upload')
  return json({ok:true,upload_url:uploadUrl})
 }catch(error){
  console.error('academy-library-upload:',error instanceof Error?error.message:'unknown')
  return json({ok:false,error:'Não foi possível concluir a operação no Google Drive.'},500)
 }
})
