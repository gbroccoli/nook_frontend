import * as React from 'react'
import type { Message } from '@/types/api'
import { FileAttachButton, FilePreview } from '@/components/chat/FileAttach'
import { X } from 'lucide-react'

interface ChatComposerProps {
  content: string
  onChange: (v: string) => void
  onSend: () => void
  sending: boolean
  canSend: boolean
  replyTo: Message | null
  onCancelReply: () => void
  attachedFile: File | null
  onFileChange: (f: File | null) => void
  displayName: string
  error: string | null
  composerRef: React.RefObject<HTMLTextAreaElement | null>
}

export function ChatComposer({
  content, onChange, onSend, sending, canSend,
  replyTo, onCancelReply, attachedFile, onFileChange,
  displayName, error, composerRef,
}: ChatComposerProps) {
  function handleKeyDown(e: React.KeyboardEvent<HTMLTextAreaElement>) {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      onSend()
    }
  }

  return (
    <div className="px-4 pb-5 pt-2 shrink-0">
      {error && (
        <div className="mb-2 text-[12px] text-error bg-error/10 border border-error/20 rounded-lg px-3 py-2">
          {error}
        </div>
      )}
      <div className="rounded-2xl border border-elevated/80 bg-[linear-gradient(180deg,rgba(30,34,40,0.96)_0%,rgba(23,26,31,0.96)_100%)] shadow-[0_10px_30px_rgba(0,0,0,0.35),inset_0_1px_0_rgba(255,255,255,0.03)] transition-colors focus-within:border-primary/45">
        {attachedFile && (
          <FilePreview file={attachedFile} onRemove={() => onFileChange(null)} />
        )}

        {replyTo && (
          <div className="px-3 pt-2">
            <div className="flex items-start gap-2 rounded-xl border border-primary/30 bg-primary/10 px-3 py-2">
              <div className="min-w-0 flex-1">
                <p className="text-[11px] font-semibold text-primary truncate">
                  Ответ: {replyTo.author.display_name || replyTo.author.username}
                </p>
                <p className="text-[12px] text-text-secondary truncate">
                  {replyTo.content || 'Сообщение'}
                </p>
              </div>
              <button
                type="button"
                onClick={onCancelReply}
                className="w-6 h-6 rounded-md bg-bg/45 hover:bg-bg/70 text-text-secondary hover:text-text flex items-center justify-center shrink-0"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>
        )}

        <div className="flex items-start gap-2 p-2">
          <FileAttachButton onFileChange={onFileChange} disabled={sending} />
          <div className="flex-1 min-w-0 bg-bg/35 rounded-xl px-3 py-2 border border-elevated/70 focus-within:border-primary/35 transition-colors">
            <textarea
              ref={composerRef}
              value={content}
              onChange={(e) => onChange(e.target.value)}
              onKeyDown={handleKeyDown}
              rows={1}
              placeholder={`Написать ${displayName}...`}
              className="w-full resize-none max-h-36 bg-transparent text-[15px] leading-6 text-text placeholder:text-text-disabled outline-none"
            />
          </div>
          <button
            type="button"
            onClick={onSend}
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
  )
}