export const testMessage = 'TESTE — PLAY SISTEM\n\nEsta é uma notificação de teste do módulo de Automações e Notificações.\n\nIntegração Play Sistem + ChatGPT.\n\nSe você recebeu esta mensagem, o fluxo de envio está funcionando.'
const reply = (body, status=200) => new Response(JSON.stringify(body), {status, headers:{'Content-Type':'application/json','Cache-Control':'no-store'}})
const keyPattern = /^[A-Za-z0-9:_-]{8,120}$/

/**
 * @param {{token?: string, url?: string, serviceKey?: string,
 * fetcher?: typeof fetch, log?: (...args: unknown[]) => void,
 * authenticate?: (token: string) => Promise<boolean>}} config
 */
export function createHandler({token=undefined, url, serviceKey, fetcher=fetch, log=console.error, authenticate=undefined}) {
  return async req => {
    if ((!token && !authenticate) || (token && token.length<32) || !url || !serviceKey) return reply({error:'not_configured'},503)
    const supplied = req.headers.get('authorization') || ''
    if (supplied.length>256) return reply({error:'unauthorized'},401)
    if (!supplied.startsWith('Bearer ') || supplied.length<39) return reply({error:'unauthorized'},401)
    if (token) {
      const digest = value => crypto.subtle.digest('SHA-256',new TextEncoder().encode(value))
      const [expected,actual] = await Promise.all([digest(`Bearer ${token}`),digest(supplied)])
      let mismatch=0
      const a=new Uint8Array(actual), e=new Uint8Array(expected)
      for(let i=0;i<e.length;i++) mismatch |= e[i]^a[i]
      if(mismatch) return reply({error:'unauthorized'},401)
    } else {
      try {if(!await authenticate(supplied.slice(7))) return reply({error:'unauthorized'},401)}
      catch {return reply({error:'authentication_unavailable'},503)}
    }
    const rpcHeaders = {'Content-Type':'application/json',apikey:serviceKey,Authorization:`Bearer ${serviceKey}`}
    const requestId=crypto.randomUUID()
    try {
      if(req.method==='GET') {
        const key=new URL(req.url).searchParams.get('key') || ''
        if(!keyPattern.test(key)) return reply({error:'invalid_key'},422)
        const query=new URLSearchParams({select:'*',idempotency_key:`eq.${key}`})
        const result=await fetcher(`${url}/rest/v1/automation_delivery_status?${query}`,{headers:rpcHeaders})
        if(!result.ok) throw new Error('status_read_failed')
        return reply({attempts:await result.json()})
      }
      if(req.method!=='POST') return reply({error:'method_not_allowed'},405)
      if(!(req.headers.get('content-type') || '').startsWith('application/json')) return reply({error:'json_required'},415)
      // Bound the streamed body too: Content-Length can be absent or forged.
      const reader=req.body?.getReader(); let size=0; const chunks=[]
      if(!reader) return reply({error:'invalid_payload'},422)
      while(true) {
        const {value,done}=await reader.read(); if(done) break
        size+=value.byteLength
        if(size>20000) {await reader.cancel(); return reply({error:'payload_too_large'},413)}
        chunks.push(value)
      }
      const bytes=new Uint8Array(size);let offset=0
      for(const chunk of chunks) {bytes.set(chunk,offset);offset+=chunk.length}
      let body
      try {body=JSON.parse(new TextDecoder().decode(bytes))} catch {return reply({error:'invalid_json'},422)}
      if(!body || body.source!=='chatgpt' || body.flow!=='rkc_felipe' || !['test','manual'].includes(body.kind)) return reply({error:'invalid_origin_or_flow'},422)
      const key=body.kind==='test'?'play-sistem:first-whatsapp-test:v1':req.headers.get('idempotency-key')
      const title=body.kind==='test'?'TESTE — PLAY SISTEM':body.title
      const message=body.kind==='test'?testMessage:body.message
      if(typeof key!=='string' || !keyPattern.test(key) || typeof title!=='string' || !title.trim() || title.length>120 || typeof message!=='string' || !message.trim() || message.length>4000) return reply({error:'invalid_payload'},422)
      const result=await fetcher(`${url}/rest/v1/rpc/automation_enqueue`,{method:'POST',headers:rpcHeaders,body:JSON.stringify({p_key:key,p_title:title,p_body:message})})
      if(!result.ok) {
        const error=await result.json().catch(()=>({}))
        if(error.code==='22023') return reply({error:'identity_or_idempotency_conflict',request_id:requestId},409)
        throw new Error('enqueue_rpc_failed')
      }
      const data=await result.json()
      return reply(data,data.status==='failed'?409:data.duplicate?200:202)
    } catch(error) {
      log(JSON.stringify({request_id:requestId,error:error instanceof Error?error.message:'internal_error'}))
      return reply({error:'backend_unavailable',request_id:requestId},503)
    }
  }
}
