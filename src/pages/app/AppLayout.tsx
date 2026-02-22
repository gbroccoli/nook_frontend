import { useState } from 'react'
import { Outlet } from 'react-router-dom'
import { useAuthStore } from '@/store/auth'
import { Logo } from '@/components/ui/Logo'
import { SettingsModal } from '@/pages/app/SettingsPage'

// ── Иконки ──────────────────────────────────────────────────────────────────

function IconMic() {
  return (
    <svg className="w-[18px] h-[18px]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M12 18.75a6 6 0 006-6v-1.5m-6 7.5a6 6 0 01-6-6v-1.5m6 7.5v3.75m-3.75 0h7.5M12 15.75a3 3 0 01-3-3V4.5a3 3 0 116 0v8.25a3 3 0 01-3 3z" />
    </svg>
  )
}

function IconHeadphone() {
  return (
    <svg className="w-[18px] h-[18px]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M19.114 5.636a9 9 0 010 12.728M16.463 8.288a5.25 5.25 0 010 7.424M6.75 8.25l4.72-4.72a.75.75 0 011.28.53v15.88a.75.75 0 01-1.28.53l-4.72-4.72H4.51c-.88 0-1.704-.507-1.938-1.354A9.01 9.01 0 012.25 12c0-.83.112-1.633.322-2.396C2.806 8.756 3.63 8.25 4.51 8.25H6.75z" />
    </svg>
  )
}

function IconSettings() {
  return (
    <svg className="w-[18px] h-[18px]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M9.594 3.94c.09-.542.56-.94 1.11-.94h2.593c.55 0 1.02.398 1.11.94l.213 1.281c.063.374.313.686.645.87.074.04.147.083.22.127.324.196.72.257 1.075.124l1.217-.456a1.125 1.125 0 011.37.49l1.296 2.247a1.125 1.125 0 01-.26 1.431l-1.003.827c-.293.24-.438.613-.431.992a6.759 6.759 0 010 .255c-.007.378.138.75.43.99l1.005.828c.424.35.534.954.26 1.43l-1.298 2.247a1.125 1.125 0 01-1.369.491l-1.217-.456c-.355-.133-.75-.072-1.076.124a6.57 6.57 0 01-.22.128c-.331.183-.581.495-.644.869l-.213 1.28c-.09.543-.56.941-1.11.941h-2.594c-.55 0-1.02-.398-1.11-.94l-.213-1.281c-.062-.374-.312-.686-.644-.87a6.52 6.52 0 01-.22-.127c-.325-.196-.72-.257-1.076-.124l-1.217.456a1.125 1.125 0 01-1.369-.49l-1.297-2.247a1.125 1.125 0 01.26-1.431l1.004-.827c.292-.24.437-.613.43-.992a6.932 6.932 0 010-.255c.007-.378-.138-.75-.43-.99l-1.004-.828a1.125 1.125 0 01-.26-1.43l1.297-2.247a1.125 1.125 0 011.37-.491l1.216.456c.356.133.751.072 1.076-.124.072-.044.146-.087.22-.128.332-.183.582-.495.644-.869l.214-1.281z" />
      <path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
    </svg>
  )
}

function IconFriends() {
  return (
    <svg className="w-5 h-5 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M15 19.128a9.38 9.38 0 002.625.372 9.337 9.337 0 004.121-.952 4.125 4.125 0 00-7.533-2.493M15 19.128v-.003c0-1.113-.285-2.16-.786-3.07M15 19.128v.106A12.318 12.318 0 018.624 21c-2.331 0-4.512-.645-6.374-1.766l-.001-.109a6.375 6.375 0 0111.964-3.07M12 6.375a3.375 3.375 0 11-6.75 0 3.375 3.375 0 016.75 0zm8.25 2.25a2.625 2.625 0 11-5.25 0 2.625 2.625 0 015.25 0z" />
    </svg>
  )
}

// ── DM-список (placeholder) ──────────────────────────────────────────────────

const DM_LIST = [
  { name: 'Alice', username: 'alice', online: true, color: '#5B8AF5', avatar_url: undefined as string | undefined },
  { name: 'Bob',   username: 'bob',   online: true, color: '#E879A0', avatar_url: undefined as string | undefined },
]

// ── AppLayout ────────────────────────────────────────────────────────────────

