import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useParams } from 'react-router-dom'
import { messagesApi } from '@/api/messages'
import { roomsApi } from '@/api/rooms'
import { useRoomsStore } from '@/store/rooms'
import { usePresenceStore } from '@/store/presence'
import { subscribe, sendWs } from '@/store/ws'
import { useAuthStore } from '@/store/auth'
import { useUnreadStore } from '@/store/unread'
import type { Message } from '@/types/api'
import { ChatHeader } from '@/components/chat/ChatHeader'
import { ChatMessageList } from '@/components/chat/ChatMessageList'
import { TypingIndicator } from '@/components/chat/TypingIndicator'
import { ChatComposer } from '@/components/chat/ChatComposer'
import { roomColor } from '@/tools/colors'
import { PAGE_SIZE, normalizeForRender, applyOptimisticReaction } from '@/tools/messages'

export function ChatPage() {
  const { roomId } = useParams<{ roomId: string }>()
  const rooms = useRoomsStore((s) => s.rooms)
  const dmUsers = useRoomsStore((s) => s.dmUsers)
  const online = usePresenceStore((s) => s.online)
  const currentUser = useAuthStore((s) => s.user)
  const currentUserId = useAuthStore((s) => s.user?.id)

  const room = rooms.find((r) => r.id === roomId)
  const dmUser = roomId ? dmUsers[roomId] : undefined
  const displayName = room?.type === 'dm' ? (dmUser?.display_name ?? '...') : (room?.name ?? 'Группа')
  const isOnline = dmUser ? online.has(dmUser.id) : false
  const color = roomId ? roomColor(roomId) : '#5B8AF5'

  // --- State ---
  const [messages, setMessages] = useState<Message[]>([])
  const [loading, setLoading] = useState(false)
  const [loadingMore, setLoadingMore] = useState(false)
  const [sending, setSending] = useState(false)
  const [hasMore, setHasMore] = useState(true)
  const [content, setContent] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [replyToMessage, setReplyToMessage] = useState<Message | null>(null)
  const [attachedFile, setAttachedFile] = useState<File | null>(null)
  const [typingUsers, setTypingUsers] = useState<Set<string>>(new Set())

  // --- Refs ---
  const scrollerRef = useRef<HTMLDivElement | null>(null)
  const composerRef = useRef<HTMLTextAreaElement | null>(null)
  const newMessageScrollTimerRef = useRef<number | null>(null)
  const knownMessageIdsRef = useRef<Set<string>>(new Set())
  const typingTimersRef = useRef<Map<string, number>>(new Map())
  const typingStateRef = useRef(false)
  const typingStopTimerRef = useRef<number | null>(null)

  // --- Derived ---
  const oldestId = useMemo(() => (messages.length > 0 ? messages[0].id : undefined), [messages])

  const usersById = useMemo(() => {
    const map = new Map<string, { username: string; display_name?: string; avatar_url?: string }>()
    if (currentUser) map.set(currentUser.id, { username: currentUser.username, display_name: currentUser.display_name, avatar_url: currentUser.avatar_url })
    for (const user of Object.values(dmUsers)) map.set(user.id, { username: user.username, display_name: user.display_name, avatar_url: user.avatar_url })
    return map
  }, [currentUser, dmUsers])

  const usersByUsername = useMemo(() => {
    const map = new Map<string, { id: string; username: string; display_name?: string; avatar_url?: string }>()
    if (currentUser) map.set(currentUser.username, { id: currentUser.id, username: currentUser.username, display_name: currentUser.display_name, avatar_url: currentUser.avatar_url })
    for (const user of Object.values(dmUsers)) map.set(user.username, { id: user.id, username: user.username, display_name: user.display_name, avatar_url: user.avatar_url })
    return map
  }, [currentUser, dmUsers])

  // --- Scroll helpers ---
  const scrollToBottom = useCallback(() => {
    const node = scrollerRef.current
    if (!node) return
    node.scrollTop = node.scrollHeight
  }, [])

  const scrollToBottomSoon = useCallback(() => {
    requestAnimationFrame(() => scrollToBottom())
    if (newMessageScrollTimerRef.current !== null) window.clearTimeout(newMessageScrollTimerRef.current)
    newMessageScrollTimerRef.current = window.setTimeout(() => {
      scrollToBottom()
      newMessageScrollTimerRef.current = null
    }, 80)
  }, [scrollToBottom])

  // --- Data fetching ---
  const fetchMessages = useCallback(async () => {
    if (!roomId) return
    setLoading(true)
    setError(null)
    try {
      const data = await messagesApi.list(roomId, { limit: PAGE_SIZE })
      const list = data.messages ?? []
      setMessages(list)
      setHasMore(list.length >= PAGE_SIZE)
      knownMessageIdsRef.current = new Set(list.map((m) => m.id))
      requestAnimationFrame(() => scrollToBottom())
    } catch {
      setError('Не удалось загрузить сообщения')
    } finally {
      setLoading(false)
    }
  }, [roomId, scrollToBottom])

  const loadOlder = useCallback(async () => {
    if (!roomId || loadingMore || !hasMore || !oldestId) return
    setLoadingMore(true)
    try {
      const data = await messagesApi.list(roomId, { limit: PAGE_SIZE, before: oldestId })
      const list = data.messages ?? []
      setMessages((prev) => {
        const existingIds = new Set(prev.map((m) => m.id))
        const fresh = list.filter((m) => !existingIds.has(m.id))
        return [...fresh, ...prev]
      })
      setHasMore(list.length >= PAGE_SIZE)
    } catch {
      // ignore
    } finally {
      setLoadingMore(false)
    }
  }, [roomId, loadingMore, hasMore, oldestId])

  // --- Room init / cleanup ---
  useEffect(() => {
    setMessages([])
    setHasMore(true)
    setContent('')
    setError(null)
    setReplyToMessage(null)
    setTypingUsers(new Set())
    typingTimersRef.current.forEach(t => clearTimeout(t))
    typingTimersRef.current.clear()
    if (roomId) {
      useUnreadStore.getState().clear(roomId)
      roomsApi.read(roomId).catch(() => {})
    }
    fetchMessages().then(r => r)
  }, [roomId, fetchMessages])

  useEffect(() => {
    knownMessageIdsRef.current = new Set(messages.map((m) => m.id))
  }, [messages])

  // --- WS events ---
  useEffect(() => {
    return subscribe((event) => {
      if (event.type === 'message.new') {
        const msg = event.payload as Message | undefined
        if (!msg?.id || msg.room_id !== roomId) return
        if (knownMessageIdsRef.current.has(msg.id)) return
        knownMessageIdsRef.current.add(msg.id)
        setMessages((prev) => (prev.some((m) => m.id === msg.id) ? prev : [...prev, msg]))
        const node = scrollerRef.current
        if (node) {
          const isOwnMessage = msg.author.id === currentUserId || msg.author.username === currentUser?.username
          if (node.scrollHeight - node.scrollTop - node.clientHeight < 200 || isOwnMessage) scrollToBottomSoon()
        }
      }

      if (event.type === 'message.delete') {
        const payload = event.payload as { id?: string; room_id?: string; roomId?: string }
        if ((payload.room_id ?? payload.roomId) !== roomId || !payload.id) return
        setMessages((prev) => prev.filter((m) => m.id !== payload.id))
      }

      if (event.type === 'message.reaction') {
        const payload = event.payload as { message_id?: string; room_id?: string; emoji?: string; count?: number }
        if (!payload.message_id || !payload.emoji) return
        if (payload.room_id && payload.room_id !== roomId) return
        const emoji = payload.emoji
        const newCount = payload.count ?? 0
        setMessages((prev) =>
          prev.map((m) => {
            if (m.id !== payload.message_id) return m
            const reactions = (m.reactions ?? []).map((r) => ({ ...r }))
            const idx = reactions.findIndex((r) => r.emoji === emoji)
            if (newCount === 0) {
              const filtered = reactions.filter((r) => r.emoji !== emoji)
              return { ...m, reactions: filtered.length > 0 ? filtered : undefined }
            }
            if (idx === -1) return { ...m, reactions: [...reactions, { emoji, count: newCount, reacted_by_me: false }] }
            reactions[idx] = { ...reactions[idx], count: newCount }
            return { ...m, reactions }
          }),
        )
      }

      if (event.type === 'typing.start' || event.type === 'typing.stop') {
        const payload = event.payload as { user_id?: string; userId?: string; room_id?: string; roomId?: string }
        const typingRoomId = payload.room_id ?? payload.roomId
        const userId = payload.user_id ?? payload.userId
        if (!typingRoomId || typingRoomId !== roomId || !userId || userId === currentUserId) return
        const existing = typingTimersRef.current.get(userId)
        if (existing) clearTimeout(existing)
        typingTimersRef.current.delete(userId)
        setTypingUsers(prev => { const next = new Set(prev); next.delete(userId); return next })
        if (event.type === 'typing.start') {
          const timer = window.setTimeout(() => {
            setTypingUsers(prev => { const next = new Set(prev); next.delete(userId); return next })
            typingTimersRef.current.delete(userId)
          }, 6000)
          typingTimersRef.current.set(userId, timer)
          setTypingUsers(prev => { const next = new Set(prev); next.add(userId); return next })
        }
      }
    })
  }, [roomId, currentUserId, currentUser?.username, scrollToBottomSoon])

  // Остановить свою печать при смене комнаты
  useEffect(() => {
    return () => {
      if (typingStopTimerRef.current !== null) {
        clearTimeout(typingStopTimerRef.current)
        typingStopTimerRef.current = null
      }
      if (typingStateRef.current) {
        typingStateRef.current = false
        sendWs('typing.stop', { room_id: roomId })
      }
    }
  }, [roomId])

  // --- Handlers ---
  const handleContentChange = useCallback((value: string) => {
    setContent(value)
    if (!roomId) return
    if (!typingStateRef.current) {
      typingStateRef.current = true
      sendWs('typing.start', { room_id: roomId })
    }
    if (typingStopTimerRef.current !== null) clearTimeout(typingStopTimerRef.current)
    typingStopTimerRef.current = window.setTimeout(() => {
      typingStateRef.current = false
      typingStopTimerRef.current = null
      sendWs('typing.stop', { room_id: roomId })
    }, 3000)
  }, [roomId])

  const handleToggleReaction = useCallback(async (messageId: string, emoji: string) => {
    const msg = messages.find((m) => m.id === messageId)
    if (!msg) return
    const alreadyReactedByMe = msg.reactions?.find((r) => r.emoji === emoji)?.reacted_by_me ?? false
    setMessages((prev) =>
      prev.map((m) => m.id === messageId ? { ...m, reactions: applyOptimisticReaction(m.reactions, emoji, alreadyReactedByMe) } : m),
    )
    try {
      if (alreadyReactedByMe) await messagesApi.removeReaction(messageId, emoji)
      else await messagesApi.addReaction(messageId, emoji)
    } catch {
      setMessages((prev) =>
        prev.map((m) => m.id === messageId ? { ...m, reactions: applyOptimisticReaction(m.reactions, emoji, !alreadyReactedByMe) } : m),
      )
    }
  }, [messages])

  const canSend = (content.trim().length > 0 || attachedFile !== null) && !sending

  const handleSend = useCallback(async () => {
    if (!roomId || !canSend) return
    const text = content.trim()
    const replyId = replyToMessage?.id
    const file = attachedFile
    if (typingStopTimerRef.current !== null) { clearTimeout(typingStopTimerRef.current); typingStopTimerRef.current = null }
    if (typingStateRef.current) { typingStateRef.current = false; sendWs('typing.stop', { room_id: roomId }) }
    setSending(true)
    setContent('')
    setReplyToMessage(null)
    setAttachedFile(null)
    setError(null)
    try {
      if (file) await messagesApi.sendWithFile(roomId, file, text, replyId)
      else await messagesApi.send(roomId, text, replyId)
    } catch {
      setError('Не удалось отправить сообщение')
      setContent(text)
      setAttachedFile(file)
    } finally {
      setSending(false)
      composerRef.current?.focus()
    }
  }, [roomId, canSend, content, replyToMessage, attachedFile])

  // --- Computed for render ---
  const sortedMessages = useMemo(() => normalizeForRender(messages), [messages])

  const typingText = useMemo(() => {
    const names = [...typingUsers].map(id => {
      const u = usersById.get(id)
      return u?.display_name || u?.username || 'Кто-то'
    })
    if (names.length === 1) return names[0]
    if (names.length === 2) return `${names[0]} и ${names[1]}`
    return `${names[0]} и ещё ${names.length - 1}`
  }, [typingUsers, usersById])

  return (
    <div className="flex-1 min-h-0 flex flex-col overflow-hidden">
      <ChatHeader
        avatarUrl={dmUser?.avatar_url}
        displayName={displayName}
        isOnline={isOnline}
        color={color}
        isDm={room?.type === 'dm'}
      />
      <ChatMessageList
        messages={sortedMessages}
        loading={loading}
        loadingMore={loadingMore}
        hasMore={hasMore}
        onLoadOlder={loadOlder}
        currentUserId={currentUserId}
        currentUsername={currentUser?.username}
        usersById={usersById}
        usersByUsername={usersByUsername}
        scrollerRef={scrollerRef}
        onReply={setReplyToMessage}
        onReact={handleToggleReaction}
      />
      <TypingIndicator typingUsers={typingUsers} typingText={typingText} />
      <ChatComposer
        content={content}
        onChange={handleContentChange}
        onSend={handleSend}
        sending={sending}
        canSend={canSend}
        replyTo={replyToMessage}
        onCancelReply={() => setReplyToMessage(null)}
        attachedFile={attachedFile}
        onFileChange={setAttachedFile}
        displayName={displayName}
        error={error}
        composerRef={composerRef}
      />
    </div>
  )
}