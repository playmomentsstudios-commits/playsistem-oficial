import { supabase, supabaseUrl, supabaseAnonKey } from './supabase'

// functions.invoke decodes image/audio/video responses as TEXT. Never turn its
// data string into a Blob: invalid UTF-8 bytes become U+FFFD irreversibly.
export async function privateFunctionFile(name:string,body:Record<string,unknown>):Promise<Blob>{
  const {data:{session},error}=await supabase.auth.getSession()
  if(error||!session)throw new Error('Sessão expirada. Entre novamente.')
  const request=(token:string)=>fetch(supabaseUrl+'/functions/v1/'+encodeURIComponent(name),{
    method:'POST',
    headers:{Authorization:'Bearer '+token,apikey:supabaseAnonKey,'Content-Type':'application/json'},
    body:JSON.stringify(body),signal:AbortSignal.timeout(120000),
  })
  let response=await request(session.access_token)
  if(response.status===401){
    const {data,error:refreshError}=await supabase.auth.refreshSession()
    if(refreshError||!data.session)throw new Error('Sessão expirada. Entre novamente.')
    response=await request(data.session.access_token)
  }
  if(!response.ok){
    const detail=await response.json().catch(()=>null)
    throw new Error(detail?.error||'Falha ao ler o arquivo. Código '+response.status+'.')
  }
  return response.blob()
}
