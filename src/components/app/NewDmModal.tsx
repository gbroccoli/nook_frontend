import { useState, useEffect, useCallback } from 'react'
import { useAuthStore } from '@/store/auth'
import { useRoomsStore } from '@/store/rooms'
import { usersApi } from '@/api/users'
import { roomsApi } from '@/api/rooms'
import { friendsApi } from '@/api/friends'
import { ApiError } from '@/api/client'
import type { User } from '@/types/api'

const AVATAR_COLORS = ['#5B8AF5', '#E879A0', '#F59E0B', '#10B981', '#8B5CF6', '#EF4444']

function avatarColor(str: string): string {
  let h = 0
  for (const c of str) h = (h * 31 + c.charCodeAt(0)) | 0
  return AVATAR_COLORS[Math.abs(h) % AVATAR_COLORS.length]
}

interface NewDmModalProps {
  onClose: () => void
  onCreated: (roomId: string) => void
}

export function NewDmModal({ onClose, onCreated }: NewDmModalProps) {
  const currentUser = useAuthStore((s) => s.user)
  const fetchRooms = useRoomsStore((s) => s.fetch)
  const [friends, setFriends] = useState<User[]>([])
  const [loading, setLoading] = useState(true)
  const [selected, setSelected] = useState<User | null>(null)
  const [creating, setCreating] = useState(false)

  useEffect(() => {
    const handler = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose() }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [onClose])

  useEffect(() => {
    if (!currentUser) return
    friendsApi.list().then(async ({ friends: list }) => {
      const users = await Promise.all(
        list.map((f) => {
          const otherId = f.sender_id === currentUser.id ? f.receiver_id : f.sender_id
          return usersApi.getById(otherId)
        })
      )
      setFriends(users)
    }).finally(() => setLoading(false))
  }, [currentUser])

  const findExistingDmRoomId = useCallback((targetUserId: string) => {
    const { rooms, dmUsers } = useRoomsStore.getState()
    const existing = rooms.find((room) => room.type === 'dm' && dmUsers[room.id]?.id === targetUserId)
    return existing?.id
  }, [])

  const handleCreate = async () => {
    if (!selected) return
    setCreating(true)
    try {
      const room = await roomsApi.create({ type: 'dm', user_ids: [selected.id] })
      await fetchRooms()
      onCreated(room.id)
    } catch (err) {
      if (err instanceof ApiError && err.status === 409) {
        let roomId = findExistingDmRoomId(selected.id)
        if (!roomId) {
          await fetchRooms()
          roomId = findExistingDmRoomId(selected.id)
        }
        if (roomId) {
          onCreated(roomId)
          return
        }
      }
    } finally {
      setCreating(false)
    }
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-[2px]"
      onClick={(e) => { if (e.target === e.currentTarget) onClose() }}
    >
      <div className="w-full max-w-sm bg-secondary border border-elevated rounded-2xl shadow-2xl flex flex-col overflow-hidden">
        <div className="px-5 pt-5 pb-3 shrink-0">
          <h2 className="font-pixel text-[18px] font-semibold text-text leading-tight">
            Новое личное сообщение
          </h2>
          <p className="text-text-secondary text-[13px] mt-1">
            Выберите друга
          </p>
        </div>

        <div className="overflow-y-auto px-2 pb-2 max-h-72">
          {loading ? (
            <div className="space-y-1 px-1">
              {[1, 2, 3].map((i) => (
                <div key={i} className="flex items-center gap-3 px-3 py-2.5 rounded-xl">
                  <div className="w-9 h-9 rounded-full bg-elevated animate-pulse shrink-0" />
                  <div className="flex-1 space-y-1.5">
                    <div className="h-3 bg-elevated rounded-full animate-pulse w-24" />
                    <div className="h-2.5 bg-elevated rounded-full animate-pulse w-16" />
                  </div>
                </div>
              ))}
            </div>
          ) : friends.length === 0 ? (
            <p className="text-center text-text-disabled text-[13px] py-8 px-4">
              Список друзей пуст. Сначала добавьте друзей.
            </p>
          ) : (
            friends.map((friend) => {
              const isSelected = selected?.id === friend.id
              const color = avatarColor(friend.id)
              return (
                <button
                  key={friend.id}
                  onClick={() => setSelected(isSelected ? null : friend)}
                  className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-xl transition-colors text-left ${
                    isSelected
                      ? 'bg-primary/15 text-text'
                      : 'hover:bg-elevated/60 text-text-secondary hover:text-text'
                  }`}
                >
                  {friend.avatar_url ? (
                    <img src={friend.avatar_url} alt={friend.display_name} className="w-9 h-9 rounded-full object-cover shrink-0" />
                  ) : (
                    <div
                      className="w-9 h-9 rounded-full flex items-center justify-center text-[15px] font-semibold text-bg shrink-0"
                      style={{ backgroundColor: color }}
                    >
                      {friend.display_name[0]}
                    </div>
                  )}
                  <div className="flex-1 min-w-0">
                    <p className="text-[14px] font-semibold truncate">{friend.display_name}</p>
                    <p className="text-[12px] text-text-disabled truncate">@{friend.username}</p>
                  </div>
                  {isSelected && (
                    <svg className="w-4 h-4 text-primary shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M4.5 12.75l6 6 9-13.5" />
                    </svg>
                  )}
                </button>
              )
            })
          )}
        </div>

        <div className="flex items-center justify-end gap-2 px-5 py-4 border-t border-elevated/50 shrink-0">
          <button
            onClick={onClose}
            className="px-4 py-2 text-[14px] font-medium text-text-secondary hover:text-text transition-colors rounded-lg hover:bg-elevated/50"
          >
            Отмена
          </button>
          <button
            onClick={handleCreate}
            disabled={!selected || creating}
            className="px-5 py-2 bg-primary text-bg text-[14px] font-semibold rounded-xl hover:bg-primary/90 active:scale-[0.98] transition-all disabled:opacity-40 disabled:cursor-not-allowed flex items-center gap-2"
          >
            {creating && (
              <svg className="animate-spin w-3.5 h-3.5" viewBox="0 0 24 24" fill="none">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
              </svg>
            )}
            Создать ЛС
          </button>
        </div>
      </div>
    </div>
  )
}