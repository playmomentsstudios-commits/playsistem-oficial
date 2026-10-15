import {supabase} from '../lib/supabase'

export type LibraryFormat='ebook'|'audiobook'
export type AdminLibraryItem={
 id:string;title:string;slug:string;release_code:string;format:LibraryFormat;
 drive_file_id:string;source_filename:string;mime_type:string;
 status:'draft'|'private_beta'|'published'|'archived';
 description:string|null;author_name:string|null;
 cover_url:string|null;cover_drive_file_id:string|null;banner_url:string|null;
 sample_text:string|null;sample_audio_url:string|null;landing_page_id:string|null;
 created_at:string;
}
export type LibraryUser={id:string;first_name:string;last_name:string;email:string}
export type LibraryGrant={id:string;user_id:string;item_id:string;active:boolean;source:string;granted_at:string}

const slugify=(value:string)=>value.normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase().replace(/[^a-z0-9]+/g,'-').replace(/^-|-$/g,'')
export const librarySlugify=slugify

const message=(error:unknown,fallback:string)=>error instanceof Error?error.message:fallback
const must=(condition:boolean,description:string)=>{if(!condition)throw new Error(description)}

async function uploadSession(body:Record<string,unknown>){
 const {data,error}=await supabase.functions.invoke('academy-library-upload',{body})
 if(error||!data?.ok)throw new Error(data?.error||message(error,'Falha na operação de upload privado.'))
 return data
}

export const academyLibraryAdminApi={
 async list():Promise<AdminLibraryItem[]>{
  const {data,error}=await supabase.from('academy_library_items').select('*').order('created_at',{ascending:false})
  if(error)throw error
  return (data||[]) as AdminLibraryItem[]
 },
 async save(input:Partial<AdminLibraryItem>&Pick<AdminLibraryItem,'title'|'slug'|'release_code'|'format'|'drive_file_id'|'source_filename'|'mime_type'|'status'>){
  must(Boolean(input.title.trim()),'Informe o título do conteúdo.')
  must(Boolean(input.drive_file_id),'Envie o arquivo PDF/MP3 antes de salvar.')
  must(Boolean(input.slug.trim()),'Informe uma URL para este conteúdo.')
  const payload={
   title:input.title.trim(),slug:slugify(input.slug),release_code:input.release_code.trim(),
   format:input.format,drive_file_id:input.drive_file_id,source_filename:input.source_filename,
   mime_type:input.format==='ebook'?'application/pdf':'audio/mpeg',
   status:input.status,
   description:input.description?.trim()||null,author_name:input.author_name?.trim()||null,
   cover_url:input.cover_url||null,cover_drive_file_id:input.cover_drive_file_id||null,
   banner_url:input.banner_url||null,sample_text:input.sample_text?.trim()||null,
   sample_audio_url:input.sample_audio_url||null,
  }
  if(input.id){
   const {error}=await supabase.from('academy_library_items').update(payload).eq('id',input.id)
   if(error)throw error
   const {data,error:readError}=await supabase.from('academy_library_items').select('*').eq('id',input.id).single()
   if(readError)throw readError
   return data as AdminLibraryItem
  }
  const {data,error}=await supabase.from('academy_library_items').insert(payload).select('id').single()
  if(error)throw error
  const {data:created,error:readError}=await supabase.from('academy_library_items').select('*').eq('id',data.id).single()
  if(readError)throw readError
  return created as AdminLibraryItem
 },
 async setStatus(item:AdminLibraryItem,status:AdminLibraryItem['status']){
  const {error}=await supabase.from('academy_library_items').update({status}).eq('id',item.id)
  if(error)throw error
 },
 async users():Promise<LibraryUser[]>{
  const {data,error}=await supabase.from('profiles').select('id,first_name,last_name,email').eq('role','customer').eq('status','active').order('first_name').limit(500)
  if(error)throw error
  return (data||[]) as LibraryUser[]
 },
 async grants(itemId:string):Promise<LibraryGrant[]>{
  const {data,error}=await supabase.from('academy_library_grants').select('id,user_id,item_id,active,source,granted_at').eq('item_id',itemId).order('granted_at',{ascending:false})
  if(error)throw error
  return (data||[]) as LibraryGrant[]
 },
 async grant(itemId:string,userId:string,active:boolean){
  const {error}=await supabase.from('academy_library_grants').upsert(
   {item_id:itemId,user_id:userId,active,source:'admin'},
   {onConflict:'item_id,user_id'})
  if(error)throw error
 },
 async uploadOriginal(file:File,releaseCode:string,format:LibraryFormat,onProgress:(n:number)=>void){
  const mimeType=format==='ebook'?'application/pdf':'audio/mpeg'
  if(!(format==='ebook'?/\.pdf$/i:/\.mp3$/i).test(file.name))throw new Error(format==='ebook'?'Selecione um PDF.':'Selecione um arquivo MP3.')
  if(file.size<=0||file.size>350*1024*1024)throw new Error('Arquivo vazio ou maior que 350 MB.')
  const metadata={release_code:releaseCode,format,file_name:file.name,file_size:file.size}
  const session=await uploadSession({...metadata,action:'start'})
  const url=String(session.upload_url||'')
  if(!url.startsWith('https://'))throw new Error('O Drive não retornou um destino HTTPS.')
  const driveId=await new Promise<string>((resolve,reject)=>{
    const xhr=new XMLHttpRequest()
    xhr.open('PUT',url)
    xhr.setRequestHeader('Content-Type',mimeType)
    xhr.setRequestHeader('Content-Range','bytes 0-'+(file.size-1)+'/'+file.size)
    xhr.upload.onprogress=e=>{if(e.lengthComputable)onProgress(Math.min(98,Math.round(e.loaded/e.total*98)))}
    xhr.onerror=()=>reject(new Error('Falha de conexão durante o envio ao Drive.'))
    xhr.onload=()=>{
     if(xhr.status<200||xhr.status>=300){reject(new Error('O Drive recusou o arquivo ('+xhr.status+').'));return}
     try{
       const fileResponse=JSON.parse(xhr.responseText)
       if(!fileResponse?.id)throw new Error('O Drive não retornou o arquivo confirmado.')
       resolve(String(fileResponse.id))
     }catch(e){reject(e)}
    }
    xhr.send(file)
  })
  const confirmed=await uploadSession({...metadata,action:'confirm',drive_file_id:driveId})
  if(!confirmed.file?.id)throw new Error('Não foi possível confirmar o arquivo no Drive.')
  onProgress(100)
  return {id:String(confirmed.file.id),name:file.name}
 }
}
