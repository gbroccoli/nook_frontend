import { api } from './client'
import type { AuthResponse } from '@/types/api'

export const authApi = {
  checkSetup: () =>
    api.get<{ initialized: boolean }>('/setup'),

  setup: (data: {
    username: string
    display_name: string
    password: string
    hwid: string
  }) => api.post<AuthResponse>('/setup', data),

  register: (data: {
    username: string
    display_name: string
    password: string
    hwid: string
  }) => api.post<AuthResponse>('/auth/register', data),

  login: (data: {
    username: string
    password: string
    hwid: string
  }) => api.post<AuthResponse>('/auth/login', data),

  refresh: (refreshToken: string) =>
    api.post<AuthResponse>('/auth/refresh', { refresh_token: refreshToken }),

  logout: () =>
    api.delete<void>('/auth/logout'),

  logoutAll: () =>
    api.delete<void>('/auth/logout/all'),
}
