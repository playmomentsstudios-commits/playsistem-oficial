import { privateFunctionFile } from '../lib/privateFunctionFile'
import { supabase } from '../lib/supabase'
import { attachmentMime, validateAttachment } from '../lib/attachments'

// Keep text chat usable while the attachment migration is being rolled out.
const MESSAGE_FIELDS = '*'
export const CHAT_BUCKET = 'chat-attachments'
export interface MessageAttachment {
  attachment_path: string | null
  attachment_drive_file_id?: string
  attachment_name: string
  attachment_type: string
  attachment_size: number
  attachment_preview_path?: string
}

export interface SupportConversation {
  id: string
  customer_id: string
  created_at: string
  updated_at?: string
  assigned_to?: string | null
  assigned_at?: string | null
  status?: 'open'|'pending'|'resolved'
  priority?: 'low'|'normal'|'high'|'urgent'
  tags?: string[]
  last_message?: string | null
  last_message_at?: string | null
  last_sender_id?: string | null
  unread_count?: number
  customer: { first_name: string; last_name: string } | null
  assignee?: { id:string; first_name:string; last_name:string; role:string } | null
}
export interface ConversationTeamMember {
  id:string
  first_name:string
  last_name:string
  email:string
  role:string
  staff?: { job_title:string;department:string;permissions:string[];active:boolean } | null
}
export interface SupportMessage extends Partial<MessageAttachment> {
  id: string
  conversation_id: string
  sender_id: string
  content: string
  created_at: string
  deleted_at?: string | null
}
async function invokeChat(body:Record<string,unknown>) {
  const {data,error}=await supabase.functions.invoke('chat-drive-upload',{body,timeout:60000})
  if(error) {
    let detail=''
    try{detail=(await error.context?.json())?.error||''}catch{/* response already read */}
    throw new Error(detail||error.message||'Falha no envio do anexo.')
  }
  return data
}
export const conversationsApi = {
  async deleteOwnMessage(messageId:string) {
    const { error } = await supabase.rpc('delete_own_chat_message',{p_message_id:messageId})
    if (error) throw error
  },
  async upload(conversationId: string, senderId: string, id: string, file: File): Promise<MessageAttachment> {
    const invalid = validateAttachment(file)
    if (invalid) throw new Error(invalid)
    const type = attachmentMime(file)
    const digest=await crypto.subtle.digest('SHA-256',await file.arrayBuffer())
    const sha256=Array.from(new Uint8Array(digest),value=>value.toString(16).padStart(2,'0')).join('')
    const body={conversation_id:conversationId,message_id:id,name:file.name,type,size:file.size,sha256}
    let session=await invokeChat({...body,action:'begin'})
    if(session.attachment)return session.attachment
    // The resumable URL grants only this upload; no Google OAuth credential reaches the browser.
    // Always finalize against Drive's checksum, including lost successful PUT responses.
    let offset=Number(session.next_offset||0)
    // 5 MB chunks are multiples of Drive's required 256 KB; retries resume server state.
    while(offset<file.size){
      const end=Math.min(offset+5*1024*1024,file.size)
      try{
        const response=await fetch(session.upload_url,{method:'PUT',headers:{'Content-Type':type.split(';')[0],'Content-Range':`bytes ${offset}-${end-1}/${file.size}`},body:file.slice(offset,end),signal:AbortSignal.timeout(180000)})
        if(response.status!==308&&!response.ok)throw new Error('Falha no upload para o Google Drive. Código '+response.status+'.')
        offset=end
      }catch(error){
        // One server check may recover a committed chunk or a lost final response.
        const recovered=await invokeChat({...body,action:'begin'})
        if(recovered.attachment)return recovered.attachment
        if(Number(recovered.next_offset||0)<=offset)throw error
        session=recovered;offset=Number(recovered.next_offset)
      }
    }
    return (await invokeChat({...body,action:'finalize'})).attachment
  },
  async mediaUrl(message:SupportMessage,mode:'thumbnail'|'expanded'|'original'|'download'):Promise<string> {
    if(message.attachment_drive_file_id){
      const data=await privateFunctionFile('chat-drive-media',{message_id:message.id,mode})
      return URL.createObjectURL(data)
    }
    const path=(mode==='thumbnail'||mode==='expanded')&&message.attachment_preview_path?message.attachment_preview_path:message.attachment_path
    if(!path)throw new Error('Anexo não encontrado.')
    // Compatibility only: existing Storage originals remain readable until audited migration.
    const {data,error}=await supabase.storage.from(CHAT_BUCKET).createSignedUrl(path,600,mode==='download'?{download:message.attachment_name}:undefined)
    if(error)throw error
    return data.signedUrl
  },
  async list(): Promise<SupportConversation[]> {
    const { data, error } = await supabase.from('conversations')
      .select('id,customer_id,created_at,updated_at,assigned_to,assigned_at,status,priority,tags,customer:profiles!customer_id(first_name,last_name),assignee:profiles!conversations_assigned_to_fkey(id,first_name,last_name,role)')
      .order('updated_at', { ascending: false })
    if (error) throw error
    return (data||[]).map((row:any)=>({
      ...row,
      customer:Array.isArray(row.customer)?row.customer[0]||null:row.customer,
      assignee:Array.isArray(row.assignee)?row.assignee[0]||null:row.assignee,
    })) as SupportConversation[]
  },
  async listWithSummary(userId:string): Promise<SupportConversation[]> {
    const rows=await conversationsApi.list()
    const enriched=await Promise.all(rows.map(async row=>{
      const [readResult,lastResult]=await Promise.all([
        supabase.from('conversation_reads')
          .select('last_read_at')
          .eq('conversation_id',row.id)
          .eq('user_id',userId)
          .maybeSingle(),
        supabase.from('messages')
          .select('id,sender_id,content,created_at')
          .eq('conversation_id',row.id)
          .order('created_at',{ascending:false})
          .order('id',{ascending:false})
          .limit(1)
          .maybeSingle(),
      ])
      const lastRead=readResult.data?.last_read_at||null
      let unreadCount=0
      let countQuery=supabase.from('messages')
        .select('id',{count:'exact',head:true})
        .eq('conversation_id',row.id)
        .neq('sender_id',userId)
      if(lastRead)countQuery=countQuery.gt('created_at',lastRead)
      const countResult=await countQuery
      const last=lastResult.data
      return {
        ...row,
        last_message:last?.content||null,
        last_message_at:last?.created_at||row.updated_at||row.created_at,
        last_sender_id:last?.sender_id||null,
        unread_count:countResult.count||0,
      }
    }))
    return enriched.sort((a,b)=>(b.last_message_at||'').localeCompare(a.last_message_at||''))
  },
  async team(): Promise<ConversationTeamMember[]> {
    const { data,error }=await supabase.from('profiles')
      .select('id,first_name,last_name,email,role,staff:staff_profiles!staff_profiles_user_id_fkey(job_title,department,permissions,active)')
      .in('role',['admin','staff']).eq('status','active').order('first_name')
    if(error)throw error
    return (data||[]).map((row:any)=>({
      ...row,
      staff:Array.isArray(row.staff)?row.staff[0]||null:row.staff,
    })) as ConversationTeamMember[]
  },
  async assign(conversationId:string,assignee:string|null,note?:string) {
    const { error }=await supabase.rpc('assign_conversation',{
      p_conversation_id:conversationId,
      p_assignee:assignee,
      p_note:note||null,
    })
    if(error)throw error
  },
  async updateCrm(conversationId:string,values:{status?:string;priority?:string;tags?:string[]}) {
    const { error }=await supabase.rpc('update_conversation_crm',{
      p_conversation_id:conversationId,
      p_status:values.status||null,
      p_priority:values.priority||null,
      p_tags:values.tags||null,
    })
    if(error)throw error
  },
  async open(): Promise<string> {
    const { data, error } = await supabase.rpc('open_customer_conversation')
    if (error) throw error
    return data as string
  },
  async messages(conversationId: string): Promise<SupportMessage[]> {
    const { data, error } = await supabase.from('messages')
      .select(MESSAGE_FIELDS)
      .eq('conversation_id', conversationId)
      .order('created_at', { ascending: false }).order('id', { ascending: false }).limit(200)
    if (error) throw error
    return (data as SupportMessage[]).reverse()
  },
  async send(conversationId: string, senderId: string, content: string, id: string, attachment?: MessageAttachment): Promise<SupportMessage> {
    const { data, error } = await supabase.from('messages')
      .insert({ id, conversation_id: conversationId, sender_id: senderId, content: content.trim(), ...attachment })
      .select(MESSAGE_FIELDS).single()
    if (error?.code === '23505') {
      // Retry after a lost response must not duplicate the message.
      const existing = await supabase.from('messages').select(MESSAGE_FIELDS).eq('id', id).single()
      if (existing.error) throw existing.error
      return existing.data as SupportMessage
    }
    if (error) throw error
    return data as SupportMessage
  },
}