export function AppLayout() {
  const user = useAuthStore((s) => s.user)
  const [settingsOpen, setSettingsOpen] = useState(false)

  return (
    <div className="h-screen flex bg-bg text-text overflow-hidden select-none">

      {/* ════════════════════════════════════════
          Колонка 1 — Сайдбар серверов (72px)
          ════════════════════════════════════════ */}
      <div className="w-[72px] bg-[#0A0C0F] flex flex-col items-center pt-3 pb-3 gap-2 shrink-0 overflow-y-auto overflow-x-hidden">

        {/* Кнопка «Главная» (активная) */}
        <div className="relative flex items-center justify-center w-full">
          <div className="absolute left-0 w-1 h-8 bg-text rounded-r-full" />
          <button className="w-12 h-12 rounded-[16px] bg-primary/20 hover:bg-primary transition-all duration-200 flex items-center justify-center group">
            <Logo size={28} />
          </button>
        </div>

        <div className="w-8 h-px bg-elevated/50 my-1 shrink-0" />

        {/* Заглушка сервера */}
        <button className="w-12 h-12 rounded-full hover:rounded-[16px] bg-secondary hover:bg-primary/25 hover:text-primary transition-all duration-200 flex items-center justify-center font-pixel font-semibold text-[13px] text-text-secondary">
          N
        </button>

        <div className="flex-1" />

        {/* Добавить сервер */}
        <button title="Добавить сервер" className="w-12 h-12 rounded-full hover:rounded-[16px] bg-secondary hover:bg-success transition-all duration-200 flex items-center justify-center text-success hover:text-bg">
          <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M12 4.5v15m7.5-7.5h-15" />
          </svg>
        </button>

        {/* Найти серверы */}
        <button title="Найти серверы" className="w-12 h-12 rounded-full hover:rounded-[16px] bg-secondary hover:bg-elevated transition-all duration-200 flex items-center justify-center text-text-disabled hover:text-primary transition-colors">
          <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-5.197-5.197m0 0A7.5 7.5 0 105.196 5.196a7.5 7.5 0 0010.607 10.607z" />
          </svg>
        </button>

      </div>

      {/* ════════════════════════════════════════
          Колонка 2 — Навигационный сайдбар (240px)
          ════════════════════════════════════════ */}
      <aside className="w-60 bg-secondary flex flex-col shrink-0">

        {/* Поиск */}
        <div className="p-3 shrink-0">
          <button className="w-full bg-bg/70 border border-elevated/40 rounded-md px-3 py-[7px] text-[13px] text-text-disabled text-left hover:bg-bg transition-colors">
            Найти или начать беседу
          </button>
        </div>

        {/* Навигация */}
        <div className="px-2 shrink-0 space-y-0.5">
          <button className="w-full flex items-center gap-3 px-2 py-[7px] rounded-md bg-elevated/70 text-text text-[15px] font-medium transition-colors">
            <IconFriends />
            Друзья
          </button>
        </div>

        {/* Личные сообщения */}
        <div className="px-4 pt-5 pb-1 shrink-0 flex items-center justify-between">
          <p className="text-[11px] font-semibold text-text-disabled uppercase tracking-[0.9px]">
            Личные сообщения
          </p>
          <button title="Новое сообщение" className="text-text-disabled hover:text-text transition-colors">
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 4.5v15m7.5-7.5h-15" />
            </svg>
          </button>
        </div>

        {/* DM список */}
        <div className="flex-1 overflow-y-auto px-2 pb-2 space-y-0.5">
          {DM_LIST.map((friend) => (
            <button
              key={friend.username}
              className="w-full flex items-center gap-3 px-2 py-[7px] rounded-md text-text-secondary hover:bg-elevated/60 hover:text-text transition-colors group"
            >
              <div className="relative shrink-0">
                {friend.avatar_url ? (
                  <img src={friend.avatar_url} alt={friend.name} className="w-8 h-8 rounded-full object-cover" />
                ) : (
                  <div
                    className="w-8 h-8 rounded-full flex items-center justify-center text-sm font-semibold text-bg"
                    style={{ backgroundColor: friend.color }}
                  >
                    {friend.name[0]}
                  </div>
                )}
                {friend.online && (
                  <span className="absolute -bottom-0.5 -right-0.5 w-3 h-3 rounded-full bg-success border-2 border-secondary group-hover:border-elevated/60 transition-colors" />
                )}
              </div>
              <span className="text-[15px] font-medium truncate">{friend.name}</span>
            </button>
          ))}
        </div>

        {/* Юзербар */}
        <div className="h-[52px] bg-[#0F1215] px-2 flex items-center gap-2 shrink-0 border-t border-black/30">
          <div className="relative shrink-0">
            {user?.avatar_url ? (
              <img src={user.avatar_url} alt="avatar" className="w-8 h-8 rounded-full object-cover" />
            ) : (
              <div className="w-8 h-8 rounded-full bg-elevated flex items-center justify-center text-sm font-semibold text-text-secondary">
                {user?.display_name?.[0]?.toUpperCase() ?? '?'}
              </div>
            )}
            <span className="absolute -bottom-0.5 -right-0.5 w-3 h-3 rounded-full bg-success border-2 border-[#0F1215]" />
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-[13px] font-semibold text-text truncate leading-none mb-[3px]">
              {user?.display_name}
            </p>
            <p className="text-[11px] text-text-disabled truncate leading-none">
              @{user?.username}
            </p>
          </div>
          <div className="flex items-center shrink-0">
            <button title="Микрофон" className="w-8 h-8 flex items-center justify-center rounded text-text-disabled hover:text-text hover:bg-elevated transition-colors">
              <IconMic />
            </button>
            <button title="Звук" className="w-8 h-8 flex items-center justify-center rounded text-text-disabled hover:text-text hover:bg-elevated transition-colors">
              <IconHeadphone />
            </button>
            <button title="Настройки" onClick={() => setSettingsOpen(true)} className="w-8 h-8 flex items-center justify-center rounded text-text-disabled hover:text-text hover:bg-elevated transition-colors">
              <IconSettings />
            </button>
          </div>
        </div>

      </aside>

      {/* ════════════════════════════════════════
          Колонки 3 + 4 — Основная область
          ════════════════════════════════════════ */}
      <main className="flex-1 flex overflow-hidden">
        <Outlet />
      </main>

      <SettingsModal open={settingsOpen} onClose={() => setSettingsOpen(false)} />

    </div>
  )
}
