import { api } from './client'
import type { User, LoginPayload, RegisterPayload } from '../types'

export const authApi = {
  login: (payload: LoginPayload) =>
    api.post<{ token: string; user: User }>('/auth/login', payload),

  register: (payload: RegisterPayload) =>
    api.post<{ token: string; user: User }>('/auth/register', payload),

  me: () => api.get<User>('/auth/me'),

  logout: () => api.post<void>('/auth/logout', {}),

  forgotPassword: (email: string) =>
    api.post<void>('/auth/forgot-password', { email }),

  resetPassword: (token: string, password: string) =>
    api.post<void>('/auth/reset-password', { token, password }),
}
