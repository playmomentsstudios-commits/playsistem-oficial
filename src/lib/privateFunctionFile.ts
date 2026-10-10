import { supabase, supabaseUrl, supabaseAnonKey } from './supabase'

// functions.invoke decodes image/audio/video responses as TEXT. Never turn its
// data string into a Blob: invalid UTF-8 bytes become U+FFFD irreversibly.
export async function privateFunctionFile(name:string,body:Record<string,unknown>):Promise<Blob>{
  const {data:{session},error}=await supabase.auth.getSession()
  if(error||!session)throw new Error('Sessão expirada. Entre novamente.')
  const response=await fetch(supabaseUrl+'/functions/v1/'+encodeURIComponent(name),{
    method:'POST',
    headers:{Authorization:'Bearer '+session.access_token,apikey:supabaseAnonKey,'Content-Type':'application/json'},
    body:JSON.stringify(body),signal:AbortSignal.timeout(120000),
  })
  if(!response.ok){
    const detail=await response.json().catch(()=>null)
    throw new Error(detail?.error||'Falha ao ler o arquivo. Código '+response.status+'.')
  }
  return response.blob()
}
