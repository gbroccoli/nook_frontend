interface TypingIndicatorProps {
  typingUsers: Set<string>
  typingText: string
}

export function TypingIndicator({ typingUsers, typingText }: TypingIndicatorProps) {
  return (
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
  )
}