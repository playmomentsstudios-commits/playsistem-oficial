import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

/** SAGA NEGRA beta library: authenticated ticket issue, revocable per-user reads. */
const cors={
  'Access-Control-Allow-Origin':'*',
  'Access-Control-Allow-Headers':'authorization,apikey,x-client-info,content-type,range',
  'Access-Control-Allow-Methods':'GET,HEAD,POST,OPTIONS',
  'Access-Control-Expose-Headers':'Content-Range,Content-Length,Accept-Ranges,Content-Type'
}
const uuid=/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
const env=(key:string)=>{const value=Deno.env.get(key);if(!value)throw Error('Missing server configuration');return value}
const reply=(value:unknown,status=200)=>{
  const stage=typeof value==='object'&&value!==null&&'stage' in value?String((value as {stage?:string}).stage||''):''
  const out:Record<string,string>={...cors,'Content-Type':'application/json','Cache-Control':'no-store','Access-Control-Expose-Headers':'Content-Type,Content-Length,Content-Range,Accept-Ranges,X-Academy-Media-Stage'}
  if(/^[a-z_]{1,40}$/.test(stage))out['X-Academy-Media-Stage']=stage
  return new Response(JSON.stringify(value),{status,headers:out})
}
const headers=()=>new Headers({...cors,'Accept-Ranges':'bytes','Cache-Control':'private, no-store, max-age=0','X-Content-Type-Options':'nosniff','Referrer-Policy':'no-referrer'})

function parseRange(value:string,size:number){
  const found=/^bytes=(\d*)-(\d*)$/.exec(value.trim())
  if(!found||(found[1]===''&&found[2]===''))throw Error('range')
  let start:number;let end:number
  if(found[1]===''){
    const count=Number(found[2])
    if(!Number.isSafeInteger(count)||count<=0)throw Error('range')
    start=Math.max(0,size-count);end=size-1
  }else{
    start=Number(found[1]);end=found[2]?Number(found[2]):size-1
    if(!Number.isSafeInteger(start)||!Number.isSafeInteger(end)||start<0||end<start||start>=size)throw Error('range')
    end=Math.min(size-1,end)
  }
  return {start,end}
}
async function driveToken(){
  const form=new URLSearchParams({
    client_id:env('GOOGLE_DRIVE_CLIENT_ID'),
    client_secret:env('GOOGLE_DRIVE_CLIENT_SECRET'),
    refresh_token:env('GOOGLE_DRIVE_REFRESH_TOKEN'),
    grant_type:'refresh_token'
  })
  const response=await fetch('https://oauth2.googleapis.com/token',{method:'POST',headers:{'Content-Type':'application/x-www-form-urlencoded'},body:form,signal:AbortSignal.timeout(10000)})
  if(!response.ok)throw Error('Drive connection unavailable')
  const data=await response.json()
  if(!data?.access_token)throw Error('Drive connection unavailable')
  return String(data.access_token)
}
function dbClient(){
  return createClient(env('SUPABASE_URL'),env('SUPABASE_SERVICE_ROLE_KEY'),{auth:{persistSession:false,autoRefreshToken:false}})
}
async function authorizedItem(db:any,userId:string,itemId:string){
  const [{data:item,error:itemError},{data:grant,error:grantError},{data:profile,error:profileError}]=await Promise.all([
    db.from('academy_library_items').select('id,drive_file_id,mime_type,status').eq('id',itemId).maybeSingle(),
    db.from('academy_library_grants').select('id').eq('item_id',itemId).eq('user_id',userId).eq('active',true).maybeSingle(),
    db.from('profiles').select('id').eq('id',userId).eq('status','active').maybeSingle()
  ])
  if(itemError||grantError||profileError||!item||!grant||!profile||!['private_beta','published'].includes(item.status))return null
  if(!['audio/mpeg','application/pdf'].includes(item.mime_type))return null
  return item
}


/**
 * Transitional Drive read path for pre-existing files shared with "anyone with link".
 * The caller has already passed ticket, active grant and active profile validation.
 * File IDs and Google links NEVER leave the function; this does not change sharing.
 * Prefer the OAuth Drive API; use this only if it answers 404 for an existing item.
 * Once the institutional OAuth token can read these files, remove this fallback.
 */
