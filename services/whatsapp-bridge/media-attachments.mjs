/**
 * Sagamente WhatsApp attachments: only our scoped, expiring Drive file links.
 * Send original files as documents so design artwork is not photo-compressed.
 */
const MAX_ATTACHMENTS=3
const MAX_FILE_BYTES=12*1024*1024
const MAX_TOTAL_BYTES=30*1024*1024
const FILE_MARK=/^(?:🖼️|📄 Apoio:|📎)\s*\*([^*\r\n]{1,180})\*\s*$/u

export function attachmentReferences(message,configuredSupabaseUrl){
  if(typeof message!=='string'||typeof configuredSupabaseUrl!=='string')return []
  let origin
  try{
    origin=new URL(configuredSupabaseUrl).origin
    if(new URL(origin).protocol!=='https:')return []
  }catch{return []}
  const rows=message.replace(/\r\n/g,'\n').split('\n')
  const refs=[]
  for(let index=0;index<rows.length-1;index++){
    const label=FILE_MARK.exec(rows[index].trim())
    if(!label)continue
    const urlText=rows[index+1].trim()
    let link
    try{link=new URL(urlText)}catch{continue}
    if(link.origin!==origin
       ||link.pathname!=='/functions/v1/whatsapp-file-open'
       ||link.searchParams.size!==1
       ||!/^[a-f0-9]{64}$/.test(link.searchParams.get('t')||'')
       ||link.hash
       ||link.toString()!==urlText)continue
    const name=label[1].trim().replace(/[\\/\r\n\t\u0000-\u001f]/g,'_').slice(0,140)
    if(!name)continue
    refs.push({name,url:urlText,labelIndex:index,linkIndex:index+1})
    index++
  }
  return refs
}

export function attachmentPlan(message,supabaseUrl){
  return attachmentReferences(message,supabaseUrl).slice(0,MAX_ATTACHMENTS)
}

export function messageAfterAttachments(message,submitted){
  if(typeof message!=='string'||!submitted?.length)return message
  const lines=message.replace(/\r\n/g,'\n').split('\n')
  const removed=new Set()
  for(const item of submitted){
    if(!Number.isInteger(item.labelIndex)||!Number.isInteger(item.linkIndex))continue
    if(item.linkIndex!==item.labelIndex+1)continue
    if(lines[item.linkIndex]!==item.url)continue
    removed.add(item.linkIndex)
  }
  return lines.filter((_,index)=>!removed.has(index))
    .join('\n').replace(/\n{3,}/g,'\n\n')
}

function mimeForFile(filename,headerMime){
  const header=String(headerMime||'').split(';')[0].trim().toLowerCase()
  if(!header||header==='application/octet-stream'){
    const ext=filename.split('.').pop()?.toLowerCase()
    return ({
      pdf:'application/pdf',jpg:'image/jpeg',jpeg:'image/jpeg',png:'image/png',
      webp:'image/webp',doc:'application/msword',docx:'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      xls:'application/vnd.ms-excel',xlsx:'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      ppt:'application/vnd.ms-powerpoint',pptx:'application/vnd.openxmlformats-officedocument.presentationml.presentation',
      zip:'application/zip',txt:'text/plain',mp4:'video/mp4'
    })[ext]||'application/octet-stream'
  }
  return header
}

export async function downloadAttachment(ref,configuredSupabaseUrl,fetchImpl=fetch){
  if(!attachmentReferences('📎 *'+(ref?.name||'')+'*\n'+(ref?.url||''),configuredSupabaseUrl).length){
    throw new Error('Link do arquivo fora do endereço autorizado.')
  }
  const response=await fetchImpl(ref.url,{
    method:'GET',redirect:'error',signal:AbortSignal.timeout(20000),
    headers:{Accept:'application/octet-stream, application/pdf, image/*'}
  })
  if(!response.ok||!response.body){
    throw new Error('Arquivo privado indisponível ou link expirado.')
  }
  const reportedSize=Number(response.headers.get('content-length')||'0')
  if(Number.isFinite(reportedSize)&&reportedSize>MAX_FILE_BYTES){
    await response.body.cancel().catch(()=>{})
    throw new Error('Arquivo excede o limite de 12 MB por anexo.')
  }
  const mimeType=mimeForFile(ref.name,response.headers.get('content-type'))
  if(['text/html','application/xhtml+xml','application/json'].includes(mimeType)){
    await response.body.cancel().catch(()=>{})
    throw new Error('A resposta do link não é um arquivo compatível.')
  }
  const reader=response.body.getReader()
  const chunks=[]
  let size=0
  try{
    while(true){
      const {done,value}=await reader.read()
      if(done)break
      size+=value.byteLength
      if(size>MAX_FILE_BYTES)throw new Error('Arquivo excede o limite de 12 MB por anexo.')
      chunks.push(Buffer.from(value))
    }
  }catch(error){
    await reader.cancel().catch(()=>{})
    throw error
  }
  if(size===0)throw new Error('Arquivo vazio; link mantido como alternativa.')
  return {name:ref.name,buffer:Buffer.concat(chunks,size),mimetype:mimeType,byteLength:size}
}

/**
 * Up to 3 real documents, preserving the temporary link as a fallback whenever
 * downloading or submitting one fails. Never retry a partially-sent batch.
 */
export async function sendAttachmentsForNotification({
  text,supabaseUrl,address,socket,fetchImpl=fetch
}){
  const candidates=attachmentPlan(text,supabaseUrl)
  const sent=[]
  const failures=[]
  let sentBytes=0
  for(const candidate of candidates){
    try{
      const file=await downloadAttachment(candidate,supabaseUrl,fetchImpl)
      if(sentBytes+file.byteLength>MAX_TOTAL_BYTES){
        throw new Error('Tamanho total dos anexos excedeu 30 MB.')
      }
      const result=await socket.sendMessage(address,{
        document:file.buffer,mimetype:file.mimetype,fileName:file.name
      })
      if(!result?.key?.id)throw new Error('WhatsApp não retornou identificador do anexo.')
      sent.push(candidate)
      sentBytes+=file.byteLength
    }catch(error){
      failures.push({name:candidate.name,reason:String(error?.message||'Falha ao anexar').slice(0,130)})
    }
  }
  return {
    text:messageAfterAttachments(text,sent),
    attached:sent.length,
    candidates:candidates.length,
    failed:failures.length,
    failures
  }
}
