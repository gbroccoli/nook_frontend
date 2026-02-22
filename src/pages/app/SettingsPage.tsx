import { useState, useEffect, useRef, useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import Cropper from 'react-easy-crop'
import { useAuthStore } from '@/store/auth'
import { usersApi } from '@/api/users'
import { authApi } from '@/api/auth'
import { Input } from '@/components/ui/Input'
import { Button } from '@/components/ui/Button'
import type { Session } from '@/types/api'

// ── Хелперы аватара ──────────────────────────────────────────────────────────

const AVATAR_COLORS = ['#5B8AF5', '#E879A0', '#F59E0B', '#10B981', '#8B5CF6', '#EF4444']

function avatarColor(str: string): string {
  let h = 0
  for (const c of str) h = (h * 31 + c.charCodeAt(0)) | 0
  return AVATAR_COLORS[Math.abs(h) % AVATAR_COLORS.length]
}

// ── Иконки ───────────────────────────────────────────────────────────────────

function IconX() {
  return (
    <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
    </svg>
  )
}

function IconLock() {
  return (
    <svg className="w-10 h-10" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M16.5 10.5V6.75a4.5 4.5 0 10-9 0v3.75m-.75 11.25h10.5a2.25 2.25 0 002.25-2.25v-6.75a2.25 2.25 0 00-2.25-2.25H6.75a2.25 2.25 0 00-2.25 2.25v6.75a2.25 2.25 0 002.25 2.25z" />
    </svg>
  )
}

function IconMonitor() {
  return (
    <svg className="w-5 h-5 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M9 17.25v1.007a3 3 0 01-.879 2.122L7.5 21h9l-.621-.621A3 3 0 0115 18.257V17.25m6-12V15a2.25 2.25 0 01-2.25 2.25H5.25A2.25 2.25 0 013 15V5.25m18 0A2.25 2.25 0 0018.75 3H5.25A2.25 2.25 0 003 5.25m18 0H3" />
    </svg>
  )
}

// ── Кроп-утилиты ─────────────────────────────────────────────────────────────

interface PixelCrop { x: number; y: number; width: number; height: number }

function createImage(url: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image()
    img.addEventListener('load', () => resolve(img))
    img.addEventListener('error', reject)
    img.setAttribute('crossOrigin', 'anonymous')
    img.src = url
  })
}

async function getCroppedDataUrl(src: string, px: PixelCrop): Promise<string> {
  const img = await createImage(src)
  const canvas = document.createElement('canvas')
  canvas.width = 256
  canvas.height = 256
  const ctx = canvas.getContext('2d')!
  ctx.drawImage(img, px.x, px.y, px.width, px.height, 0, 0, 256, 256)
  return canvas.toDataURL('image/jpeg', 0.92)
}

function dataUrlToBlob(dataUrl: string): Blob {
  const [header, data] = dataUrl.split(',')
  const mime = header.match(/:(.*?);/)?.[1] ?? 'image/jpeg'
  const binary = atob(data)
  const arr = new Uint8Array(binary.length)
  for (let i = 0; i < binary.length; i++) arr[i] = binary.charCodeAt(i)
  return new Blob([arr], { type: mime })
}

// ── AvatarCropper ─────────────────────────────────────────────────────────────

