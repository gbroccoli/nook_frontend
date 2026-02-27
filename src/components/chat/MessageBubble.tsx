import {useEffect, useState} from 'react'
import {CornerUpLeft, Smile, FileText, Music, Video, Archive, Download, X, ZoomIn} from 'lucide-react'
import type {Message, MessageReaction} from '@/types/api'

const REACTION_OPTIONS = ['❤️', '👍', '🔥', '😂', '😮']

// ── Attachment ─────────────────────────────────────────────────────────────

function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
}

function AttachmentFileIcon({mime}: {mime: string}) {
  if (mime.startsWith('audio/')) return <Music className="w-5 h-5"/>
  if (mime.startsWith('video/')) return <Video className="w-5 h-5"/>
  if (mime.includes('zip')) return <Archive className="w-5 h-5"/>
  return <FileText className="w-5 h-5"/>
}

// ── ImageLightbox ──────────────────────────────────────────────────────────

function ImageLightbox({url, name, onClose}: {url: string; name: string; onClose: () => void}) {
  useEffect(() => {
    const handler = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose() }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [onClose])

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm"
      onClick={onClose}
    >
      <button
        type="button"
        onClick={onClose}
        className="absolute top-4 right-4 w-9 h-9 rounded-full bg-white/10 hover:bg-white/20 flex items-center justify-center text-white transition-colors"
      >
        <X className="w-5 h-5"/>
      </button>
      <img
        src={url}
        alt={name}
        className="max-w-[90vw] max-h-[90vh] rounded-xl object-contain shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      />
    </div>
  )
}

function Attachment({attachment}: {attachment: NonNullable<Message['attachment']>}) {
  const {url, name, mime, size} = attachment
  const [lightboxOpen, setLightboxOpen] = useState(false)

  if (mime.startsWith('image/')) {
    return (
      <>
        {lightboxOpen && (
          <ImageLightbox url={url} name={name} onClose={() => setLightboxOpen(false)}/>
        )}
        <button type="button" onClick={() => setLightboxOpen(true)} className="block mt-1">
          <div className="relative group/img inline-block">
            <img
              src={url}
              alt={name}
              className="max-w-[280px] max-h-[280px] rounded-xl object-cover group-hover/img:opacity-90 transition-opacity"
            />
            <div className="absolute inset-0 rounded-xl flex items-center justify-center opacity-0 group-hover/img:opacity-100 transition-opacity">
              <div className="w-9 h-9 rounded-full bg-black/50 flex items-center justify-center">
                <ZoomIn className="w-4 h-4 text-white"/>
              </div>
            </div>
          </div>
        </button>
      </>
    )
  }

  if (mime.startsWith('audio/')) {
    return (
      <div className="mt-1 rounded-xl border border-elevated/60 bg-bg/40 px-3 py-2.5 max-w-[280px]">
        <p className="text-[12px] text-text-secondary truncate mb-1.5">{name}</p>
        <audio controls src={url} className="w-full h-8" style={{colorScheme: 'dark'}}/>
      </div>
    )
  }

  if (mime.startsWith('video/')) {
    return (
      <div className="mt-1">
        <video controls src={url} className="max-w-[280px] max-h-[200px] rounded-xl"/>
      </div>
    )
  }

  return (
    <a
      href={url}
      download={name}
      target="_blank"
      rel="noopener noreferrer"
      className="mt-1 flex items-center gap-2.5 rounded-xl border border-elevated/70 bg-bg/40 px-3 py-2.5 max-w-[280px] hover:bg-elevated/50 transition-colors group"
    >
      <div className="w-9 h-9 rounded-lg bg-elevated flex items-center justify-center shrink-0 text-text-secondary">
        <AttachmentFileIcon mime={mime}/>
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-[13px] font-medium text-text truncate">{name}</p>
        <p className="text-[11px] text-text-disabled">{formatBytes(size)}</p>
      </div>
      <Download className="w-4 h-4 text-text-disabled group-hover:text-text-secondary shrink-0 transition-colors"/>
    </a>
  )
}

// ── ReplyPreview ──────────────────────────────────────────────────────────────

function ReplyPreview({replyTo, onJump}: { replyTo: NonNullable<Message['reply_to']>; onJump: () => void }) {
  const authorName = replyTo.author.display_name || replyTo.author.username || 'Пользователь'
  const text = replyTo.content?.trim() || 'Сообщение'
  return (
    <button
      type="button"
      onClick={onJump}
      className="mb-1 flex flex-col rounded-lg border border-elevated/70 bg-elevated/45 px-2.5 py-1.5 max-w-full text-left hover:bg-elevated/70 transition-colors cursor-pointer"
    >
      <span className="text-[11px] font-semibold text-primary truncate">{authorName}</span>
      <span className="text-[12px] text-text-secondary truncate">{text}</span>
    </button>
  )
}

// ── ReactionBar ───────────────────────────────────────────────────────────────

function ReactionBar(
  {reactions, onReact,}:
  {
    reactions: MessageReaction[]
    onReact: (emoji: string) => void
  }) {
  return (
    <div className="flex flex-wrap gap-1 mt-1">
      {reactions.map((r) => (
        <button
          key={r.emoji}
          type="button"
          onClick={() => onReact(r.emoji)}
          className={
            `inline-flex items-center gap-1 h-6 px-2 rounded-full text-[12px] border transition-colors
          ${
              r.reacted_by_me
                ? 'border-primary/50 bg-primary/15 text-text'
                : 'border-elevated/70 bg-elevated/60 hover:bg-elevated text-text-secondary'
            }`
          }
        >
          {r.emoji}
          <span className="text-[11px]">{r.count}</span>
        </button>
      ))}
    </div>
  )
}

