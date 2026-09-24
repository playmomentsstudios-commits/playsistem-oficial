import { api } from './client'
import type { Order, OrderStatus, PaginatedResponse } from '../types'

export const ordersApi = {
  list: (params?: { status?: OrderStatus; page?: number }) => {
    const q = new URLSearchParams()
    if (params?.status) q.set('status', params.status)
    if (params?.page) q.set('page', String(params.page))
    return api.get<PaginatedResponse<Order>>(`/orders?${q}`)
  },
  get: (id: string) => api.get<Order>(`/orders/${id}`),
  create: (data: Partial<Order>) => api.post<Order>('/orders', data),
  updateStatus: (id: string, status: OrderStatus) =>
    api.patch<Order>(`/orders/${id}/status`, { status }),
  cancel: (id: string) => api.patch<Order>(`/orders/${id}/cancel`, {}),
}
