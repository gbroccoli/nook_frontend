import { api } from './client'
import type { User, Session } from '@/types/api'

export const usersApi = {
  // Свой профиль
  me: () =>
    api.get<User>('/users/me'),

  // Обновить профиль (все поля опциональны)
  updateMe: (data: { display_name?: string; avatar_url?: string }) =>
    api.patch<User>('/users/me', data),

  // Загрузить аватар (multipart/form-data)
  uploadAvatar: (blob: Blob) => {
    const form = new FormData()
    form.append('avatar', blob, 'avatar.jpg')
    return api.postForm<User>('/users/me/avatar', form)
  },

  // Список активных сессий
  sessions: () =>
    api.get<{ sessions: Session[] }>('/users/me/sessions'),

  // Найти пользователя по username
  getByUsername: (username: string) =>
    api.get<User>(`/users?username=${encodeURIComponent(username)}`),

  // Профиль пользователя по ID
  getById: (id: string) =>
    api.get<User>(`/users/${id}`),

  // Зарегистрировать FCM-токен устройства
  registerPushToken: (token: string, hwid: string) =>
    api.post<void>('/users/me/push-token', { token, hwid }),

  // Удалить FCM-токен устройства
  removePushToken: (hwid: string) =>
    api.delete<void>(`/users/me/push-token?hwid=${encodeURIComponent(hwid)}`),
}
