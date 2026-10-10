import { supabase } from '../lib/supabase'
import { attachmentMime, validateAttachment } from '../lib/attachments'

// Keep text chat usable while the attachment migration is being rolled out.
const MESSAGE_FIELDS = '*'
export const CHAT_BUCKET = 'chat-attachments'
export interface MessageAttachment {
  attachment_path: string
  attachment_name: string
  attachment_type: string
  attachment_size: number
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
export const conversationsApi = {
  async deleteOwnMessage(messageId:string) {
    const { error } = await supabase.rpc('delete_own_chat_message',{p_message_id:messageId})
    if (error) throw error
  },
  async upload(conversationId: string, senderId: string, id: string, file: File): Promise<MessageAttachment> {
    const invalid = validateAttachment(file)
    if (invalid) throw new Error(invalid)
    const path = conversationId + '/' + senderId + '/' + id
    const type = attachmentMime(file)
    const { error } = await supabase.storage.from(CHAT_BUCKET).upload(path, file, { contentType: type, upsert: false })
    // The immutable path is reused only for the same pending file after a lost response.
    if (error && !['409', '400'].includes(String(error.statusCode))) throw error
    if (error) {
      const { data: existing, error: lookupError } = await supabase.storage.from(CHAT_BUCKET).info(path)
      if (lookupError || !existing || Number(existing.metadata?.size) !== file.size || String(existing.metadata?.mimetype).split(';')[0] !== type.split(';')[0]) throw error
    }
    return { attachment_path: path, attachment_name: file.name, attachment_type: type, attachment_size: file.size }
  },
  async attachmentUrl(path: string, downloadName?: string): Promise<string> {
    const { data, error } = await supabase.storage.from(CHAT_BUCKET).createSignedUrl(path, 600,
      downloadName ? { download: downloadName } : undefined)
    if (error) throw error
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
