import { supabase } from '../lib/supabase'

export interface SupportConversation {
  id: string
  customer_id: string
  created_at: string
  customer: { first_name: string; last_name: string } | null
}
export interface SupportMessage {
  id: string
  conversation_id: string
  sender_id: string
  content: string
  created_at: string
}
export const conversationsApi = {
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
      .select('id,conversation_id,sender_id,content,created_at')
      .eq('conversation_id', conversationId)
      .order('created_at', { ascending: false }).order('id', { ascending: false }).limit(200)
    if (error) throw error
    return (data as SupportMessage[]).reverse()
  },
  async send(conversationId: string, senderId: string, content: string, id: string): Promise<SupportMessage> {
    const { data, error } = await supabase.from('messages')
      .insert({ id, conversation_id: conversationId, sender_id: senderId, content: content.trim() })
      .select('id,conversation_id,sender_id,content,created_at').single()
    if (error?.code === '23505') {
      // Retry after a lost response must not duplicate the message.
      const existing = await supabase.from('messages').select('id,conversation_id,sender_id,content,created_at').eq('id', id).single()
      if (existing.error) throw existing.error
      return existing.data as SupportMessage
    }
    if (error) throw error
    return data as SupportMessage
  },
}
