import { api } from './client'
import type { FriendRequest } from '@/types/api'

export const friendsApi = {
  // Отправить заявку в друзья
  sendRequest: (userId: string) =>
    api.post<FriendRequest>('/friends/request', { user_id: userId }),

  // Список принятых друзей
  list: () =>
    api.get<{ friends: FriendRequest[] }>('/friends'),

  // Входящие и исходящие заявки
  pending: () =>
    api.get<{ incoming: FriendRequest[]; outgoing: FriendRequest[] }>('/friends/pending'),

  // Принять заявку
  accept: (id: string) =>
    api.patch<FriendRequest>(`/friends/${id}/accept`),

  // Заблокировать
  block: (id: string) =>
    api.post<FriendRequest>(`/friends/${id}/block`),

  // Удалить / отклонить / отозвать заявку
  remove: (id: string) =>
    api.delete<void>(`/friends/${id}`),
}