async function serveAlreadySharedDrive(request:Request,driveFileId:string,mimeType:string){
  const sourceUrl='https://drive.usercontent.google.com/download?id='+encodeURIComponent(driveFileId)+'&export=download&confirm=t'
  const fail=(stage:string)=>reply({error:'Media source unavailable',stage},502)
  const probe=await fetch(sourceUrl,{
    headers:{Range:'bytes=0-31'},
    signal:AbortSignal.timeout(15000)
  })
  if(probe.status!==206)return fail('drive_shared_source')
  const ct=String(probe.headers.get('Content-Type')||'').split(';')[0].toLowerCase()
  if(![mimeType,'application/octet-stream'].includes(ct))return fail('drive_shared_mime')
  const contentRange=String(probe.headers.get('Content-Range')||'')
  const match=/^bytes 0-31\/(\d+)$/.exec(contentRange)
  if(!match)return fail('drive_shared_range')
  const size=Number(match[1])
  if(!Number.isSafeInteger(size)||size<32||size>300*1024*1024)return fail('drive_shared_size')
  const signature=new Uint8Array(await probe.arrayBuffer())
  if(signature.length!==32)return fail('drive_shared_range')
  const pdf=signature[0]===37&&signature[1]===80&&signature[2]===68&&signature[3]===70&&signature[4]===45
  const mp3=(signature[0]===73&&signature[1]===68&&signature[2]===51)
    ||(signature[0]===255&&(signature[1]&224)===224)
  if(mimeType==='application/pdf'&&!pdf)return fail('drive_shared_mime')
  if(mimeType==='audio/mpeg'&&!mp3&&ct!=='audio/mpeg')return fail('drive_shared_mime')
  const out=headers()
  out.set('Content-Type',mimeType)
  out.set('Content-Disposition','inline')
  out.set('Accept-Ranges','bytes')
  if(request.method==='HEAD'){
    out.set('Content-Length',String(size))
    return new Response(null,{status:200,headers:out})
  }
  const requested=request.headers.get('Range')
  let range:{start:number,end:number}|null=null
  if(requested){
    try{range=parseRange(requested,size)}catch{
      out.set('Content-Range','bytes */'+size)
      return new Response(null,{status:416,headers:out})
    }
  }
  const upstream=await fetch(sourceUrl,{
    headers:range?{Range:'bytes='+range.start+'-'+range.end}:{},
    signal:AbortSignal.timeout(45000)
  })
  const gotType=String(upstream.headers.get('Content-Type')||'').split(';')[0].toLowerCase()
  if(![mimeType,'application/octet-stream'].includes(gotType)||!upstream.body)return fail('drive_shared_mime')
  if(range){
    const expected='bytes '+range.start+'-'+range.end+'/'+size
    const length=range.end-range.start+1
    if(upstream.status!==206||upstream.headers.get('Content-Range')!==expected
      ||Number(upstream.headers.get('Content-Length'))!==length)return fail('drive_shared_range')
    out.set('Content-Range',expected)
    out.set('Content-Length',String(length))
    return new Response(upstream.body,{status:206,headers:out})
  }
  if(upstream.status!==200)return fail('drive_shared_source')
  const providedLength=upstream.headers.get('Content-Length')
  if(providedLength&&Number(providedLength)!==size)return fail('drive_shared_size')
  out.set('Content-Length',String(size))
  return new Response(upstream.body,{status:200,headers:out})
}

