import { supabase, supabaseUrl } from '../lib/supabase'

export type LibraryItem={
 id:string
 release_code:string
 format:'ebook'|'audiobook'
 title:string
 slug:string
 mime_type:'application/pdf'|'audio/mpeg'
 cover_url?:string|null
}

export const academyLibraryApi={
 async mine():Promise<LibraryItem[]>{
  const {data,error}=await supabase.rpc('academy_my_library')
  if(error)throw new Error('Não foi possível carregar seus e-books e audiobooks.')
  const {data:art,error:artError}=await supabase.rpc('academy_my_library_artwork')
  if(artError)throw new Error('Não foi possível carregar as capas da sua biblioteca.')
  const covers=new Map<string,string|null>((art||[]).map((row:any)=>[row.item_id,row.cover_url]))
  return (data||[]).map((row:any)=>({...row,cover_url:covers.get(row.id)||null})) as LibraryItem[]
 },
 async mediaTicket(itemId:string):Promise<{url:string;fallbackUrl:string;mime_type:string;expires_at:string}>{
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
  // Fallback uses ONLY our configured Supabase project, never an untrusted
  // URL from a server response. GET still requires a non-expired, granted ticket.
  const base=new URL(supabaseUrl)
  if(base.protocol!=='https:'||!base.hostname.endsWith('.supabase.co')){
    throw new Error('Servidor de arquivos não configurado corretamente.')
  }
  const direct=new URL('/functions/v1/academy-library-media',base.origin)
  direct.searchParams.set('ticket',ticket)
  return {
    url:'/app/academia/midia?ticket='+encodeURIComponent(ticket),
    fallbackUrl:direct.toString(),
    mime_type:data.mime_type,
    expires_at:data.expires_at
  }
 }
}
