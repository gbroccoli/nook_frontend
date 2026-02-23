import { useState, useEffect, useCallback, useMemo, useRef } from 'react'
import { Outlet, NavLink, useLocation, useNavigate } from 'react-router-dom'
import { useAuthStore } from '@/store/auth'
import { useRoomsStore } from '@/store/rooms'
import { usePresenceStore } from '@/store/presence'
import { connect, disconnect, subscribe } from '@/store/ws'
import { useCallStore } from '@/store/call'
import { callsApi } from '@/api/calls'
import { usersApi } from '@/api/users'
import { roomsApi } from '@/api/rooms'
import { friendsApi } from '@/api/friends'
import { ApiError } from '@/api/client'
import { Logo } from '@/components/ui/Logo'
import { AudioSettingsPanel } from '@/components/AudioSettingsPanel'
import { SettingsModal } from '@/pages/app/SettingsPage'
import { getHwid } from '@/lib/hwid'
import { getFcmToken, onForegroundFcmMessage, requestNotificationPermission, showBrowserNotification } from '@/lib/notifications'
import { useToastsStore } from '@/store/toasts'
import { ToastContainer } from '@/components/ToastContainer'
import type { User } from '@/types/api'

// ── Цвет аватара (детерминированный по строке) ────────────────────────────────

const AVATAR_COLORS = ['#5B8AF5', '#E879A0', '#F59E0B', '#10B981', '#8B5CF6', '#EF4444']
const PENDING_CALL_ACCEPT_KEY = 'pending_call_accept'

interface CallIncomingPayload {
  call_id?: string
  callId?: string
  id?: string
  room_id?: string
  roomId?: string
  call?: {
    id?: string
    room_id?: string
    roomId?: string
    caller_id?: string
    callerId?: string
  }
  caller?: {
    id?: string
    username?: string
    display_name?: string
    avatar_url?: string
  }
}

interface GlobalIncomingCallState {
  id: string
  roomId: string
  caller?: {
    id?: string
    username?: string
    display_name?: string
    avatar_url?: string
  }
}

function resolveCallId(payload: {
  call_id?: string
  callId?: string
  id?: string
  call?: { id?: string }
}) {
  return payload.call_id ?? payload.callId ?? payload.id ?? payload.call?.id
}

function resolveCallRoomId(payload: {
  room_id?: string
  roomId?: string
  call?: { room_id?: string; roomId?: string }
}) {
  return payload.room_id ?? payload.roomId ?? payload.call?.room_id ?? payload.call?.roomId
}

function roomColor(str: string): string {
  let h = 0
  for (const c of str) h = (h * 31 + c.charCodeAt(0)) | 0
  return AVATAR_COLORS[Math.abs(h) % AVATAR_COLORS.length]
}

// ── Иконки ──────────────────────────────────────────────────────────────────

function IconMic() {
  return (
    <svg className="w-[18px] h-[18px]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M12 18.75a6 6 0 006-6v-1.5m-6 7.5a6 6 0 01-6-6v-1.5m6 7.5v3.75m-3.75 0h7.5M12 15.75a3 3 0 01-3-3V4.5a3 3 0 116 0v8.25a3 3 0 01-3 3z" />
    </svg>
  )
}

function IconHeadphone() {
  return (
    <svg className="w-[18px] h-[18px]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M19.114 5.636a9 9 0 010 12.728M16.463 8.288a5.25 5.25 0 010 7.424M6.75 8.25l4.72-4.72a.75.75 0 011.28.53v15.88a.75.75 0 01-1.28.53l-4.72-4.72H4.51c-.88 0-1.704-.507-1.938-1.354A9.01 9.01 0 012.25 12c0-.83.112-1.633.322-2.396C2.806 8.756 3.63 8.25 4.51 8.25H6.75z" />
    </svg>
  )
}

