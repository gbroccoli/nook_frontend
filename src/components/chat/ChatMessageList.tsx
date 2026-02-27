import * as React from 'react'
import type { Message } from '@/types/api'
import { ScrollArea } from '@/components/ui/scroll-area'
import { MessageBubble } from '@/components/chat/MessageBubble'
import { roomColor } from '@/tools/colors'
import { formatTime, getAuthorKey } from '@/tools/messages'

type UserInfo = { username: string; display_name?: string; avatar_url?: string }
type UserInfoWithId = { id: string; username: string; display_name?: string; avatar_url?: string }

interface ChatMessageListProps {
  messages: Message[]
  loading: boolean
  loadingMore: boolean
  hasMore: boolean
  onLoadOlder: () => void
  currentUserId?: string
  currentUsername?: string
  usersById: Map<string, UserInfo>
  usersByUsername: Map<string, UserInfoWithId>
  scrollerRef: React.RefObject<HTMLDivElement | null>
  onReply: (msg: Message) => void
  onReact: (messageId: string, emoji: string) => void
}

export function ChatMessageList({
  messages, loading, loadingMore, hasMore, onLoadOlder,
  currentUserId, currentUsername, usersById, usersByUsername,
  scrollerRef, onReply, onReact,
}: ChatMessageListProps) {
  return (
    <ScrollArea viewportRef={scrollerRef} className="flex-1 min-h-0">
      <div className="px-4 py-4 space-y-0.5">
        {hasMore && messages.length > 0 && (
          <div className="flex justify-center mb-4">
            <button
              onClick={onLoadOlder}
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

        {messages.map((message, index) => {
          const startsGroup = index === 0 || getAuthorKey(messages[index - 1]) !== getAuthorKey(message)
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
            (rawAuthorUsername.length > 0 && rawAuthorUsername === currentUsername)

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
                onReply={onReply}
                onReact={onReact}
              />
            </div>
          )
        })}
      </div>
    </ScrollArea>
  )
}