function AvatarCropper({
  src,
  onDone,
  onCancel,
}: {
  src: string
  onDone: (dataUrl: string) => void
  onCancel: () => void
}) {
  const [crop, setCrop] = useState({ x: 0, y: 0 })
  const [zoom, setZoom] = useState(1)
  const [croppedPx, setCroppedPx] = useState<PixelCrop | null>(null)

  const onCropComplete = useCallback((_: unknown, px: PixelCrop) => {
    setCroppedPx(px)
  }, [])

  async function handleConfirm() {
    if (!croppedPx) return
    const dataUrl = await getCroppedDataUrl(src, croppedPx)
    onDone(dataUrl)
  }

  return (
    <div className="fixed inset-0 z-[60] bg-black/80 flex items-center justify-center">
      <div className="bg-bg rounded-xl overflow-hidden w-[400px] flex flex-col shadow-2xl">

        {/* Область кропа */}
        <div className="relative h-[360px] bg-black">
          <Cropper
            image={src}
            crop={crop}
            zoom={zoom}
            aspect={1}
            cropShape="round"
            showGrid={false}
            onCropChange={setCrop}
            onZoomChange={setZoom}
            onCropComplete={onCropComplete}
          />
        </div>

        {/* Ползунок масштаба */}
        <div className="px-6 pt-4 pb-2">
          <p className="text-[11px] text-text-disabled uppercase tracking-wide mb-2">Масштаб</p>
          <input
            type="range"
            min={1}
            max={3}
            step={0.01}
            value={zoom}
            onChange={(e) => setZoom(Number(e.target.value))}
            className="w-full accent-primary cursor-pointer"
          />
        </div>

        {/* Кнопки */}
        <div className="px-6 pb-5 flex justify-end gap-3">
          <Button variant="ghost" onClick={onCancel}>Отмена</Button>
          <Button variant="primary" onClick={handleConfirm}>Применить</Button>
        </div>

      </div>
    </div>
  )
}

// ── Типы ─────────────────────────────────────────────────────────────────────

type SettingsTab = 'profile' | 'security' | 'sessions' | 'account'

// ── SidebarTab ───────────────────────────────────────────────────────────────

function SidebarTab({
  active,
  onClick,
  danger,
  children,
}: {
  active: boolean
  onClick: () => void
  danger?: boolean
  children: React.ReactNode
}) {
  if (danger) {
    return (
      <button
        onClick={onClick}
        className={`w-full text-left px-3 py-[7px] rounded-md text-[14px] font-medium transition-colors ${
          active
            ? 'bg-error/15 text-error'
            : 'text-error/70 hover:bg-error/10 hover:text-error'
        }`}
      >
        {children}
      </button>
    )
  }

  return (
    <button
      onClick={onClick}
      className={`w-full text-left px-3 py-[7px] rounded-md text-[14px] font-medium transition-colors ${
        active
          ? 'bg-elevated text-text'
          : 'text-text-secondary hover:bg-elevated/50 hover:text-text'
      }`}
    >
      {children}
    </button>
  )
}

// ── SectionTitle ─────────────────────────────────────────────────────────────

function SectionTitle({ children }: { children: React.ReactNode }) {
  return (
    <h2 className="text-[11px] font-bold text-text-disabled uppercase tracking-[0.9px] mb-4">
      {children}
    </h2>
  )
}

// ── ProfileSection ───────────────────────────────────────────────────────────