function IconSettings() {
  return (
    <svg className="w-[18px] h-[18px]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M9.594 3.94c.09-.542.56-.94 1.11-.94h2.593c.55 0 1.02.398 1.11.94l.213 1.281c.063.374.313.686.645.87.074.04.147.083.22.127.324.196.72.257 1.075.124l1.217-.456a1.125 1.125 0 011.37.49l1.296 2.247a1.125 1.125 0 01-.26 1.431l-1.003.827c-.293.24-.438.613-.431.992a6.759 6.759 0 010 .255c-.007.378.138.75.43.99l1.005.828c.424.35.534.954.26 1.43l-1.298 2.247a1.125 1.125 0 01-1.369.491l-1.217-.456c-.355-.133-.75-.072-1.076.124a6.57 6.57 0 01-.22.128c-.331.183-.581.495-.644.869l-.213 1.28c-.09.543-.56.941-1.11.941h-2.594c-.55 0-1.02-.398-1.11-.94l-.213-1.281c-.062-.374-.312-.686-.644-.87a6.52 6.52 0 01-.22-.127c-.325-.196-.72-.257-1.076-.124l-1.217.456a1.125 1.125 0 01-1.369-.49l-1.297-2.247a1.125 1.125 0 01.26-1.431l1.004-.827c.292-.24.437-.613.43-.992a6.932 6.932 0 010-.255c.007-.378-.138-.75-.43-.99l-1.004-.828a1.125 1.125 0 01-.26-1.43l1.297-2.247a1.125 1.125 0 011.37-.491l1.216.456c.356.133.751.072 1.076-.124.072-.044.146-.087.22-.128.332-.183.582-.495.644-.869l.214-1.281z" />
      <path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
    </svg>
  )
}

function IconFriends() {
  return (
    <svg className="w-5 h-5 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M15 19.128a9.38 9.38 0 002.625.372 9.337 9.337 0 004.121-.952 4.125 4.125 0 00-7.533-2.493M15 19.128v-.003c0-1.113-.285-2.16-.786-3.07M15 19.128v.106A12.318 12.318 0 018.624 21c-2.331 0-4.512-.645-6.374-1.766l-.001-.109a6.375 6.375 0 0111.964-3.07M12 6.375a3.375 3.375 0 11-6.75 0 3.375 3.375 0 016.75 0zm8.25 2.25a2.625 2.625 0 11-5.25 0 2.625 2.625 0 015.25 0z" />
    </svg>
  )
}

function IconGroup() {
  return (
    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M18 18.72a9.094 9.094 0 003.741-.479 3 3 0 00-4.682-2.72m.94 3.198l.001.031c0 .225-.012.447-.037.666A11.944 11.944 0 0112 21c-2.17 0-4.207-.576-5.963-1.584A6.062 6.062 0 016 18.719m12 0a5.971 5.971 0 00-.941-3.197m0 0A5.995 5.995 0 0012 12.75a5.995 5.995 0 00-5.058 2.772m0 0a3 3 0 00-4.681 2.72 8.986 8.986 0 003.74.477m.94-3.197a5.971 5.971 0 00-.94 3.197M15 6.75a3 3 0 11-6 0 3 3 0 016 0zm6 3a2.25 2.25 0 11-4.5 0 2.25 2.25 0 014.5 0zm-13.5 0a2.25 2.25 0 11-4.5 0 2.25 2.25 0 014.5 0z" />
    </svg>
  )
}

// ── Индикатор пинга звонка ────────────────────────────────────────────────────

function PingBar() {
  const inCall = useCallStore((s) => s.inCall)
  const ping = useCallStore((s) => s.ping)

  if (!inCall) return null

  const color =
    ping === null ? 'text-text-disabled' :
    ping <= 80    ? 'text-success' :
    ping <= 150   ? 'text-amber-400' :
                    'text-error'

  const dotColor =
    ping === null ? 'bg-text-disabled' :
    ping <= 80    ? 'bg-success' :
    ping <= 150   ? 'bg-amber-400' :
                    'bg-error'

  return (
    <div className="px-3 py-2 shrink-0 flex items-center gap-2 border-t border-black/20">
      <span className={`w-2 h-2 rounded-full shrink-0 animate-pulse ${dotColor}`} />
      <span className="text-[11px] text-text-disabled">Пинг звонка</span>
      <span className={`ml-auto text-[12px] font-semibold tabular-nums ${color}`}>
        {ping === null ? '…' : `${ping} мс`}
      </span>
    </div>
  )
}

// ── Модалка «Новое личное сообщение» ─────────────────────────────────────────

