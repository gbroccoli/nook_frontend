import { useState, useRef, useEffect, useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import { friendsApi } from '@/api/friends'
import { usersApi } from '@/api/users'
import { roomsApi } from '@/api/rooms'
import { ApiError } from '@/api/client'
import { useAuthStore } from '@/store/auth'
import { useRoomsStore } from '@/store/rooms'
import { usePresenceStore } from '@/store/presence'
import type { User } from '@/types/api'

// ── Типы ────────────────────────────────────────────────────────────────────

type Tab = 'online' | 'all' | 'pending'

interface FriendEntry {
  requestId: string
  user: User
}

interface PendingEntry {
  requestId: string
  user: User
  direction: 'incoming' | 'outgoing'
}

// ── Хелперы ──────────────────────────────────────────────────────────────────

const AVATAR_COLORS = ['#5B8AF5', '#E879A0', '#F59E0B', '#10B981', '#8B5CF6', '#EF4444']

function avatarColor(str: string): string {
  let h = 0
  for (const c of str) h = (h * 31 + c.charCodeAt(0)) | 0
  return AVATAR_COLORS[Math.abs(h) % AVATAR_COLORS.length]
}

// ── Иконки ──────────────────────────────────────────────────────────────────

function IconFriends() {
  return (
    <svg className="w-5 h-5 text-text-disabled shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M15 19.128a9.38 9.38 0 002.625.372 9.337 9.337 0 004.121-.952 4.125 4.125 0 00-7.533-2.493M15 19.128v-.003c0-1.113-.285-2.16-.786-3.07M15 19.128v.106A12.318 12.318 0 018.624 21c-2.331 0-4.512-.645-6.374-1.766l-.001-.109a6.375 6.375 0 0111.964-3.07M12 6.375a3.375 3.375 0 11-6.75 0 3.375 3.375 0 016.75 0zm8.25 2.25a2.625 2.625 0 11-5.25 0 2.625 2.625 0 015.25 0z" />
    </svg>
  )
}

function IconCheck() {
  return (
    <svg className="w-[18px] h-[18px]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M4.5 12.75l6 6 9-13.5" />
    </svg>
  )
}

function IconX() {
  return (
    <svg className="w-[18px] h-[18px]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
    </svg>
  )
}

function IconClose() {
  return (
    <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
    </svg>
  )
}

// ── Модальное окно профиля друга ────────────────────────────────────────────

function FriendProfileModal({
  user,
  isOnline,
  onClose,
  onMessage,
}: {
  user: User
  isOnline: boolean
  onClose: () => void
  onMessage: () => void
}) {
  const color = avatarColor(user.username)

  useEffect(() => {
    const handler = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose() }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [onClose])

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-[2px]"
      onClick={(e) => { if (e.target === e.currentTarget) onClose() }}
    >
      <div className="w-full max-w-md bg-secondary border border-elevated rounded-2xl shadow-2xl overflow-hidden">
        <div className="px-6 pt-6 pb-4 flex items-start justify-between">
          <div>
            <h2 className="font-pixel text-[22px] font-semibold text-text leading-[1.1]">
              Профиль друга
            </h2>
            <p className="text-text-secondary text-[13px] mt-1.5">
              Информация о пользователе
            </p>
          </div>
          <button onClick={onClose} className="text-text-disabled hover:text-text transition-colors ml-4 mt-0.5">
            <IconClose />
          </button>
        </div>

        <div className="px-6 pb-6">
          <div className="flex items-center gap-4 p-4 rounded-xl border border-elevated bg-bg/35">
            <div className="relative shrink-0">
              {user.avatar_url ? (
                <img src={user.avatar_url} alt={user.display_name} className="w-16 h-16 rounded-full object-cover" />
              ) : (
                <div
                  className="w-16 h-16 rounded-full flex items-center justify-center text-[22px] font-semibold text-bg"
                  style={{ backgroundColor: color }}
                >
                  {user.display_name[0]?.toUpperCase() ?? '?'}
                </div>
              )}
              <span className={`absolute -bottom-1 -right-1 w-4 h-4 rounded-full border-2 border-secondary ${isOnline ? 'bg-success' : 'bg-text-disabled'}`} />
            </div>
            <div className="min-w-0">
              <p className="text-[18px] font-semibold text-text truncate">{user.display_name}</p>
              <p className="text-[14px] text-text-secondary truncate">@{user.username}</p>
              <p className={`text-[12px] mt-1 ${isOnline ? 'text-success' : 'text-text-disabled'}`}>
                {isOnline ? 'В сети' : 'Не в сети'}
              </p>
            </div>
          </div>

          <div className="flex items-center justify-end gap-3 mt-4">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-[14px] font-medium text-text-secondary hover:text-text transition-colors"
            >
              Закрыть
            </button>
            <button
              type="button"
              onClick={onMessage}
              className="px-5 py-2 bg-primary text-bg text-[14px] font-semibold rounded-xl hover:bg-primary-hover active:scale-[0.98] transition-all shadow-[0_0_16px_rgba(0,245,160,0.2)]"
            >
              Написать
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}

// ── Скелетон загрузки ────────────────────────────────────────────────────────

function Skeleton() {
  return (
    <div className="space-y-1 px-2">
      {[1, 2, 3].map((i) => (
        <div key={i} className="flex items-center gap-4 px-3 py-3 rounded-lg">
          <div className="w-9 h-9 rounded-full bg-elevated animate-pulse shrink-0" />
          <div className="flex-1 space-y-2">
            <div className="h-3 bg-elevated rounded-full animate-pulse w-28" />
            <div className="h-2.5 bg-elevated rounded-full animate-pulse w-16" />
          </div>
        </div>
      ))}
    </div>
  )
}

// ── Вкладка ──────────────────────────────────────────────────────────────────

function TabBtn({ active, onClick, badge, children }: {
  active: boolean
  onClick: () => void
  badge?: number
  children: React.ReactNode
}) {
  return (
    <button
      onClick={onClick}
      className={`relative px-3 py-[5px] rounded text-[14px] font-medium transition-colors ${
        active
          ? 'bg-elevated text-text'
          : 'text-text-secondary hover:bg-elevated/50 hover:text-text'
      }`}
    >
      {children}
      {badge != null && badge > 0 && (
        <span className="absolute -top-1 -right-1 min-w-[16px] h-4 px-1 bg-error rounded-full text-[10px] font-bold text-bg flex items-center justify-center leading-none">
          {badge}
        </span>
      )}
    </button>
  )
}

// ── Карточка друга ───────────────────────────────────────────────────────────

function FriendRow({
  entry,
  onMessage,
  onOpenProfile,
  isOnline,
}: {
  entry: FriendEntry
  onMessage: (userId: string) => void
  onOpenProfile: (user: User) => void
  isOnline: boolean
}) {
  const { user } = entry
  const color = avatarColor(user.username)
  return (
    <div
      onClick={() => onOpenProfile(user)}
      className="flex items-center px-3 py-3 rounded-lg hover:bg-elevated/50 cursor-pointer group transition-colors border-t border-elevated/20 first:border-t-0"
    >
      <div className="relative mr-4 shrink-0">
        {user.avatar_url ? (
          <img src={user.avatar_url} alt={user.display_name} className="w-9 h-9 rounded-full object-cover" />
        ) : (
          <div
            className="w-9 h-9 rounded-full flex items-center justify-center text-[15px] font-semibold text-bg"
            style={{ backgroundColor: color }}
          >
            {user.display_name[0]}
          </div>
        )}
        {isOnline && (
          <span className="absolute -bottom-0.5 -right-0.5 w-3 h-3 rounded-full bg-success border-2 border-secondary" />
        )}
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-[15px] font-semibold text-text truncate">{user.display_name}</p>
        <p className="text-[13px] text-text-disabled truncate">@{user.username}</p>
      </div>
      <div className="flex items-center gap-2 shrink-0">
        <button
          title="Открыть чат"
          onClick={(e) => {
            e.stopPropagation()
            onMessage(user.id)
          }}
          className="px-3 h-8 rounded-lg bg-primary/15 text-primary hover:bg-primary/25 transition-colors text-[13px] font-semibold"
        >
          Чат
        </button>
      </div>
    </div>
  )
}

function PendingRow({ entry, onAccept, onDecline, disabled }: {
  entry: PendingEntry
  onAccept?: () => void
  onDecline: () => void
  disabled: boolean
}) {
  const { user, direction } = entry
  const color = avatarColor(user.username)
  return (
    <div className="flex items-center px-3 py-3 rounded-lg hover:bg-elevated/50 group transition-colors border-t border-elevated/20 first:border-t-0">
      <div className="relative mr-4 shrink-0">
        {user.avatar_url ? (
          <img src={user.avatar_url} alt={user.display_name} className="w-9 h-9 rounded-full object-cover" />
        ) : (
          <div
            className="w-9 h-9 rounded-full flex items-center justify-center text-[15px] font-semibold text-bg"
            style={{ backgroundColor: color }}
          >
            {user.display_name[0]}
          </div>
        )}
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-[15px] font-semibold text-text truncate">{user.display_name}</p>
        <p className="text-[13px] text-text-disabled truncate">
          {direction === 'incoming' ? 'Входящая заявка' : 'Исходящая заявка'} · @{user.username}
        </p>
      </div>
      <div className="flex items-center gap-2 shrink-0">
        {direction === 'incoming' && (
          <button
            title="Принять"
            onClick={onAccept}
            disabled={disabled}
            className="w-9 h-9 rounded-full bg-bg flex items-center justify-center text-success hover:bg-success/20 transition-colors disabled:opacity-40"
          >
            <IconCheck />
          </button>
        )}
        <button
          title={direction === 'incoming' ? 'Отклонить' : 'Отозвать'}
          onClick={onDecline}
          disabled={disabled}
          className="w-9 h-9 rounded-full bg-bg flex items-center justify-center text-text-secondary hover:text-error hover:bg-error/10 transition-colors disabled:opacity-40"
        >
          <IconX />
        </button>
      </div>
    </div>
  )
}

// ── Модальное окно «Добавить в друзья» ──────────────────────────────────────

function AddFriendModal({ onClose, onSuccess }: {
  onClose: () => void
  onSuccess: () => void
}) {
  const [username, setUsername] = useState('')
  const [status, setStatus] = useState<'idle' | 'loading' | 'success' | 'error'>('idle')
  const [errorMsg, setErrorMsg] = useState('')
  const inputRef = useRef<HTMLInputElement>(null)

  useEffect(() => { inputRef.current?.focus() }, [])

  useEffect(() => {
    const handler = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose() }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [onClose])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    const trimmed = username.trim()
    if (!trimmed) return

    setStatus('loading')
    setErrorMsg('')

    try {
      const user = await usersApi.getByUsername(trimmed)
      await friendsApi.sendRequest(user.id)
      setStatus('success')
      onSuccess()
    } catch (err) {
      setStatus('error')
      if (err instanceof ApiError) {
        if (err.status === 404)       setErrorMsg(`Пользователь «@${trimmed}» не найден.`)
        else if (err.status === 400)  setErrorMsg('Нельзя добавить самого себя в друзья.')
        else if (err.status === 409)  setErrorMsg('Заявка уже отправлена или вы уже друзья.')
        else                          setErrorMsg('Ошибка сервера. Попробуйте позже.')
      } else {
        setErrorMsg('Не удалось подключиться к серверу.')
      }
    }
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-[2px]"
      onClick={(e) => { if (e.target === e.currentTarget) onClose() }}
    >
      <div className="w-full max-w-md bg-secondary border border-elevated rounded-2xl shadow-2xl overflow-hidden">
        <div className="px-6 pt-6 pb-4 flex items-start justify-between">
          <div>
            <h2 className="font-pixel text-[22px] font-semibold text-text leading-[1.1]">
              Добавить в друзья
            </h2>
            <p className="text-text-secondary text-[13px] mt-1.5">
              Введите имя пользователя, чтобы отправить заявку.
            </p>
          </div>
          <button onClick={onClose} className="text-text-disabled hover:text-text transition-colors ml-4 mt-0.5">
            <IconClose />
          </button>
        </div>

        <div className="px-6 pb-6">
          <form onSubmit={handleSubmit} className="flex flex-col gap-3">
            <div className={`flex items-center gap-2 bg-bg border rounded-xl px-4 py-3 transition-colors ${
              status === 'error'   ? 'border-error/60 focus-within:border-error' :
              status === 'success' ? 'border-success/60' :
              'border-elevated focus-within:border-primary/50'
            }`}>
              <span className="text-text-disabled text-[15px] font-medium select-none">@</span>
              <input
                ref={inputRef}
                type="text"
                value={username}
                onChange={(e) => {
                  setUsername(e.target.value.toLowerCase())
                  setStatus('idle')
                  setErrorMsg('')
                }}
                placeholder="имя_пользователя"
                className="flex-1 bg-transparent text-[15px] text-text placeholder:text-text-disabled outline-none"
                disabled={status === 'loading' || status === 'success'}
              />
              {status === 'loading' && (
                <svg className="animate-spin w-4 h-4 text-primary shrink-0" viewBox="0 0 24 24" fill="none">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                </svg>
              )}
              {status === 'success' && (
                <svg className="w-4 h-4 text-success shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M4.5 12.75l6 6 9-13.5" />
                </svg>
              )}
            </div>

            {status === 'error' && (
              <p className="text-[13px] text-error bg-error/10 border border-error/20 rounded-lg px-3 py-2">
                {errorMsg}
              </p>
            )}
            {status === 'success' && (
              <p className="text-[13px] text-success bg-success/10 border border-success/20 rounded-lg px-3 py-2">
                Заявка в друзья отправлена!
              </p>
            )}

            <div className="flex items-center justify-end gap-3 mt-1">
              <button type="button" onClick={onClose} className="px-4 py-2 text-[14px] font-medium text-text-secondary hover:text-text transition-colors">
                Отмена
              </button>
              <button
                type="submit"
                disabled={username.trim().length < 2 || status === 'loading'}
                className="px-5 py-2 bg-primary text-bg text-[14px] font-semibold rounded-xl hover:bg-primary-hover active:scale-[0.98] transition-all disabled:opacity-40 disabled:cursor-not-allowed disabled:pointer-events-none shadow-[0_0_16px_rgba(0,245,160,0.2)]"
              >
                Отправить заявку
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  )
}