function ProfileSection() {
  const user = useAuthStore((s) => s.user)
  const setAuth = useAuthStore((s) => s.setAuth)

  const [displayName, setDisplayName] = useState(user?.display_name ?? '')
  const [avatarPreview, setAvatarPreview] = useState<string | null>(null)
  const [cropSrc, setCropSrc] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)
  const fileInputRef = useRef<HTMLInputElement>(null)

  const isDirty = displayName !== (user?.display_name ?? '') || avatarPreview !== null
  const isEmpty = displayName.trim() === ''

  function handleAvatarClick() {
    fileInputRef.current?.click()
  }

  function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return
    setCropSrc(URL.createObjectURL(file))
    e.target.value = ''
  }

  function handleCropDone(dataUrl: string) {
    setAvatarPreview(dataUrl)
    setCropSrc(null)
  }

  async function handleSave() {
    if (!isDirty || isEmpty) return
    setSaving(true)
    try {
      if (avatarPreview) {
        const blob = dataUrlToBlob(avatarPreview)
        await usersApi.uploadAvatar(blob)
        setAvatarPreview(null)
      }

      if (displayName.trim() !== user?.display_name) {
        await usersApi.updateMe({ display_name: displayName.trim() })
      }

      // Получаем свежие данные — сервер мог не вернуть все поля в отдельных ответах
      const fresh = await usersApi.me()
      const accessToken = localStorage.getItem('access_token') ?? ''
      const refreshToken = localStorage.getItem('refresh_token') ?? ''
      setAuth(fresh, { access_token: accessToken, refresh_token: refreshToken })

      setSaved(true)
      setTimeout(() => setSaved(false), 2000)
    } finally {
      setSaving(false)
    }
  }

  const avatarLetter = (user?.display_name?.[0] ?? user?.username?.[0] ?? '?').toUpperCase()
  const avatarBg = avatarColor(user?.username ?? '')

  return (
    <>
      {cropSrc && (
        <AvatarCropper
          src={cropSrc}
          onDone={handleCropDone}
          onCancel={() => setCropSrc(null)}
        />
      )}

      <div className="max-w-lg">
        <SectionTitle>Профиль</SectionTitle>

        {/* Аватар + имя */}
        <div className="mb-8 flex items-center gap-4">
          <button
            onClick={handleAvatarClick}
            className="relative w-16 h-16 rounded-full shrink-0 group focus:outline-none"
            title="Изменить аватар"
          >
            {avatarPreview || user?.avatar_url ? (
              <img
                src={avatarPreview ?? user!.avatar_url!}
                alt="avatar"
                className="w-16 h-16 rounded-full object-cover"
              />
            ) : (
              <div
                className="w-16 h-16 rounded-full flex items-center justify-center text-2xl font-bold text-bg"
                style={{ backgroundColor: avatarBg }}
              >
                {avatarLetter}
              </div>
            )}
            {/* Оверлей при наведении */}
            <div className="absolute inset-0 rounded-full bg-black/50 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
              <svg className="w-6 h-6 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M6.827 6.175A2.31 2.31 0 015.186 7.23c-.38.054-.757.112-1.134.175C2.999 7.58 2.25 8.507 2.25 9.574V18a2.25 2.25 0 002.25 2.25h15A2.25 2.25 0 0021.75 18V9.574c0-1.067-.75-1.994-1.802-2.169a47.865 47.865 0 00-1.134-.175 2.31 2.31 0 01-1.64-1.055l-.822-1.316a2.192 2.192 0 00-1.736-1.039 48.774 48.774 0 00-5.232 0 2.192 2.192 0 00-1.736 1.039l-.821 1.316z" />
                <path strokeLinecap="round" strokeLinejoin="round" d="M16.5 12.75a4.5 4.5 0 11-9 0 4.5 4.5 0 019 0zM18.75 10.5h.008v.008h-.008V10.5z" />
              </svg>
            </div>
          </button>

          <div>
            <p className="text-[15px] font-semibold text-text">{user?.display_name}</p>
            <p className="text-[13px] text-text-secondary">@{user?.username}</p>
            <button
              onClick={handleAvatarClick}
              className="mt-1 text-[12px] text-primary hover:text-primary/80 transition-colors"
            >
              Изменить аватар
            </button>
          </div>

          {/* Скрытый input */}
          <input
            ref={fileInputRef}
            type="file"
            accept="image/*"
            className="hidden"
            onChange={handleFileChange}
          />
        </div>

        {/* Поля */}
        <div className="space-y-4">
          <Input
            label="Отображаемое имя"
            value={displayName}
            onChange={(e) => setDisplayName(e.target.value)}
            maxLength={32}
            hint={`${displayName.length}/32`}
          />
          <Input
            label="Имя пользователя"
            value={`@${user?.username ?? ''}`}
            disabled
          />
        </div>

        {/* Кнопка сохранить */}
        <div className="mt-6 flex items-center gap-3">
          <Button
            variant="primary"
            onClick={handleSave}
            disabled={!isDirty || isEmpty}
            loading={saving}
          >
            Сохранить
          </Button>
          {saved && (
            <span className="text-[13px] font-medium text-success">Сохранено</span>
          )}
        </div>
      </div>
    </>
  )
}

