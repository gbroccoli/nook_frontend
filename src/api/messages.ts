import { ApiError, api } from './client'
import type { Message, MessageReaction } from '@/types/api'
import { buildLegacyAttachmentContent } from '@/utils/legacyAttachment'

interface ListMessagesParams {
  limit?: number
  before?: string
}

interface ReactionsResponse {
  message_id: string
  room_id: string
  reactions: MessageReaction[]
}

export const messagesApi = {
  list: (roomId: string, params: ListMessagesParams = {}) => {
    const search = new URLSearchParams()
    if (params.limit != null) search.set('limit', String(params.limit))
    if (params.before) search.set('before', params.before)
    const suffix = search.size > 0 ? `?${search.toString()}` : ''
    return api.get<{ messages: Message[] }>(`/rooms/${roomId}/messages${suffix}`)
  },

  send: (roomId: string, content: string, replyToMessageId?: string) =>
    api.post<Message>(`/rooms/${roomId}/messages`, {
      content,
      ...(replyToMessageId ? { reply_to_message_id: replyToMessageId } : {}),
    }),

  sendWithFile: async (
    roomId: string,
    file: File,
    content = '',
    replyToMessageId?: string,
  ) => {
    const form = new FormData()
    if (content.trim().length > 0) form.append('content', content.trim())
    if (replyToMessageId) form.append('reply_to_message_id', replyToMessageId)
    form.append('file', file, file.name)
    try {
      return await api.postForm<Message>(`/rooms/${roomId}/messages`, form)
    } catch (err) {
      if (
        err instanceof ApiError &&
        err.status === 400 &&
        /invalid character .* numeric literal/i.test(err.body?.error ?? '')
      ) {
        const legacyContent = await buildLegacyAttachmentContent(file)
        return api.post<Message>(`/rooms/${roomId}/messages`, {
          content: legacyContent,
          ...(replyToMessageId ? { reply_to_message_id: replyToMessageId } : {}),
        })
      }
      throw err
    }
  },

  edit: (messageId: string, content: string) =>
    api.patch<Message>(`/messages/${messageId}`, { content }),

  addReaction: (messageId: string, emoji: string) =>
    api.put<ReactionsResponse>(`/messages/${messageId}/reactions`, { emoji }),

  removeReaction: (messageId: string, emoji: string) =>
    api.delete<ReactionsResponse>(`/messages/${messageId}/reactions?emoji=${encodeURIComponent(emoji)}`),

  remove: (messageId: string) =>
    api.delete<void>(`/messages/${messageId}`),
}
