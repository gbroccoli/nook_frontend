import { create } from 'zustand'
import { roomsApi } from '@/api/rooms'
import { usersApi } from '@/api/users'
import { useAuthStore } from '@/store/auth'
import { usePresenceStore } from '@/store/presence'
import type { Room, User } from '@/types/api'

interface RoomsState {
  rooms: Room[]
  dmUsers: Record<string, User>
  loading: boolean
  fetch: () => Promise<void>
}

export const useRoomsStore = create<RoomsState>((set) => ({
  rooms: [],
  dmUsers: {},
  loading: false,

  fetch: async () => {
    set({ loading: true })
    try {
      const { rooms } = await roomsApi.list()

      const dmRooms = rooms.filter((r) => r.type === 'dm')
      const currentUserId = useAuthStore.getState().user?.id

      const membersResults = await Promise.allSettled(
        dmRooms.map((r) =>
          roomsApi.members(r.id).then((res) => ({ roomId: r.id, members: res.members })),
        ),
      )

      const otherUserIds = new Set<string>()
      const roomToOtherUser: Record<string, string> = {}

      for (const result of membersResults) {
        if (result.status !== 'fulfilled') continue
        const { roomId, members } = result.value
        const other = members.find((m) => m.user_id !== currentUserId)
        if (other) {
          otherUserIds.add(other.user_id)
          roomToOtherUser[roomId] = other.user_id
        }
      }

      const userResults = await Promise.allSettled([...otherUserIds].map((id) => usersApi.getById(id)))

      const usersById: Record<string, User> = {}
      for (const result of userResults) {
        if (result.status === 'fulfilled') {
          usersById[result.value.id] = result.value
        }
      }

      // Seed presence from REST status so indicators are correct before new WS events.
      const presence = usePresenceStore.getState()
      for (const user of Object.values(usersById)) {
        if (user.online === true) presence.setOnline(user.id)
        if (user.online === false) presence.setOffline(user.id)
      }

      const dmUsers: Record<string, User> = {}
      for (const [roomId, userId] of Object.entries(roomToOtherUser)) {
        if (usersById[userId]) {
          dmUsers[roomId] = usersById[userId]
        }
      }

      set({ rooms, dmUsers, loading: false })
    } catch {
      set({ loading: false })
    }
  },
}))
