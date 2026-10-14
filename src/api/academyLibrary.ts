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
  if(error||!data?.ok)throw new Error('Não foi possível abrir este conteúdo. Confirme seu acesso e tente novamente.')
  // Only use the opaque, short-lived token returned by the authenticated endpoint.
  // The function's request URL can differ between Supabase's gateway and runtime.
  // Never navigate to a URL supplied by the API; construct a fixed same-origin path.
  const ticket=typeof data.ticket==='string'?data.ticket:''
  if(!/^[0-9a-f]{8}-(?:[0-9a-f]{4}-){3}[0-9a-f]{12}$/i.test(ticket)){
    throw new Error('O serviço não forneceu um acesso temporário válido. Tente novamente.')
  }
  if(data.mime_type!=='audio/mpeg'&&data.mime_type!=='application/pdf'){
    throw new Error('O serviço retornou um formato de arquivo inválido.')
  }
  return {url:'/app/academia/midia?ticket='+encodeURIComponent(ticket),mime_type:data.mime_type,expires_at:data.expires_at}
 }
}
