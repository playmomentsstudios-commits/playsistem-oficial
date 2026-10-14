import { supabase, supabaseUrl } from '../lib/supabase'

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
  // Do not embed the cross-origin Edge Function directly: media and PDF viewers
  // may be blocked by the site's frame/media security rules.
  const origin=new URL(supabaseUrl)
  const upstream=new URL(data.url)
  const ticket=upstream.searchParams.get('ticket')||''
  if(upstream.origin!==origin.origin||upstream.pathname!=='/functions/v1/academy-library-media'||
     !/^[0-9a-f]{8}-(?:[0-9a-f]{4}-){3}[0-9a-f]{12}$/i.test(ticket)){
    throw new Error('O serviço retornou um endereço de mídia inesperado.')
  }
  return {url:'/app/academia/midia?ticket='+encodeURIComponent(ticket),mime_type:data.mime_type,expires_at:data.expires_at}
 }
}
