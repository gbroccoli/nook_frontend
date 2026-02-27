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
import { ScrollArea } from '@/components/ui/scroll-area'
import { MessageBubble } from '@/components/chat/MessageBubble'
import { FileAttachButton, FilePreview } from '@/components/chat/FileAttach'
import { X } from 'lucide-react'
import { roomColor } from '@/pages/app/tools/colors'
import { PAGE_SIZE, formatTime, normalizeForRender, getAuthorKey, applyOptimisticReaction } from '@/pages/app/tools/messages'
import * as React from "react";

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

  const scrollerRef = useRef<HTMLDivElement | null>(null)
  const composerRef = useRef<HTMLTextAreaElement | null>(null)
  const newMessageScrollTimerRef = useRef<number | null>(null)
  const knownMessageIdsRef = useRef<Set<string>>(new Set())
  const typingTimersRef = useRef<Map<string, number>>(new Map())
  const typingStateRef = useRef(false)
  const typingStopTimerRef = useRef<number | null>(null)

  const oldestId = useMemo(() => (messages.length > 0 ? messages[0].id : undefined), [messages])

  const usersById = useMemo(() => {
    const map = new Map<string, { username: string; display_name?: string; avatar_url?: string }>()
    if (currentUser) {
      map.set(currentUser.id, {
        username: currentUser.username,
        display_name: currentUser.display_name,
        avatar_url: currentUser.avatar_url,
      })
    }
    for (const user of Object.values(dmUsers)) {
      map.set(user.id, { username: user.username, display_name: user.display_name, avatar_url: user.avatar_url })
    }
    return map
  }, [currentUser, dmUsers])

  const usersByUsername = useMemo(() => {
    const map = new Map<string, { id: string; username: string; display_name?: string; avatar_url?: string }>()
    if (currentUser) {
      map.set(currentUser.username, {
        id: currentUser.id,
        username: currentUser.username,
        display_name: currentUser.display_name,
        avatar_url: currentUser.avatar_url,
      })
    }
    for (const user of Object.values(dmUsers)) {
      map.set(user.username, { id: user.id, username: user.username, display_name: user.display_name, avatar_url: user.avatar_url })
    }
    return map
  }, [currentUser, dmUsers])

  const scrollToBottom = useCallback(() => {
    const node = scrollerRef.current
    if (!node) return
    node.scrollTop = node.scrollHeight
  }, [])

  const scrollToBottomSoon = useCallback(() => {
    requestAnimationFrame(() => scrollToBottom())
    if (newMessageScrollTimerRef.current !== null) {
      window.clearTimeout(newMessageScrollTimerRef.current)
    }
    newMessageScrollTimerRef.current = window.setTimeout(() => {
      scrollToBottom()
      newMessageScrollTimerRef.current = null
    }, 80)
  }, [scrollToBottom])

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

  useEffect(() => {
    return subscribe((event) => {
      if (event.type === 'message.new') {
        const msg = event.payload as Message | undefined
        if (!msg?.id) return
        if (msg.room_id !== roomId) return
        if (knownMessageIdsRef.current.has(msg.id)) return
        knownMessageIdsRef.current.add(msg.id)
        setMessages((prev) => {
          if (prev.some((m) => m.id === msg.id)) return prev
          return [...prev, msg]
        })
        const node = scrollerRef.current
        if (node) {
          const distanceFromBottom = node.scrollHeight - node.scrollTop - node.clientHeight
          const isOwnMessage = msg.author.id === currentUserId || msg.author.username === currentUser?.username
          if (distanceFromBottom < 200 || isOwnMessage) scrollToBottomSoon()
        }
      }

      if (event.type === 'message.delete') {
        const payload = event.payload as { id?: string; room_id?: string; roomId?: string }
        const msgRoomId = payload.room_id ?? payload.roomId
        if (msgRoomId !== roomId || !payload.id) return
        setMessages((prev) => prev.filter((m) => m.id !== payload.id))
      }

      if (event.type === 'message.reaction') {
        const payload = event.payload as {
          message_id?: string
          room_id?: string
          emoji?: string
          action?: 'add' | 'remove'
          count?: number
        }
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

            if (idx === -1) {
              return { ...m, reactions: [...reactions, { emoji, count: newCount, reacted_by_me: false }] }
            }

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

  // Останавливаем свою печать при смене комнаты / анмаунте
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
    const existing = msg.reactions?.find((r) => r.emoji === emoji)
    const alreadyReactedByMe = existing?.reacted_by_me ?? false

    setMessages((prev) =>
      prev.map((m) =>
        m.id === messageId
          ? { ...m, reactions: applyOptimisticReaction(m.reactions, emoji, alreadyReactedByMe) }
          : m,
      ),
    )

    try {
      if (alreadyReactedByMe) {
        await messagesApi.removeReaction(messageId, emoji)
      } else {
        await messagesApi.addReaction(messageId, emoji)
      }
    } catch {
      setMessages((prev) =>
        prev.map((m) =>
          m.id === messageId
            ? { ...m, reactions: applyOptimisticReaction(m.reactions, emoji, !alreadyReactedByMe) }
            : m,
        ),
      )
    }
  }, [messages])

  const canSend = (content.trim().length > 0 || attachedFile !== null) && !sending

  const handleSend = useCallback(async () => {
    if (!roomId || !canSend) return
    const text = content.trim()
    const replyId = replyToMessage?.id
    const file = attachedFile
    if (typingStopTimerRef.current !== null) {
      clearTimeout(typingStopTimerRef.current)
      typingStopTimerRef.current = null
    }
    if (typingStateRef.current) {
      typingStateRef.current = false
      sendWs('typing.stop', { room_id: roomId })
    }
    setSending(true)
    setContent('')
    setReplyToMessage(null)
    setAttachedFile(null)
    setError(null)
    try {
      if (file) {
        await messagesApi.sendWithFile(roomId, file, text, replyId)
      } else {
        await messagesApi.send(roomId, text, replyId)
      }
    } catch {
      setError('Не удалось отправить сообщение')
      setContent(text)
      setAttachedFile(file)
    } finally {
      setSending(false)
      composerRef.current?.focus()
    }
  }, [roomId, canSend, content, replyToMessage, attachedFile])

  function handleComposerKeyDown(e: React.KeyboardEvent<HTMLTextAreaElement>) {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      void handleSend()
    }
  }

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

      {/* Шапка */}
      <div className="h-12 px-4 flex items-center gap-3 border-b border-elevated shadow-[0_1px_3px_rgba(0,0,0,0.3)] shrink-0">
        <div className="relative shrink-0">
          {dmUser?.avatar_url ? (
            <img src={dmUser.avatar_url} alt={displayName} className="w-7 h-7 rounded-full object-cover" />
          ) : (
            <div
              className="w-7 h-7 rounded-full flex items-center justify-center text-[11px] font-semibold text-bg"
              style={{ backgroundColor: color }}
            >
              {displayName[0]?.toUpperCase()}
            </div>
          )}
          {room?.type === 'dm' && (
            <span className={`absolute -bottom-0.5 -right-0.5 w-2.5 h-2.5 rounded-full border-2 border-bg ${isOnline ? 'bg-success' : 'bg-text-disabled'}`} />
          )}
        </div>
        <span className="font-semibold text-text text-[15px] truncate">{displayName}</span>
      </div>

      {/* Переписка */}
      <ScrollArea viewportRef={scrollerRef} className="flex-1 min-h-0">
        <div className="px-4 py-4 space-y-0.5">
          {hasMore && messages.length > 0 && (
            <div className="flex justify-center mb-4">
              <button
                onClick={loadOlder}
                disabled={loadingMore}
                className="px-3 py-1.5 rounded-md text-[12px] bg-elevated text-text-secondary hover:text-text disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {loadingMore ? 'Загрузка...' : 'Показать более старые'}
              </button>
            </div>
          )}

          {loading && (
            <div className="text-text-disabled text-sm text-center py-6">Загрузка сообщений...</div>
          )}

          {!loading && messages.length === 0 && (
            <div className="text-text-disabled text-sm text-center py-6">
              Сообщений пока нет. Напишите первое сообщение.
            </div>
          )}

          {sortedMessages.map((message, index) => {
            const startsGroup = index === 0 || getAuthorKey(sortedMessages[index - 1]) !== getAuthorKey(message)
            const rawAuthorId = message.author.id?.trim() ?? ''
            const rawAuthorUsername = message.author.username?.trim() ?? ''
            const storeAuthor =
              (rawAuthorId ? usersById.get(rawAuthorId) : undefined) ??
              (rawAuthorUsername ? usersByUsername.get(rawAuthorUsername) : undefined)
            const authorName =
              storeAuthor?.display_name ||
              message.author.display_name ||
              storeAuthor?.username ||
              rawAuthorUsername ||
              'Unknown'
            const authorAvatar = storeAuthor?.avatar_url || message.author.avatar_url
            const isOwn =
              (rawAuthorId.length > 0 && rawAuthorId === currentUserId) ||
              (rawAuthorUsername.length > 0 && rawAuthorUsername === currentUser?.username)

            return (
              <div key={message.id} id={`msg-${message.id}`} className={startsGroup && index > 0 ? 'mt-3' : ''}>
                <MessageBubble
                  message={message}
                  isOwn={isOwn}
                  startsGroup={startsGroup}
                  authorName={authorName}
                  authorAvatar={authorAvatar}
                  authorColor={roomColor(rawAuthorId || rawAuthorUsername)}
                  timeLabel={formatTime(message.created_at)}
                  onReply={setReplyToMessage}
                  onReact={handleToggleReaction}
                />
              </div>
            )
          })}
        </div>
      </ScrollArea>

      {/* Typing indicator */}
      <div className="px-5 h-5 flex items-center shrink-0">
        {typingUsers.size > 0 && (
          <div className="flex items-center gap-1.5 text-[11px] text-text-secondary">
            <span className="flex gap-0.5 items-center">
              <span className="w-1 h-1 rounded-full bg-text-secondary/70 animate-bounce [animation-delay:0ms]" />
              <span className="w-1 h-1 rounded-full bg-text-secondary/70 animate-bounce [animation-delay:150ms]" />
              <span className="w-1 h-1 rounded-full bg-text-secondary/70 animate-bounce [animation-delay:300ms]" />
            </span>
            <span>{typingText} {typingUsers.size === 1 ? 'печатает' : 'печатают'}</span>
          </div>
        )}
      </div>

      {/* Ввод */}
      <div className="px-4 pb-5 pt-2 shrink-0">
        {error && (
          <div className="mb-2 text-[12px] text-error bg-error/10 border border-error/20 rounded-lg px-3 py-2">
            {error}
          </div>
        )}
        <div className="rounded-2xl border border-elevated/80 bg-[linear-gradient(180deg,rgba(30,34,40,0.96)_0%,rgba(23,26,31,0.96)_100%)] shadow-[0_10px_30px_rgba(0,0,0,0.35),inset_0_1px_0_rgba(255,255,255,0.03)] transition-colors focus-within:border-primary/45">

          {attachedFile && (
            <FilePreview file={attachedFile} onRemove={() => setAttachedFile(null)} />
          )}

          {replyToMessage && (
            <div className="px-3 pt-2">
              <div className="flex items-start gap-2 rounded-xl border border-primary/30 bg-primary/10 px-3 py-2">
                <div className="min-w-0 flex-1">
                  <p className="text-[11px] font-semibold text-primary truncate">
                    Ответ: {replyToMessage.author.display_name || replyToMessage.author.username}
                  </p>
                  <p className="text-[12px] text-text-secondary truncate">
                    {replyToMessage.content || 'Сообщение'}
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => setReplyToMessage(null)}
                  className="w-6 h-6 rounded-md bg-bg/45 hover:bg-bg/70 text-text-secondary hover:text-text flex items-center justify-center shrink-0"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              </div>
            </div>
          )}

          <div className="flex items-start gap-2 p-2">
            <FileAttachButton onFileChange={setAttachedFile} disabled={sending} />
            <div className="flex-1 min-w-0 bg-bg/35 rounded-xl px-3 py-2 border border-elevated/70 focus-within:border-primary/35 transition-colors">
              <textarea
                ref={composerRef}
                value={content}
                onChange={(e) => handleContentChange(e.target.value)}
                onKeyDown={handleComposerKeyDown}
                rows={1}
                placeholder={`Написать ${displayName}...`}
                className="w-full resize-none max-h-36 bg-transparent text-[15px] leading-6 text-text placeholder:text-text-disabled outline-none"
              />
            </div>
            <button
              type="button"
              onClick={() => void handleSend()}
              disabled={!canSend}
              className="w-10 h-10 rounded-xl bg-primary text-bg flex items-center justify-center shadow-[0_0_16px_rgba(0,245,160,0.35)] hover:bg-primary-hover disabled:bg-elevated disabled:text-text-disabled disabled:shadow-none disabled:cursor-not-allowed transition-all shrink-0"
            >
              {sending ? (
                <svg className="animate-spin w-4 h-4" viewBox="0 0 24 24" fill="none">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                </svg>
              ) : (
                <svg className="w-4 h-4 -translate-x-px" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M5 12h13m0 0l-4-4m4 4l-4 4" />
                </svg>
              )}
            </button>
          </div>
          <div className="px-3 pb-2 text-[11px] text-text-disabled">
            Enter — отправить, Shift+Enter — новая строка
          </div>
        </div>
      </div>

    </div>
  )
}
