import { api } from './client'
import type { Product, PaginatedResponse } from '../types'

export const productsApi = {
  list: (params?: { featured?: boolean; categoryId?: string; page?: number }) => {
    const q = new URLSearchParams()
    if (params?.featured) q.set('featured', 'true')
    if (params?.categoryId) q.set('categoryId', params.categoryId)
    if (params?.page) q.set('page', String(params.page))
    return api.get<PaginatedResponse<Product>>(`/products?${q}`)
  },
  get: (slug: string) => api.get<Product>(`/products/${slug}`),
  create: (data: Partial<Product>) => api.post<Product>('/products', data),
  update: (id: string, data: Partial<Product>) => api.put<Product>(`/products/${id}`, data),
  delete: (id: string) => api.delete<void>(`/products/${id}`),
}
