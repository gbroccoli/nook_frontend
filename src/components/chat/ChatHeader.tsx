interface ChatHeaderProps {
  avatarUrl?: string
  displayName: string
  isOnline: boolean
  color: string
  isDm: boolean
}

export function ChatHeader({ avatarUrl, displayName, isOnline, color, isDm }: ChatHeaderProps) {
  return (
    <div className="h-12 px-4 flex items-center gap-3 border-b border-elevated shadow-[0_1px_3px_rgba(0,0,0,0.3)] shrink-0">
      <div className="relative shrink-0">
        {avatarUrl ? (
          <img src={avatarUrl} alt={displayName} className="w-7 h-7 rounded-full object-cover" />
        ) : (
          <div
            className="w-7 h-7 rounded-full flex items-center justify-center text-[11px] font-semibold text-bg"
            style={{ backgroundColor: color }}
          >
            {displayName[0]?.toUpperCase()}
          </div>
        )}
        {isDm && (
          <span
            className={`absolute -bottom-0.5 -right-0.5 w-2.5 h-2.5 rounded-full border-2 border-bg ${isOnline ? 'bg-success' : 'bg-text-disabled'}`}
          />
        )}
      </div>
      <span className="font-semibold text-text text-[15px] truncate">{displayName}</span>
    </div>
  )
}