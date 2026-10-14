import { supabase } from '../lib/supabase'

export type LibraryItem={
 id:string
 release_code:string
 format:'ebook'|'audiobook'
 title:string
 slug:string
 mime_type:'application/pdf'|'audio/mpeg'
}

export const academyLibraryApi={
 async mine():Promise<LibraryItem[]>{
  const {data,error}=await supabase.rpc('academy_my_library')
  if(error)throw new Error('Não foi possível carregar seus e-books e audiobooks.')
  return (data||[]) as LibraryItem[]
 },
 async mediaTicket(itemId:string):Promise<{url:string;mime_type:string;expires_at:string}>{
  const {data,error}=await supabase.functions.invoke('academy-library-media',{body:{item_id:itemId}})
  if(error||!data?.ok||typeof data.url!=='string')throw new Error('Não foi possível abrir este conteúdo. Confirme seu acesso e tente novamente.')
  return {url:data.url,mime_type:data.mime_type,expires_at:data.expires_at}
 }
}
