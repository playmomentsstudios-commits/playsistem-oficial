import { api } from './client'
import type { Service, PaginatedResponse } from '../types'

export const servicesApi = {
  list: (params?: { featured?: boolean; categoryId?: string }) => {
    const q = new URLSearchParams()
    if (params?.featured) q.set('featured', 'true')
    if (params?.categoryId) q.set('categoryId', params.categoryId)
    return api.get<PaginatedResponse<Service>>(`/services?${q}`)
  },
  get: (slug: string) => api.get<Service>(`/services/${slug}`),
  create: (data: Partial<Service>) => api.post<Service>('/services', data),
  update: (id: string, data: Partial<Service>) => api.put<Service>(`/services/${id}`, data),
  delete: (id: string) => api.delete<void>(`/services/${id}`),
}