// ── SecuritySection ───────────────────────────────────────────────────────────

function SecuritySection() {
  return (
    <div className="max-w-lg">
      <SectionTitle>Безопасность</SectionTitle>
      <div className="bg-secondary rounded-xl p-8 flex flex-col items-center gap-4 text-center">
        <div className="text-text-disabled">
          <IconLock />
        </div>
        <p className="text-[15px] font-semibold text-text">Скоро</p>
        <p className="text-[13px] text-text-secondary">
          Настройки безопасности появятся в ближайшее время
        </p>
      </div>
    </div>
  )
}

// ── SessionsSection ───────────────────────────────────────────────────────────

function formatHwid(hwid: string): string {
  if (hwid.length <= 16) return hwid
  return `${hwid.slice(0, 8)}…${hwid.slice(-8)}`
}

function formatDate(iso: string): string {
  return new Date(iso).toLocaleString('ru-RU', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  })
}

function SessionsSkeleton() {
  return (
    <div className="space-y-2">
      {[1, 2].map((i) => (
        <div key={i} className="flex items-center gap-4 px-4 py-4 rounded-xl bg-secondary">
          <div className="w-5 h-5 rounded bg-elevated animate-pulse shrink-0" />
          <div className="flex-1 space-y-2">
            <div className="h-3 bg-elevated rounded-full animate-pulse w-48" />
            <div className="h-2.5 bg-elevated rounded-full animate-pulse w-32" />
          </div>
        </div>
      ))}
    </div>
  )
}

function SessionsSection() {
  const navigate = useNavigate()
  const clearAuth = useAuthStore((s) => s.clearAuth)

  const [sessions, setSessions] = useState<Session[]>([])
  const [loading, setLoading] = useState(true)
  const [logoutAllLoading, setLogoutAllLoading] = useState(false)

  useEffect(() => {
    usersApi.sessions().then((data) => {
      setSessions(data.sessions)
      setLoading(false)
    }).catch(() => setLoading(false))
  }, [])

  async function handleLogoutAll() {
    setLogoutAllLoading(true)
    try {
      await authApi.logoutAll()
    } finally {
      clearAuth()
      navigate('/login')
    }
  }

  return (
    <div className="max-w-lg">
      <SectionTitle>Активные сессии</SectionTitle>

      {loading ? (
        <SessionsSkeleton />
      ) : sessions.length === 0 ? (
        <p className="text-[13px] text-text-secondary">Нет активных сессий</p>
      ) : (
        <div className="space-y-2 mb-6">
          {sessions.map((session) => (
            <div
              key={session.id}
              className="flex items-start gap-4 px-4 py-4 rounded-xl bg-secondary"
            >
              <div className="text-text-disabled mt-0.5">
                <IconMonitor />
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-[13px] font-mono text-text truncate">
                  {formatHwid(session.hwid)}
                </p>
                <p className="text-[11px] text-text-disabled mt-1">
                  Создана: {formatDate(session.created_at)}
                </p>
                <p className="text-[11px] text-text-disabled">
                  Активность: {formatDate(session.last_seen_at)}
                </p>
              </div>
            </div>
          ))}
        </div>
      )}

      <Button variant="danger" onClick={handleLogoutAll} loading={logoutAllLoading}>
        Завершить все сессии
      </Button>
    </div>
  )
}

// ── AccountSection ────────────────────────────────────────────────────────────

