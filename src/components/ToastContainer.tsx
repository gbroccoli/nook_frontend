import { useToastsStore, type Toast } from '@/store/toasts'

const AVATAR_COLORS = ['#5B8AF5', '#E879A0', '#F59E0B', '#10B981', '#8B5CF6', '#EF4444']

function letterColor(str: string): string {
  let h = 0
  for (const c of str) h = (h * 31 + c.charCodeAt(0)) | 0
  return AVATAR_COLORS[Math.abs(h) % AVATAR_COLORS.length]
}

function IconMessage() {
  return (
    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M7.5 8.25h9m-9 3H12m-9.75 1.51c0 1.6 1.123 2.994 2.707 3.227 1.129.166 2.27.293 3.423.379.35.026.67.21.865.501L12 21l2.755-4.133a1.14 1.14 0 01.865-.501 48.172 48.172 0 003.423-.379c1.584-.233 2.707-1.626 2.707-3.228V6.741c0-1.602-1.123-2.995-2.707-3.228A48.394 48.394 0 0012 3c-2.392 0-4.744.175-7.043.513C3.373 3.746 2.25 5.14 2.25 6.741v6.018z" />
    </svg>
  )
}

function IconUser() {
  return (
    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M15 19.128a9.38 9.38 0 002.625.372 9.337 9.337 0 004.121-.952 4.125 4.125 0 00-7.533-2.493M15 19.128v-.003c0-1.113-.285-2.16-.786-3.07M15 19.128v.106A12.318 12.318 0 018.624 21c-2.331 0-4.512-.645-6.374-1.766l-.001-.109a6.375 6.375 0 0111.964-3.07M12 6.375a3.375 3.375 0 11-6.75 0 3.375 3.375 0 016.75 0zm8.25 2.25a2.625 2.625 0 11-5.25 0 2.625 2.625 0 015.25 0z" />
    </svg>
  )
}

function IconX() {
  return (
    <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
    </svg>
  )
}

function ToastItem({ toast }: { toast: Toast }) {
  const remove = useToastsStore((s) => s.remove)

  const accentColor =
    toast.type === 'message' ? 'bg-primary' :
    toast.type === 'friend_request' ? 'bg-[#8B5CF6]' :
    toast.type === 'error' ? 'bg-error' :
    toast.type === 'success' ? 'bg-success' :
    'bg-primary'

  const iconColor =
    toast.type === 'message' ? 'text-primary' :
    toast.type === 'friend_request' ? 'text-[#8B5CF6]' :
    toast.type === 'error' ? 'text-error' :
    toast.type === 'success' ? 'text-success' :
    'text-primary'

  const avatarBg = toast.avatarLetter ? letterColor(toast.avatarLetter) : '#5B8AF5'

  return (
    <div
      className="flex items-start gap-3 w-[340px] bg-secondary border border-elevated/60 rounded-xl shadow-2xl overflow-hidden cursor-pointer hover:bg-elevated/40 transition-colors"
      onClick={() => {
        if (toast.action) toast.action()
        remove(toast.id)
      }}
    >
      {/* Цветная полоска слева */}
      <div className={`w-1 self-stretch shrink-0 ${accentColor}`} />

      {/* Аватар */}
      <div className="shrink-0 mt-3">
        {toast.avatarUrl ? (
          <img src={toast.avatarUrl} alt="" className="w-8 h-8 rounded-full object-cover" />
        ) : toast.avatarLetter ? (
          <div
            className="w-8 h-8 rounded-full flex items-center justify-center text-sm font-semibold text-bg"
            style={{ backgroundColor: avatarBg }}
          >
            {toast.avatarLetter}
          </div>
        ) : (
          <div className={`w-8 h-8 rounded-full bg-elevated flex items-center justify-center ${iconColor}`}>
            {toast.type === 'friend_request' ? <IconUser /> : <IconMessage />}
          </div>
        )}
      </div>

      {/* Текст */}
      <div className="flex-1 min-w-0 py-3 pr-1">
        <p className="text-[13px] font-semibold text-text truncate leading-none mb-[3px]">
          {toast.title}
        </p>
        {toast.body && (
          <p className="text-[12px] text-text-secondary truncate leading-snug">
            {toast.body}
          </p>
        )}
        {toast.actionLabel && (
          <p className={`text-[11px] font-medium mt-1 ${iconColor}`}>
            {toast.actionLabel}
          </p>
        )}
      </div>

      {/* Закрыть */}
      <button
        className="shrink-0 mt-2.5 mr-2 text-text-disabled hover:text-text transition-colors"
        onClick={(e) => {
          e.stopPropagation()
          remove(toast.id)
        }}
      >
        <IconX />
      </button>
    </div>
  )
}

export function ToastContainer() {
  const toasts = useToastsStore((s) => s.toasts)

  if (toasts.length === 0) return null

  return (
    <div className="fixed top-4 right-4 z-[100] flex flex-col gap-2 pointer-events-none">
      {toasts.map((toast) => (
        <div key={toast.id} className="pointer-events-auto">
          <ToastItem toast={toast} />
        </div>
      ))}
    </div>
  )
}
