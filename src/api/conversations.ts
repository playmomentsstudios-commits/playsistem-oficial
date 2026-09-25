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
  customer: { first_name: string; last_name: string } | null
}
export interface SupportMessage extends Partial<MessageAttachment> {
  id: string
  conversation_id: string
  sender_id: string
  content: string
  created_at: string
}
export const conversationsApi = {
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
      if (lookupError || !existing || Number(existing.metadata?.size) !== file.size || existing.metadata?.mimetype !== type) throw error
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
      .select('id,customer_id,created_at,customer:profiles!customer_id(first_name,last_name)')
      .order('created_at', { ascending: false })
    if (error) throw error
    return data as unknown as SupportConversation[]
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