function NewDmModal({ onClose, onCreated }: {
  onClose: () => void
  onCreated: (roomId: string) => void
}) {
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

        {/* Список друзей */}
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
              const color = roomColor(friend.id)
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

        {/* Кнопки */}
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

// ── AppLayout ────────────────────────────────────────────────────────────────

export function AppLayout() {
  const user = useAuthStore((s) => s.user)
  const addToast = useToastsStore((s) => s.add)
  const [settingsOpen, setSettingsOpen] = useState(false)
  const [audioPanelOpen, setAudioPanelOpen] = useState(false)
  const [newDmOpen, setNewDmOpen] = useState(false)
  const [unreadByRoom, setUnreadByRoom] = useState<Record<string, number>>({})
  const [globalIncomingCall, setGlobalIncomingCall] = useState<GlobalIncomingCallState | null>(null)
  const [globalCallBusy, setGlobalCallBusy] = useState(false)
  const [globalCallError, setGlobalCallError] = useState<string | null>(null)
  const baseTitleRef = useRef<string>('')
  const navigate = useNavigate()
  const location = useLocation()

  const { rooms, dmUsers, fetch: fetchRooms } = useRoomsStore()
  const online = usePresenceStore((s) => s.online)
  const activeRoomId = useMemo(() => {
    const match = location.pathname.match(/^\/app\/dm\/([^/?#]+)/)
    return match ? decodeURIComponent(match[1]) : null
  }, [location.pathname])
  const totalUnread = useMemo(
    () => Object.values(unreadByRoom).reduce((sum, value) => sum + value, 0),
    [unreadByRoom],
  )

  useEffect(() => {
    if (!baseTitleRef.current) {
      baseTitleRef.current = document.title
    }
  }, [])

  useEffect(() => {
    connect()
    return () => disconnect()
  }, [])

  useEffect(() => {
    fetchRooms()
  }, [fetchRooms])

  // Разрешение на браузерные уведомления + регистрация FCM-токена
  useEffect(() => {
    void requestNotificationPermission()
    getFcmToken().then((token) => {
      if (!token) return
      usersApi.registerPushToken(token, getHwid()).catch(() => {})
    })
    // Подавляем FCM-уведомления в foreground — WS сам показывает тосты и браузерные уведомления
    const unsubFcm = onForegroundFcmMessage(() => { /* intentionally empty */ })
    return unsubFcm
  }, [])

  useEffect(() => {
    const unsubscribe = subscribe((event) => {
      if (event.type !== 'message.new') return
      const payload = (event.payload ?? {}) as {
        room_id?: string
        roomId?: string
        content?: string
        attachment?: { name?: string }
        message?: { room_id?: string; roomId?: string; author?: { id?: string; username?: string; display_name?: string; avatar_url?: string }; content?: string }
        author?: { id?: string; username?: string; display_name?: string; avatar_url?: string }
      }
      const incomingRoomId =
        payload.room_id ??
        payload.roomId ??
        payload.message?.room_id ??
        payload.message?.roomId
      if (!incomingRoomId) return

      const hasRoom = useRoomsStore.getState().rooms.some((room) => room.id === incomingRoomId)
      if (!hasRoom) {
        void fetchRooms()
      }

      const authorId = payload.author?.id?.trim() ?? payload.message?.author?.id?.trim()
      const authorUsername = payload.author?.username?.trim() ?? payload.message?.author?.username?.trim()
      const isOwnMessage =
        (authorId != null && authorId.length > 0 && authorId === user?.id) ||
        (authorUsername != null && authorUsername.length > 0 && authorUsername === user?.username)

      if (isOwnMessage || activeRoomId === incomingRoomId) return

      setUnreadByRoom((prev) => ({
        ...prev,
        [incomingRoomId]: (prev[incomingRoomId] ?? 0) + 1,
      }))

      // In-app toast + браузерное уведомление
      const author = payload.author ?? payload.message?.author
      const displayName = author?.display_name ?? author?.username ?? 'Сообщение'
      const rawContent = payload.content ?? payload.message?.content
      const body = rawContent
        ? rawContent.length > 80 ? rawContent.slice(0, 77) + '…' : rawContent
        : payload.attachment ? 'Отправил(-а) вложение' : ''
      addToast({
        type: 'message',
        title: displayName,
        body,
        avatarUrl: author?.avatar_url,
        avatarLetter: displayName[0],
        action: () => navigate(`/app/dm/${incomingRoomId}`),
        actionLabel: 'Открыть чат →',
      })
      showBrowserNotification(displayName, {
        body,
        tag: incomingRoomId,
        icon: author?.avatar_url || undefined,
      })
    })

    return unsubscribe
  }, [activeRoomId, addToast, fetchRooms, navigate, user?.id, user?.username])

  useEffect(() => {
    const unsubscribe = subscribe((event) => {
      if (event.type === 'call.incoming') {
        const payload = (event.payload ?? {}) as CallIncomingPayload
        const callId = resolveCallId(payload)
        const incomingRoomId = resolveCallRoomId(payload)
        if (!callId || !incomingRoomId) return

        const callerId = payload.caller?.id ?? payload.call?.caller_id ?? payload.call?.callerId
        if (callerId && callerId === user?.id) return

        const hasRoom = useRoomsStore.getState().rooms.some((room) => room.id === incomingRoomId)
        if (!hasRoom) {
          void fetchRooms()
        }

        setGlobalCallError(null)
        setGlobalIncomingCall({
          id: callId,
          roomId: incomingRoomId,
          caller: payload.caller,
        })

        const callerName = payload.caller?.display_name ?? payload.caller?.username ?? 'Пользователь'
        showBrowserNotification('Входящий звонок', {
          body: `${callerName} звонит вам`,
          tag: 'call',
          requireInteraction: true,
          icon: payload.caller?.avatar_url || undefined,
        })
        return
      }

      if (event.type === 'call.accepted' || event.type === 'call.declined' || event.type === 'call.ended') {
        const payload = (event.payload ?? {}) as {
          call_id?: string
          callId?: string
          id?: string
          call?: { id?: string }
        }
        const callId = resolveCallId(payload)
        if (!callId) return

        setGlobalIncomingCall((prev) => (prev?.id === callId ? null : prev))
        if (event.type !== 'call.accepted') {
          setGlobalCallBusy(false)
        }
      }
    })

    return unsubscribe
  }, [fetchRooms, user?.id])

  // Уведомление о заявке в друзья
  useEffect(() => {
    const unsubscribe = subscribe((event) => {
      if (event.type !== 'friend.request') return
      const payload = (event.payload ?? {}) as {
        id?: string
        sender?: { id?: string; username?: string; display_name?: string; avatar_url?: string }
        created_at?: string
      }
      const sender = payload.sender
      const displayName = sender?.display_name ?? sender?.username ?? 'Пользователь'
      addToast({
        type: 'friend_request',
        title: displayName,
        body: 'Хочет добавить вас в друзья',
        avatarUrl: sender?.avatar_url,
        avatarLetter: displayName[0],
        action: () => navigate('/app'),
        actionLabel: 'Посмотреть заявки →',
      })
      showBrowserNotification('Заявка в друзья', {
        body: `${displayName} хочет добавить вас в друзья`,
        icon: sender?.avatar_url || undefined,
      })
    })
    return unsubscribe
  }, [addToast, navigate])

  const handleOpenIncomingCallRoom = useCallback(() => {
    if (!globalIncomingCall) return
    navigate(`/app/dm/${globalIncomingCall.roomId}`)
  }, [globalIncomingCall, navigate])

  const handleAcceptIncomingCall = useCallback((withVideo: boolean) => {
    if (!globalIncomingCall || globalCallBusy) return

    setGlobalCallBusy(true)
    setGlobalCallError(null)

    try {
      sessionStorage.setItem(PENDING_CALL_ACCEPT_KEY, JSON.stringify({
        callId: globalIncomingCall.id,
        roomId: globalIncomingCall.roomId,
        withVideo,
        createdAt: new Date().toISOString(),
      }))
    } catch {
      // Ignore storage errors and continue navigation.
    }

    navigate(`/app/dm/${globalIncomingCall.roomId}`)
    setGlobalIncomingCall(null)
    setGlobalCallBusy(false)
  }, [globalCallBusy, globalIncomingCall, navigate])

  const handleDeclineIncomingCall = useCallback(async () => {
    if (!globalIncomingCall || globalCallBusy) return

    setGlobalCallBusy(true)
    setGlobalCallError(null)
    try {
      await callsApi.decline(globalIncomingCall.id)
      setGlobalIncomingCall(null)
    } catch {
      setGlobalCallError('Не удалось отклонить звонок.')
    } finally {
      setGlobalCallBusy(false)
    }
  }, [globalCallBusy, globalIncomingCall])

  const markRoomRead = useCallback((roomId: string) => {
    setUnreadByRoom((prev) => {
      if (!prev[roomId]) return prev
      const next = { ...prev }
      delete next[roomId]
      return next
    })
  }, [])

  useEffect(() => {
    const baseTitle = baseTitleRef.current || document.title
    if (totalUnread <= 0) {
      document.title = baseTitle
      return
    }

    const unreadLabel = totalUnread > 99 ? '99+' : String(totalUnread)
    const notifyTitle = `[${unreadLabel}] Новое сообщение`
    let showNotify = false

    const tick = () => {
      showNotify = !showNotify
      document.title = showNotify ? notifyTitle : baseTitle
    }

    tick()
    const timer = window.setInterval(tick, 900)

    return () => {
      window.clearInterval(timer)
      document.title = baseTitle
    }
  }, [totalUnread])

  const handleDmCreated = useCallback((roomId: string) => {
    setNewDmOpen(false)
    fetchRooms()
    navigate(`/app/dm/${roomId}`)
  }, [fetchRooms, navigate])

  const sortedRooms = [...rooms].sort((a, b) => {
    const ta = a.last_message_at ?? a.created_at
    const tb = b.last_message_at ?? b.created_at
    return tb.localeCompare(ta)
  })

  return (
    <div className="h-screen flex bg-bg text-text overflow-hidden select-none">

      {/* ════════════════════════════════════════
          Колонка 1 — Сайдбар серверов (72px)
          ════════════════════════════════════════ */}
      <div className="hidden w-[72px] bg-[#0A0C0F] flex flex-col items-center pt-3 pb-3 gap-2 shrink-0 overflow-y-auto overflow-x-hidden">

        <div className="relative flex items-center justify-center w-full">
          <div className="absolute left-0 w-1 h-8 bg-text rounded-r-full" />
          <button className="w-12 h-12 rounded-[16px] bg-primary/20 hover:bg-primary transition-all duration-200 flex items-center justify-center group">
            <Logo size={28} />
          </button>
        </div>

        <div className="w-8 h-px bg-elevated/50 my-1 shrink-0" />

        <button className="w-12 h-12 rounded-full hover:rounded-[16px] bg-secondary hover:bg-primary/25 hover:text-primary transition-all duration-200 flex items-center justify-center font-pixel font-semibold text-[13px] text-text-secondary">
          N
        </button>

        <div className="flex-1" />

        <button title="Добавить сервер" className="w-12 h-12 rounded-full hover:rounded-[16px] bg-secondary hover:bg-success transition-all duration-200 flex items-center justify-center text-success hover:text-bg">
          <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M12 4.5v15m7.5-7.5h-15" />
          </svg>
        </button>

        <button title="Найти серверы" className="w-12 h-12 rounded-full hover:rounded-[16px] bg-secondary hover:bg-elevated transition-all duration-200 flex items-center justify-center text-text-disabled hover:text-primary transition-colors">
          <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-5.197-5.197m0 0A7.5 7.5 0 105.196 5.196a7.5 7.5 0 0010.607 10.607z" />
          </svg>
        </button>

      </div>

      {/* ════════════════════════════════════════
          Колонка 2 — Навигационный сайдбар (240px)
          ════════════════════════════════════════ */}
      <aside className="w-60 bg-secondary flex flex-col shrink-0">

        {/* Поиск / начать беседу */}
        <div className="p-3 shrink-0">
          <button
            onClick={() => setNewDmOpen(true)}
            className="w-full bg-bg/70 border border-elevated/40 rounded-md px-3 py-[7px] text-[13px] text-text-disabled text-left hover:bg-bg hover:text-text-secondary transition-colors"
          >
            Найти или начать беседу
          </button>
        </div>

        {/* Навигация */}
        <div className="px-2 shrink-0 space-y-0.5">
          <NavLink
            to="/app"
            end
            className={({ isActive }) =>
              `w-full flex items-center gap-3 px-2 py-1.75 rounded-md text-[15px] font-medium transition-colors ${
                isActive
                  ? 'bg-elevated/70 text-text'
                  : 'text-text-secondary hover:bg-elevated/60 hover:text-text'
              }`
            }
          >
            <IconFriends />
            Друзья
          </NavLink>
        </div>

        {/* Личные сообщения */}
        <div className="px-4 pt-5 pb-1 shrink-0 flex items-center justify-between">
          <p className="text-[11px] font-semibold text-text-disabled uppercase tracking-[0.9px]">
            Личные сообщения
          </p>
          <button
            title="Новое сообщение"
            onClick={() => setNewDmOpen(true)}
            className="text-text-disabled hover:text-text transition-colors"
          >
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 4.5v15m7.5-7.5h-15" />
            </svg>
          </button>
        </div>

        {/* Список комнат */}
        <div className="flex-1 overflow-y-auto px-2 pb-2 space-y-0.5">
          {sortedRooms.length === 0 ? (
            <div className="px-2 pt-4 text-center">
              <p className="text-[12px] text-text-disabled leading-relaxed">
                Нет диалогов. Нажми <span className="text-text-secondary">+</span>, чтобы начать переписку.
              </p>
            </div>
          ) : (
            sortedRooms.map((room) => {
              const color = roomColor(room.id)
              const unreadCount = unreadByRoom[room.id] ?? 0
              const linkClass = ({ isActive }: { isActive: boolean }) =>
                `w-full flex items-center gap-3 px-2 py-[7px] rounded-md transition-colors group ${
                  isActive
                    ? 'bg-elevated text-text'
                    : 'text-text-secondary hover:bg-elevated/60 hover:text-text'
                }`

              if (room.type === 'dm') {
                const dmUser = dmUsers[room.id]
                const isOnline = dmUser ? online.has(dmUser.id) : false
                const displayName = dmUser?.display_name ?? '...'

                return (
                  <NavLink key={room.id} to={`/app/dm/${room.id}`} className={linkClass} onClick={() => markRoomRead(room.id)}>
                    <div className="relative shrink-0">
                      {dmUser?.avatar_url ? (
                        <img src={dmUser.avatar_url} alt={displayName} className="w-8 h-8 rounded-full object-cover" />
                      ) : (
                        <div
                          className="w-8 h-8 rounded-full flex items-center justify-center text-sm font-semibold text-bg"
                          style={{ backgroundColor: color }}
                        >
                          {displayName[0]?.toUpperCase()}
                        </div>
                      )}
                      {isOnline && (
                        <span className="absolute -bottom-0.5 -right-0.5 w-3 h-3 rounded-full bg-success border-2 border-secondary group-hover:border-elevated/60 transition-colors" />
                      )}
                    </div>
                    <span className="text-[15px] font-medium truncate flex-1 min-w-0">{displayName}</span>
                    {unreadCount > 0 && (
                      <span className="min-w-[18px] h-[18px] px-1.5 rounded-full bg-primary text-bg text-[11px] font-semibold flex items-center justify-center leading-none shrink-0">
                        {unreadCount > 99 ? '99+' : unreadCount}
                      </span>
                    )}
                  </NavLink>
                )
              }

              const groupName = room.name ?? 'Группа'
              return (
                <NavLink key={room.id} to={`/app/dm/${room.id}`} className={linkClass} onClick={() => markRoomRead(room.id)}>
                  <div className="relative shrink-0">
                    {room.avatar_url ? (
                      <img src={room.avatar_url} alt={groupName} className="w-8 h-8 rounded-full object-cover" />
                    ) : (
                      <div
                        className="w-8 h-8 rounded-full flex items-center justify-center text-text-disabled"
                        style={{ backgroundColor: color + '33' }}
                      >
                        <IconGroup />
                      </div>
                    )}
                  </div>
                  <span className="text-[15px] font-medium truncate flex-1 min-w-0">{groupName}</span>
                  {unreadCount > 0 && (
                    <span className="min-w-[18px] h-[18px] px-1.5 rounded-full bg-primary text-bg text-[11px] font-semibold flex items-center justify-center leading-none shrink-0">
                      {unreadCount > 99 ? '99+' : unreadCount}
                    </span>
                  )}
                </NavLink>
              )
            })
          )}
        </div>

        {/* Пинг звонка */}
        <PingBar />

        {/* Юзербар */}
        <div className="h-[52px] bg-[#0F1215] px-2 flex items-center gap-2 shrink-0 border-t border-black/30 relative">
          <div className="relative shrink-0">
            {user?.avatar_url ? (
              <img src={user.avatar_url} alt="avatar" className="w-8 h-8 rounded-full object-cover" />
            ) : (
              <div className="w-8 h-8 rounded-full bg-elevated flex items-center justify-center text-sm font-semibold text-text-secondary">
                {user?.display_name?.[0]?.toUpperCase() ?? '?'}
              </div>
            )}
            <span className="absolute -bottom-0.5 -right-0.5 w-3 h-3 rounded-full bg-success border-2 border-[#0F1215]" />
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-[13px] font-semibold text-text truncate leading-none mb-[3px]">
              {user?.display_name}
            </p>
            <p className="text-[11px] text-text-disabled truncate leading-none">
              @{user?.username}
            </p>
          </div>
          <div className="flex items-center shrink-0">
            <button
              title="Настройки аудио"
              onClick={() => setAudioPanelOpen((prev) => !prev)}
              className={`w-8 h-8 flex items-center justify-center rounded transition-colors ${audioPanelOpen ? 'text-primary bg-elevated' : 'text-text-disabled hover:text-text hover:bg-elevated'}`}
            >
              <IconMic />
            </button>
            <button
              title="Настройки аудио"
              onClick={() => setAudioPanelOpen((prev) => !prev)}
              className={`w-8 h-8 flex items-center justify-center rounded transition-colors ${audioPanelOpen ? 'text-primary bg-elevated' : 'text-text-disabled hover:text-text hover:bg-elevated'}`}
            >
              <IconHeadphone />
            </button>
            <button title="Настройки" onClick={() => setSettingsOpen(true)} className="w-8 h-8 flex items-center justify-center rounded text-text-disabled hover:text-text hover:bg-elevated transition-colors">
              <IconSettings />
            </button>
          </div>
          {audioPanelOpen && (
            <AudioSettingsPanel onClose={() => setAudioPanelOpen(false)} />
          )}
        </div>

      </aside>

      {/* ════════════════════════════════════════
          Колонки 3 + 4 — Основная область
          ════════════════════════════════════════ */}
      <main className="flex-1 flex overflow-hidden">
        <Outlet />
      </main>

      {globalIncomingCall && globalIncomingCall.roomId !== activeRoomId && (
        <div className="fixed right-4 top-4 z-[65] w-[320px] rounded-xl border border-elevated bg-secondary shadow-2xl p-4">
          <p className="text-[11px] font-bold text-primary uppercase tracking-[0.9px]">Входящий звонок</p>
          <p className="text-[15px] text-text font-semibold mt-1 truncate">
            {globalIncomingCall.caller?.display_name || globalIncomingCall.caller?.username || 'Неизвестный пользователь'}
          </p>
          <p className="text-[12px] text-text-secondary mt-0.5 truncate">
            Комната: {globalIncomingCall.roomId.slice(0, 8)}
          </p>

          {globalCallError && (
            <p className="text-[12px] text-error mt-2">{globalCallError}</p>
          )}

          <div className="mt-3 grid grid-cols-3 gap-2">
            <button
              type="button"
              onClick={() => handleAcceptIncomingCall(false)}
              disabled={globalCallBusy}
              className="h-8 rounded-lg bg-success/85 hover:bg-success text-bg text-[12px] font-semibold disabled:opacity-60 disabled:cursor-not-allowed"
            >
              Аудио
            </button>
            <button
              type="button"
              onClick={() => handleAcceptIncomingCall(true)}
              disabled={globalCallBusy}
              className="h-8 rounded-lg bg-primary/85 hover:bg-primary text-bg text-[12px] font-semibold disabled:opacity-60 disabled:cursor-not-allowed"
            >
              Видео
            </button>
            <button
              type="button"
              onClick={() => void handleDeclineIncomingCall()}
              disabled={globalCallBusy}
              className="h-8 rounded-lg bg-error/85 hover:bg-error text-bg text-[12px] font-semibold disabled:opacity-60 disabled:cursor-not-allowed"
            >
              Отклонить
            </button>
          </div>

          <button
            type="button"
            onClick={handleOpenIncomingCallRoom}
            className="mt-2 w-full h-8 rounded-lg border border-elevated text-[12px] text-text-secondary hover:text-text hover:bg-elevated/50 transition-colors"
          >
            Открыть чат
          </button>
        </div>
      )}

      <SettingsModal open={settingsOpen} onClose={() => setSettingsOpen(false)} />
      {newDmOpen && (
        <NewDmModal
          onClose={() => setNewDmOpen(false)}
          onCreated={handleDmCreated}
        />
      )}

      <ToastContainer />

    </div>
  )
}