Deno.serve(async(request:Request)=>{
  if(request.method==='OPTIONS')return new Response('ok',{headers:cors})
  if(!['GET','HEAD','POST'].includes(request.method))return reply({error:'Method not allowed'},405)
  try{
    const db=dbClient();const url=new URL(request.url)
    if(request.method==='POST'){
      const bearer=(request.headers.get('authorization')||'').replace(/^Bearer\s+/i,'')
      if(!bearer)return reply({error:'Login required'},401)
      const {data:auth,error:authError}=await db.auth.getUser(bearer)
      if(authError||!auth.user)return reply({error:'Login required'},401)
      const body=await request.json().catch(()=>({}))
      const itemId=String(body.item_id||'')
      if(!uuid.test(itemId))return reply({error:'Invalid item'},400)
      const item=await authorizedItem(db,auth.user.id,itemId)
      if(!item)return reply({error:'Access not granted'},403)
      const expiresAt=new Date(Date.now()+45*60*1000).toISOString()
      const {data:ticket,error}=await db.from('academy_library_tickets').insert({item_id:itemId,user_id:auth.user.id,expires_at:expiresAt}).select('token,expires_at').single()
      if(error||!ticket)return reply({error:'Media unavailable'},503)
      const streamUrl=new URL(request.url);streamUrl.search='';streamUrl.searchParams.set('ticket',ticket.token)
      return reply({ok:true,ticket:ticket.token,url:streamUrl.toString(),mime_type:item.mime_type,expires_at:ticket.expires_at})
    }
    const ticketId=url.searchParams.get('ticket')||''
    if(!uuid.test(ticketId))return reply({error:'Media ticket required'},403)
    const {data:ticket,error}=await db.from('academy_library_tickets').select('item_id,user_id,expires_at').eq('token',ticketId).gt('expires_at',new Date().toISOString()).maybeSingle()
    if(error||!ticket)return reply({error:'Media ticket expired'},403)
    const item=await authorizedItem(db,ticket.user_id,ticket.item_id)
    if(!item)return reply({error:'Access revoked'},403)
    const token=await driveToken()
    const upstreamHeaders={Authorization:'Bearer '+token}
    const metadata=await fetch('https://www.googleapis.com/drive/v3/files/'+encodeURIComponent(item.drive_file_id)+'?fields=id,size,mimeType,capabilities(canDownload),isAppAuthorized',{headers:upstreamHeaders,signal:AbortSignal.timeout(15000)})
    if(!metadata.ok){
      if(metadata.status===404){
        // The refresh token may have the Drive.file scope rather than Drive.readonly.
        // These library objects are already shared by link, so proxy them only
        // after the same private ticket and grant checks above.
        console.warn('academy-media:oauth-drive-metadata-404-shared-link-proxy')
        return await serveAlreadySharedDrive(request,item.drive_file_id,item.mime_type)
      }
      const reasonBody=await metadata.json().catch(()=>null)
      const reason=String(reasonBody?.error?.errors?.[0]?.reason||reasonBody?.error?.status||'unknown').replace(/[^a-zA-Z0-9_-]/g,'').slice(0,60)
      console.error('academy-media:drive-metadata',metadata.status,reason)
      return reply({error:'Source file unavailable',stage:'drive_metadata'},502)
    }
    const info=await metadata.json()
    if(info.isAppAuthorized===false)console.warn('academy-media:drive-file-not-authorized-for-oauth-app')
    const size=Number(info.size||0)
    if(!Number.isSafeInteger(size)||size<=0||size>300*1024*1024){console.error('academy-media:invalid-size');return reply({error:'Media is not ready',stage:'invalid_size'},502)}
    if(info.capabilities?.canDownload===false){console.error('academy-media:download-denied');return reply({error:'Media is not ready',stage:'drive_permission'},502)}
    // Google Drive sometimes stores uploaded MP3/PDF as application/octet-stream.
    // The canonical media type comes from the private library record, not from user input.
    if(info.mimeType!==item.mime_type && info.mimeType!=='application/octet-stream'){
      console.error('academy-media:unexpected-mime',info.mimeType,item.mime_type)
      return reply({error:'Media is not ready',stage:'mime_mismatch'},502)
    }
    const output=headers()
    output.set('Content-Type',item.mime_type)
    output.set('Content-Disposition','inline')
    const requested=request.headers.get('range')
    let range:{start:number,end:number}|null=null
    if(requested){
      try{range=parseRange(requested,size)}catch{
        output.set('Content-Range','bytes */'+size)
        return new Response(null,{status:416,headers:output})
      }
    }
    if(request.method==='HEAD'){
      output.set('Content-Length',String(size))
      return new Response(null,{status:200,headers:output})
    }
    const driveHeaders:Record<string,string>={Authorization:'Bearer '+token}
    if(range)driveHeaders.Range='bytes='+range.start+'-'+range.end
    const upstream=await fetch('https://www.googleapis.com/drive/v3/files/'+encodeURIComponent(item.drive_file_id)+'?alt=media',{headers:driveHeaders,signal:AbortSignal.timeout(45000)})
    if(!upstream.ok){console.error('academy-media:drive-download',upstream.status);return reply({error:'Unable to read media',stage:'drive_download'},502)}
    if(range){
      const count=range.end-range.start+1
      output.set('Content-Range','bytes '+range.start+'-'+range.end+'/'+size)
      output.set('Content-Length',String(count))
      if(upstream.status===206){
        return new Response(upstream.body,{status:206,headers:output})
      }
      // Drive may ignore Range on small files; honor the requested slice ourselves.
      const bytes=new Uint8Array(await upstream.arrayBuffer())
      if(bytes.length!==size){console.error('academy-media:range-size-mismatch');return reply({error:'Unexpected media range',stage:'range_mismatch'},502)}
      return new Response(bytes.slice(range.start,range.end+1),{status:206,headers:output})
    }
    output.set('Content-Length',String(size))
    return new Response(upstream.body,{status:200,headers:output})
  }catch(error){
    console.error('academy-library-media request failed',error instanceof Error?error.message:'unknown')
    return reply({error:'Media service temporarily unavailable',stage:'runtime_failure'},503)
  }
})
