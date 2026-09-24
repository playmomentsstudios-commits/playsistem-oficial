import { api } from './client'
import type { SiteSettings } from '../types'

export const settingsApi = {
  get: () => api.get<SiteSettings>('/settings'),
  update: (data: Partial<SiteSettings>) => api.put<SiteSettings>('/settings', data),
}
