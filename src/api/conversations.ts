import { api } from './client'
import type { Conversation, Message, PaginatedResponse } from '../types'

export const conversationsApi = {
  list: () => api.get<Conversation[]>('/conversations'),
  get: (id: string) => api.get<Conversation>(`/conversations/${id}`),
  create: (customerId: string) =>
    api.post<Conversation>('/conversations', { customerId }),

  messages: (conversationId: string, before?: string) => {
    const q = new URLSearchParams()
    if (before) q.set('before', before)
    return api.get<PaginatedResponse<Message>>(`/conversations/${conversationId}/messages?${q}`)
  },
  send: (conversationId: string, payload: {
    content: string
    type?: string
    replyTo?: string
  }) => api.post<Message>(`/conversations/${conversationId}/messages`, payload),

  markRead: (conversationId: string) =>
    api.post<void>(`/conversations/${conversationId}/read`, {}),
}
