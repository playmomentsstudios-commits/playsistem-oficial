import { api } from './client'
import type { Post, PaginatedResponse } from '../types'

export const postsApi = {
  list: (params?: { page?: number; limit?: number }) => {
    const q = new URLSearchParams()
    if (params?.page) q.set('page', String(params.page))
    if (params?.limit) q.set('limit', String(params.limit))
    return api.get<PaginatedResponse<Post>>(`/posts?${q}`)
  },
  get: (id: string) => api.get<Post>(`/posts/${id}`),
  create: (data: Partial<Post>) => api.post<Post>('/posts', data),
  update: (id: string, data: Partial<Post>) => api.put<Post>(`/posts/${id}`, data),
  delete: (id: string) => api.delete<void>(`/posts/${id}`),
  react: (postId: string, emoji: string) =>
    api.post<{ reactions: Record<string, number> }>(`/posts/${postId}/reactions`, { emoji }),
}