// ── EmojiPicker ───────────────────────────────────────────────────────────────
function EmojiPicker({ onSelect, alignRight }: { onSelect: (emoji: string) => void; alignRight?: boolean }) {
  return (
    <div
      className={`absolute bottom-full mb-1.5 z-30 flex items-center gap-0.5 rounded-xl border border-elevated/70 bg-secondary/95 backdrop-blur-sm px-1.5 py-1 shadow-lg ${alignRight ? 'right-0' : 'left-0'}`}>
      {REACTION_OPTIONS.map((emoji) => (
        <button
          key={emoji}
          type="button"
          onClick={() => onSelect(emoji)}
          className="w-8 h-7 flex items-center justify-center rounded-lg hover:bg-elevated text-[15px] transition-colors"
        >
          {emoji}
        </button>
      ))}
    </div>
  )
}

// ── MessageBubble ─────────────────────────────────────────────────────────────

export interface MessageBubbleProps {
  message: Message
  isOwn: boolean
  startsGroup: boolean
  authorName: string
  authorAvatar?: string
  authorColor: string
  timeLabel: string
  onReply: (message: Message) => void
  onReact: (messageId: string, emoji: string) => void
}

export function MessageBubble(
  {
    message,
    isOwn,
    startsGroup,
    authorName,
    authorAvatar,
    authorColor,
    timeLabel,
    onReply,
    onReact,
  }: MessageBubbleProps) {
  const [pickerOpen, setPickerOpen] = useState(false)

  const reactions = message.reactions ?? []

  function jumpToMessage(id: string) {
    const el = document.getElementById(`msg-${id}`)
    if (!el) return
    el.scrollIntoView({ behavior: 'smooth', block: 'nearest' })
    el.classList.remove('msg-highlight')
    void el.offsetWidth // force reflow to restart animation
    el.classList.add('msg-highlight')
    setTimeout(() => el.classList.remove('msg-highlight'), 1500)
  }

  return (
    <div className={`group/msg flex flex-col ${isOwn ? 'items-end' : 'items-start'}`}>

      {/* Автор + время (начало группы) */}
      {startsGroup && (
        <div className={`flex items-center gap-2 mb-1 ${isOwn ? 'flex-row-reverse' : ''}`}>
          {authorAvatar ? (
            <img
              src={authorAvatar}
              alt={authorName}
              className="w-7 h-7 rounded-full object-cover shrink-0"
            />
          ) : (
            <div
              className="w-7 h-7 rounded-full flex items-center justify-center text-[11px] font-semibold text-bg shrink-0"
              style={{backgroundColor: authorColor}}
            >
              {authorName[0]?.toUpperCase()}
            </div>
          )}
          <span className="text-[13px] font-semibold text-text">{authorName}</span>
          <span className="text-[11px] text-text-disabled">{timeLabel}</span>
        </div>
      )}

      {/* Пузырёк + экшены */}
      <div className="flex items-end gap-1.5 max-w-[75%]">

        {/* Ховер-кнопки — order-1 для своих (слева), order-2 для чужих (справа) */}
        <div
          className={`flex items-center gap-0.5 opacity-0 group-hover/msg:opacity-100 transition-opacity shrink-0 ${isOwn ? 'order-1' : 'order-2'}`}>
          <div className="relative">
            <button
              type="button"
              onClick={() => setPickerOpen((v) => !v)}
              className="w-7 h-7 rounded-lg bg-elevated/80 hover:bg-elevated text-text-secondary hover:text-text flex items-center justify-center transition-colors"
              title="Реакция"
            >
              <Smile className="w-3.5 h-3.5"/>
            </button>
            {pickerOpen && (
              <div onMouseLeave={() => setPickerOpen(false)}>
                <EmojiPicker
                  alignRight={isOwn}
                  onSelect={(emoji) => {
                    onReact(message.id, emoji);
                    setPickerOpen(false)
                  }}
                />
              </div>
            )}
          </div>
          <button
            type="button"
            onClick={() => onReply(message)}
            className="w-7 h-7 rounded-lg bg-elevated/80 hover:bg-elevated text-text-secondary hover:text-text flex items-center justify-center transition-colors"
            title="Ответить"
          >
            <CornerUpLeft className="w-3.5 h-3.5"/>
          </button>
        </div>

        {/* Контент — order-2 для своих (справа), order-1 для чужих (слева) */}
        <div className={`flex flex-col ${isOwn ? 'items-end order-2' : 'items-start order-1'} min-w-0`}>
          {message.reply_to && (
            <ReplyPreview
              replyTo={message.reply_to}
              onJump={() => message.reply_to?.id && jumpToMessage(message.reply_to.id)}
            />
          )}

          {message.content && (
            <div className={`px-3 py-2 rounded-2xl text-[14px] leading-relaxed whitespace-pre-wrap П  wrap-break-word ${
              isOwn
                ? 'bg-primary/20 text-text rounded-tr-sm'
                : 'bg-elevated text-text rounded-tl-sm'
            }`}>
              {message.content}
            </div>
          )}

          {message.attachment && (
            <Attachment attachment={message.attachment}/>
          )}

          {reactions.length > 0 && (
            <ReactionBar reactions={reactions} onReact={(emoji) => onReact(message.id, emoji)}/>
          )}
        </div>
      </div>

    </div>
  )
}
