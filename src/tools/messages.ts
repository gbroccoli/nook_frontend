import type { Message, MessageReaction } from '@/types/api'

export const PAGE_SIZE = 50

export function formatTime(iso: string) {
  return new Date(iso).toLocaleTimeString('ru-RU', { hour: '2-digit', minute: '2-digit' })
}

export function normalizeForRender(messages: Message[]) {
  return [...messages].sort((a, b) => a.created_at.localeCompare(b.created_at))
}

export function getAuthorKey(message: Message) {
  const authorId = message.author.id?.trim()
  if (authorId) return `id:${authorId}`
  const username = message.author.username?.trim()
  if (username) return `username:${username}`
  return `message:${message.id}`
}

export function applyOptimisticReaction(
  reactions: MessageReaction[] | undefined,
  emoji: string,
  alreadyReactedByMe: boolean,
): MessageReaction[] | undefined {
  const current = reactions ? reactions.map((r) => ({ ...r })) : []
  const idx = current.findIndex((r) => r.emoji === emoji)

  if (alreadyReactedByMe) {
    if (idx === -1) return current.length > 0 ? current : undefined
    const item = current[idx]
    const nextCount = Math.max(0, item.count - 1)
    if (nextCount === 0) current.splice(idx, 1)
    else current[idx] = { ...item, count: nextCount, reacted_by_me: false }
    return current.length > 0 ? current : undefined
  }

  if (idx === -1) return [...current, { emoji, count: 1, reacted_by_me: true }]
  const item = current[idx]
  current[idx] = { ...item, count: item.count + 1, reacted_by_me: true }
  return current
}