function AccountSection() {
  const navigate = useNavigate()
  const clearAuth = useAuthStore((s) => s.clearAuth)

  const [logoutLoading, setLogoutLoading] = useState(false)
  const [logoutAllLoading, setLogoutAllLoading] = useState(false)

  async function handleLogout() {
    setLogoutLoading(true)
    try {
      await authApi.logout()
    } finally {
      clearAuth()
      navigate('/login')
    }
  }

  async function handleLogoutAll() {
    setLogoutAllLoading(true)
    try {
      await authApi.logoutAll()
    } finally {
      clearAuth()
      navigate('/login')
    }
  }

  return (
    <div className="max-w-lg">
      <SectionTitle>Аккаунт</SectionTitle>

      <div className="border border-error/25 rounded-xl overflow-hidden">
        <div className="bg-error/5 border-b border-error/20 px-5 py-3">
          <p className="text-[11px] font-bold text-error uppercase tracking-[0.9px]">
            Опасная зона
          </p>
        </div>

        <div className="px-5 py-4 flex items-center justify-between">
          <div>
            <p className="text-[14px] font-medium text-text">Выйти</p>
            <p className="text-[12px] text-text-secondary mt-0.5">Завершить текущую сессию</p>
          </div>
          <Button variant="danger" size="sm" onClick={handleLogout} loading={logoutLoading}>
            Выйти
          </Button>
        </div>

        <div className="h-px bg-error/10 mx-5" />

        <div className="px-5 py-4 flex items-center justify-between">
          <div>
            <p className="text-[14px] font-medium text-text">Выйти везде</p>
            <p className="text-[12px] text-text-secondary mt-0.5">Завершить все активные сессии</p>
          </div>
          <Button variant="danger" size="sm" onClick={handleLogoutAll} loading={logoutAllLoading}>
            Выйти везде
          </Button>
        </div>
      </div>
    </div>
  )
}

// ── SettingsModal ─────────────────────────────────────────────────────────────

export function SettingsModal({ open, onClose }: { open: boolean; onClose: () => void }) {
  const [activeTab, setActiveTab] = useState<SettingsTab>('profile')

  useEffect(() => {
    if (!open) return
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [open, onClose])

  if (!open) return null

  return (
    <div
      className="fixed inset-0 z-50 bg-black/60 flex items-center justify-center"
      onClick={onClose}
    >
      {/* Обёртка модала + кнопка закрытия */}
      <div
        className="flex items-start gap-3"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Само окно */}
        <div className="w-[780px] h-[580px] bg-bg rounded-xl overflow-hidden flex shadow-2xl">

          {/* Левый сайдбар */}
          <div className="w-[210px] bg-secondary py-5 px-3 flex flex-col shrink-0 overflow-y-auto">

            <div className="px-3 mb-3">
              <span className="text-[11px] font-bold text-text-disabled uppercase tracking-[0.9px]">
                Настройки
              </span>
            </div>

            <div className="space-y-0.5">
              <SidebarTab active={activeTab === 'profile'} onClick={() => setActiveTab('profile')}>
                Профиль
              </SidebarTab>
              <SidebarTab active={activeTab === 'security'} onClick={() => setActiveTab('security')}>
                Безопасность
              </SidebarTab>
              <SidebarTab active={activeTab === 'sessions'} onClick={() => setActiveTab('sessions')}>
                Сессии
              </SidebarTab>
            </div>

            <div className="my-2 h-px bg-elevated/40 mx-3" />

            <div className="space-y-0.5">
              <SidebarTab
                active={activeTab === 'account'}
                onClick={() => setActiveTab('account')}
                danger
              >
                Аккаунт
              </SidebarTab>
            </div>
          </div>

          {/* Правая часть */}
          <div className="flex-1 overflow-y-auto px-8 py-8">
            {activeTab === 'profile' && <ProfileSection />}
            {activeTab === 'security' && <SecuritySection />}
            {activeTab === 'sessions' && <SessionsSection />}
            {activeTab === 'account' && <AccountSection />}
          </div>

        </div>

        {/* Кнопка закрытия */}
        <div className="flex flex-col items-center gap-1 pt-1">
          <button
            onClick={onClose}
            className="w-8 h-8 rounded-full border-2 border-text-disabled/50 hover:border-text flex items-center justify-center text-text-disabled hover:text-text transition-colors"
            title="Закрыть (ESC)"
          >
            <IconX />
          </button>
          <span className="text-[10px] text-text-disabled font-medium">ESC</span>
        </div>

      </div>
    </div>
  )
}
