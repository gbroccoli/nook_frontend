import { api } from './client'
import type { Room, Member } from '@/types/api'

type CreateRoomPayload =
  | { type: 'dm'; user_ids: [string] }
  | { type: 'group'; name: string; user_ids?: string[] }

export const roomsApi = {
  list: () =>
    api.get<{ rooms: Room[] }>('/rooms'),

  get: (id: string) =>
    api.get<Room>(`/rooms/${id}`),

  create: (data: CreateRoomPayload) =>
    api.post<Room>('/rooms', data),

  update: (id: string, data: { name?: string; avatar_url?: string }) =>
    api.patch<Room>(`/rooms/${id}`, data),

  delete: (id: string) =>
    api.delete<void>(`/rooms/${id}`),

  members: (id: string) =>
    api.get<{ members: Member[] }>(`/rooms/${id}/members`),

  addMember: (id: string, userId: string) =>
    api.post<Member>(`/rooms/${id}/members`, { user_id: userId }),

  read: (id: string) =>
    api.post<void>(`/rooms/${id}/read`, {}),

  removeMember: (id: string, userId: string) =>
    api.delete<void>(`/rooms/${id}/members/${userId}`),
}
