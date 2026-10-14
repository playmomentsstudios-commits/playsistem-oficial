import { supabase } from '../lib/supabase'

export type DigitalKind='ebook'|'audiobook'
export type DigitalPublication={
 id:string;slug:string;title:string;summary:string|null;author:string|null;kind:DigitalKind;
 status:'draft'|'published'|'archived';cover_url:string|null;duration_minutes:number|null;page_count:number|null;
 created_at:string
}
export type DigitalEntitlement={id:string;publication_id:string;source:'manual'|'order';granted_at:string;publication:DigitalPublication|null}
export type DigitalAsset={publication_id:string;drive_file_id:string;mime_type:'application/pdf'|'audio/mpeg';file_name:string|null}

function errorOrThrow(error:any){if(error)throw new Error(error.message||'Não foi possível consultar a biblioteca.')}
export const academyDigitalApi={
 async catalog():Promise<DigitalPublication[]>{
  const {data,error}=await supabase.from('academy_publications').select('id,slug,title,summary,author,kind,status,cover_url,duration_minutes,page_count,created_at').eq('status','published').order('created_at',{ascending:false})
  errorOrThrow(error);return (data||[]) as DigitalPublication[]
 },
 async myLibrary():Promise<DigitalEntitlement[]>{
  const {data,error}=await supabase.from('academy_publication_entitlements').select('id,publication_id,source,granted_at,publication:academy_publications(id,slug,title,summary,author,kind,status,cover_url,duration_minutes,page_count,created_at)').is('revoked_at',null).order('granted_at',{ascending:false})
  errorOrThrow(error);return ((data||[]) as unknown as DigitalEntitlement[]).filter(x=>x.publication?.status==='published')
 },
 async publication(id:string):Promise<DigitalPublication>{
  const {data,error}=await supabase.from('academy_publications').select('id,slug,title,summary,author,kind,status,cover_url,duration_minutes,page_count,created_at').eq('id',id).single()
  errorOrThrow(error);return data as DigitalPublication
 },
 async mediaUrl(id:string):Promise<{url:string;mime_type:string;expires_at:string}>{
  const {data,error}=await supabase.functions.invoke('academy-publication-media',{body:{publication_id:id}})
  errorOrThrow(error);if(!data?.url)throw new Error(data?.error||'Não foi possível abrir o conteúdo.');return data
 },
 async adminList():Promise<DigitalPublication[]>{
  const {data,error}=await supabase.from('academy_publications').select('*').order('created_at',{ascending:false})
  errorOrThrow(error);return (data||[]) as DigitalPublication[]
 },
 async adminAsset(id:string):Promise<DigitalAsset|null>{
  const {data,error}=await supabase.from('academy_publication_assets').select('publication_id,drive_file_id,mime_type,file_name').eq('publication_id',id).maybeSingle()
  errorOrThrow(error);return (data||null) as DigitalAsset|null
 },
 async savePublication(payload:Partial<DigitalPublication>&Pick<DigitalPublication,'title'|'slug'|'kind'|'status'>):Promise<DigitalPublication>{
  const allowed={title:payload.title,slug:payload.slug,summary:payload.summary||null,author:payload.author||null,kind:payload.kind,status:payload.status,cover_url:payload.cover_url||null,duration_minutes:payload.duration_minutes||null,page_count:payload.page_count||null}
  const query=payload.id?supabase.from('academy_publications').update(allowed).eq('id',payload.id):supabase.from('academy_publications').insert(allowed)
  const {data,error}=await query.select('*').single();errorOrThrow(error);return data as DigitalPublication
 },
 async saveAsset(publicationId:string,driveFileId:string,mimeType:'application/pdf'|'audio/mpeg',fileName:string){
  const {error}=await supabase.from('academy_publication_assets').upsert({publication_id:publicationId,drive_file_id:driveFileId.trim(),mime_type:mimeType,file_name:fileName||null},{onConflict:'publication_id'})
  errorOrThrow(error)
 },
 async grantManual(publicationId:string,userId:string){
  const {data:existing,error:lookupError}=await supabase.from('academy_publication_entitlements').select('id').eq('publication_id',publicationId).eq('user_id',userId).eq('source','manual').maybeSingle()
  errorOrThrow(lookupError)
  if(existing){const {error}=await supabase.from('academy_publication_entitlements').update({revoked_at:null}).eq('id',existing.id);errorOrThrow(error)}
  else{const {error}=await supabase.from('academy_publication_entitlements').insert({publication_id:publicationId,user_id:userId,source:'manual',order_id:null});errorOrThrow(error)}
 },
}