// ── HomePage ─────────────────────────────────────────────────────────────────

export function HomePage() {
  const currentUser = useAuthStore((s) => s.user)
  const navigate = useNavigate()
  const fetchRooms = useRoomsStore((s) => s.fetch)
  const online = usePresenceStore((s) => s.online)

  const [tab, setTab] = useState<Tab>('online')
  const [showAddFriend, setShowAddFriend] = useState(false)
  const [profileUser, setProfileUser] = useState<User | null>(null)

  const [friends, setFriends] = useState<FriendEntry[]>([])
  const [incoming, setIncoming] = useState<PendingEntry[]>([])
  const [outgoing, setOutgoing] = useState<PendingEntry[]>([])
  const [loading, setLoading] = useState(true)
  const [actionLoading, setActionLoading] = useState<string | null>(null)

  const loadData = useCallback(async () => {
    if (!currentUser) return
    setLoading(true)
    try {
      const [friendsRes, pendingRes] = await Promise.all([
        friendsApi.list(),
        friendsApi.pending(),
      ])

      // Обогащаем список друзей данными пользователей
      const enrichedFriends = await Promise.all(
        friendsRes.friends.map(async (f) => {
          const otherId = f.sender_id === currentUser.id ? f.receiver_id : f.sender_id
          const user = await usersApi.getById(otherId)
          return { requestId: f.id, user }
        })
      )

      const presence = usePresenceStore.getState()
      for (const { user } of enrichedFriends) {
        if (user.online === true) {
          presence.setOnline(user.id)
        } else {
          // Treat absent/false as offline to avoid stale online flags in the "Online" tab.
          presence.setOffline(user.id)
        }
      }

      setFriends(enrichedFriends)

      // Обогащаем входящие заявки
      const enrichedIncoming = await Promise.all(
        pendingRes.incoming.map(async (f) => {
          const user = await usersApi.getById(f.sender_id)
          return { requestId: f.id, user, direction: 'incoming' as const }
        })
      )
      setIncoming(enrichedIncoming)

      // Обогащаем исходящие заявки
      const enrichedOutgoing = await Promise.all(
        pendingRes.outgoing.map(async (f) => {
          const user = await usersApi.getById(f.receiver_id)
          return { requestId: f.id, user, direction: 'outgoing' as const }
        })
      )
      setOutgoing(enrichedOutgoing)
    } catch {
      // Ошибки загрузки не критичны — просто покажем пустые списки
    } finally {
      setLoading(false)
    }
  }, [currentUser])

  useEffect(() => { loadData() }, [loadData])

  const handleAccept = async (requestId: string) => {
    setActionLoading(requestId)
    try {
      await friendsApi.accept(requestId)
      await loadData()
    } finally {
      setActionLoading(null)
    }
  }

  const handleDecline = async (requestId: string) => {
    setActionLoading(requestId)
    try {
      await friendsApi.remove(requestId)
      await loadData()
    } finally {
      setActionLoading(null)
    }
  }

  const findExistingDmRoomId = useCallback((targetUserId: string) => {
    const { rooms, dmUsers } = useRoomsStore.getState()
    const existing = rooms.find((room) => room.type === 'dm' && dmUsers[room.id]?.id === targetUserId)
    return existing?.id
  }, [])

  const handleMessage = async (userId: string) => {
    try {
      const room = await roomsApi.create({ type: 'dm', user_ids: [userId] })
      await fetchRooms()
      navigate(`/app/dm/${room.id}`)
    } catch (err) {
      if (err instanceof ApiError && err.status === 409) {
        let roomId = findExistingDmRoomId(userId)
        if (!roomId) {
          await fetchRooms()
          roomId = findExistingDmRoomId(userId)
        }
        if (roomId) {
          navigate(`/app/dm/${roomId}`)
        }
      }
    }
  }

  const handleOpenProfile = (user: User) => {
    setProfileUser(user)
  }

  const handleProfileMessage = async () => {
    if (!profileUser) return
    const userId = profileUser.id
    setProfileUser(null)
    await handleMessage(userId)
  }

  const pendingCount = incoming.length
  const visibleFriends = tab === 'online'
    ? friends.filter((entry) => online.has(entry.user.id))
    : friends

  return (
    <>
      <div className="flex-1 flex flex-col overflow-hidden">

        {/* Хедер */}
        <div className="h-12 px-4 flex items-center gap-2 border-b border-elevated shadow-[0_1px_3px_rgba(0,0,0,0.3)] shrink-0">
          <IconFriends />
          <span className="font-semibold text-text text-[15px]">Друзья</span>
          <div className="w-px h-4 bg-elevated mx-1" />
          <nav className="flex items-center gap-1">
            <TabBtn active={tab === 'online'}  onClick={() => setTab('online')}>В сети</TabBtn>
            <TabBtn active={tab === 'all'}     onClick={() => setTab('all')}>Все</TabBtn>
            <TabBtn active={tab === 'pending'} onClick={() => setTab('pending')} badge={pendingCount}>
              Входящие
            </TabBtn>
          </nav>
          <button
            onClick={() => setShowAddFriend(true)}
            className="ml-2 px-3 py-[5px] bg-success/15 text-success hover:bg-success/25 rounded text-[14px] font-medium transition-colors"
          >
            Добавить в друзья
          </button>
        </div>

        {/* Контент */}
        <div className="flex-1 overflow-y-auto px-4 py-4">

          {loading ? (
            <Skeleton />
          ) : (
            <>
              {/* Вкладки "В сети" и "Все" */}
              {(tab === 'online' || tab === 'all') && (
                visibleFriends.length > 0 ? (
                  <>
                    <p className="text-[11px] font-semibold text-text-disabled uppercase tracking-[0.9px] mb-2 px-2">
                      {tab === 'online' ? `В сети — ${visibleFriends.length}` : `Все — ${visibleFriends.length}`}
                    </p>
                    <div>
                      {visibleFriends.map((entry) => (
                        <FriendRow
                          key={entry.requestId}
                          entry={entry}
                          onMessage={handleMessage}
                          onOpenProfile={handleOpenProfile}
                          isOnline={online.has(entry.user.id)}
                        />
                      ))}
                    </div>
                  </>
                ) : (
                  <div className="flex flex-col items-center justify-center h-full py-16 text-center gap-2">
                    <p className="text-text font-semibold text-[15px]">
                      {tab === 'online' ? 'Никого нет онлайн' : 'Список друзей пуст'}
                    </p>
                    <p className="text-text-disabled text-[13px]">
                      {tab === 'online'
                        ? 'Когда друзья появятся в сети — они отобразятся здесь.'
                        : 'Добавьте друзей, нажав кнопку «Добавить в друзья».'}
                    </p>
                  </div>
                )
              )}

              {/* Вкладка "Входящие" */}
              {tab === 'pending' && (
                incoming.length === 0 && outgoing.length === 0 ? (
                  <div className="flex flex-col items-center justify-center h-full py-16 text-center gap-2">
                    <p className="text-text font-semibold text-[15px]">Нет заявок</p>
                    <p className="text-text-disabled text-[13px]">Здесь появятся входящие и исходящие заявки.</p>
                  </div>
                ) : (
                  <div className="space-y-6">
                    {incoming.length > 0 && (
                      <div>
                        <p className="text-[11px] font-semibold text-text-disabled uppercase tracking-[0.9px] mb-2 px-2">
                          Входящие — {incoming.length}
                        </p>
                        {incoming.map((entry) => (
                          <PendingRow
                            key={entry.requestId}
                            entry={entry}
                            onAccept={() => handleAccept(entry.requestId)}
                            onDecline={() => handleDecline(entry.requestId)}
                            disabled={actionLoading === entry.requestId}
                          />
                        ))}
                      </div>
                    )}
                    {outgoing.length > 0 && (
                      <div>
                        <p className="text-[11px] font-semibold text-text-disabled uppercase tracking-[0.9px] mb-2 px-2">
                          Исходящие — {outgoing.length}
                        </p>
                        {outgoing.map((entry) => (
                          <PendingRow
                            key={entry.requestId}
                            entry={entry}
                            onDecline={() => handleDecline(entry.requestId)}
                            disabled={actionLoading === entry.requestId}
                          />
                        ))}
                      </div>
                    )}
                  </div>
                )
              )}
            </>
          )}

        </div>
      </div>

      {showAddFriend && (
        <AddFriendModal
          onClose={() => setShowAddFriend(false)}
          onSuccess={() => {
            setShowAddFriend(false)
            setTab('pending')
            loadData()
          }}
        />
      )}
      {profileUser && (
        <FriendProfileModal
          user={profileUser}
          isOnline={online.has(profileUser.id)}
          onClose={() => setProfileUser(null)}
          onMessage={() => void handleProfileMessage()}
        />
      )}
    </>
  )
}



