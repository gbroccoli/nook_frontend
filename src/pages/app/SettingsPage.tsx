import { useState, useEffect, useRef, useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import Cropper from 'react-easy-crop'
import { useAuthStore } from '@/store/auth'
import { usersApi } from '@/api/users'
import { authApi } from '@/api/auth'
import { getHwid } from '@/lib/hwid'
import { Input } from '@/components/ui/Input'
import { Button } from '@/components/ui/Button'
import { Spinner } from '@/components/ui/spinner'
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
          <Button variant="default" onClick={handleConfirm}>Применить</Button>
        </div>

      </div>
    </div>
  )
}

// ── Типы ─────────────────────────────────────────────────────────────────────

type SettingsTab = 'profile' | 'security' | 'voice-video' | 'sessions' | 'account'

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

function SelectField({
  label,
  value,
  onChange,
  options,
}: {
  label: string
  value: string
  onChange: (next: string) => void
  options: Array<{ value: string; label: string }>
}) {
  return (
    <label className="block">
      <span className="text-sm font-medium text-text-secondary">{label}</span>
      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="mt-1.5 w-full bg-secondary border border-elevated rounded-xl px-4 py-2.5 text-sm text-text outline-none transition-all duration-150 focus:border-primary/50"
      >
        {options.map((opt) => (
          <option key={opt.value} value={opt.value} className="bg-secondary text-text">
            {opt.label}
          </option>
        ))}
      </select>
    </label>
  )
}

function ToggleRow({
  id,
  title,
  description,
  checked,
  onChange,
}: {
  id: string
  title: string
  description: string
  checked: boolean
  onChange: (checked: boolean) => void
}) {
  return (
    <label htmlFor={id} className="flex items-start justify-between gap-4 py-1 cursor-pointer select-none">
      <div className="min-w-0">
        <p className="text-[14px] font-medium text-text">{title}</p>
        <p className="text-[12px] text-text-secondary mt-0.5">{description}</p>
      </div>
      <span className="relative inline-flex items-center shrink-0">
        <input
          id={id}
          type="checkbox"
          checked={checked}
          onChange={(e) => onChange(e.target.checked)}
          className="peer sr-only"
        />
        <span className="w-11 h-6 rounded-full bg-elevated border border-elevated/70 transition-colors peer-checked:bg-primary/25 peer-checked:border-primary/40" />
        <span className="absolute left-0.5 top-0.5 w-5 h-5 rounded-full bg-text-disabled transition-transform peer-checked:translate-x-5 peer-checked:bg-primary" />
      </span>
    </label>
  )
}

function deviceLabel(device: MediaDeviceInfo, fallbackPrefix: string, index: number): string {
  if (device.label && device.label.trim() !== '') return device.label
  return `${fallbackPrefix} ${index + 1}`
}

function withSavedDeviceOption(
  options: Array<{ value: string; label: string }>,
  selectedValue: string,
  fallbackLabel: string,
) {
  if (!selectedValue || selectedValue === 'default') return options
  if (options.some((opt) => opt.value === selectedValue)) return options
  return [...options, { value: selectedValue, label: `${fallbackLabel} (сохранено)` }]
}

function readSavedVolume(
  key: string,
  fallbackKey?: string,
): number {
  const raw = localStorage.getItem(key) ?? (fallbackKey ? localStorage.getItem(fallbackKey) : null)
  if (raw == null) return 100
  const num = Number(raw)
  if (!Number.isFinite(num)) return 100
  return Math.min(100, Math.max(0, Math.round(num)))
}

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
      setAuth(fresh, accessToken, refreshToken)

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
          <div className="flex flex-col gap-1.5">
            <label className="text-sm font-medium text-text-secondary">Отображаемое имя</label>
            <Input
              value={displayName}
              onChange={(e) => setDisplayName(e.target.value)}
              maxLength={32}
            />
            <span className="text-xs text-text-disabled">{displayName.length}/32</span>
          </div>
          <div className="flex flex-col gap-1.5">
            <label className="text-sm font-medium text-text-secondary">Имя пользователя</label>
            <Input value={`@${user?.username ?? ''}`} disabled />
          </div>
        </div>

        {/* Кнопка сохранить */}
        <div className="mt-6 flex items-center gap-3">
          <Button
            variant="default"
            onClick={handleSave}
            disabled={!isDirty || isEmpty || saving}
          >
            {saving && <Spinner />}
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

function toTs(iso: string): number {
  const ts = Date.parse(iso)
  return Number.isNaN(ts) ? 0 : ts
}

function normalizeSessions(list: Session[]): Session[] {
  const byHwid = new Map<string, Session>()

  for (const session of list) {
    const prev = byHwid.get(session.hwid)
    if (!prev || toTs(session.last_seen_at) > toTs(prev.last_seen_at)) {
      byHwid.set(session.hwid, session)
    }
  }

  return [...byHwid.values()].sort((a, b) => toTs(b.last_seen_at) - toTs(a.last_seen_at))
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

function VoiceVideoSection() {
  const [audioInputs, setAudioInputs] = useState<MediaDeviceInfo[]>([])
  const [audioOutputs, setAudioOutputs] = useState<MediaDeviceInfo[]>([])
  const [videoInputs, setVideoInputs] = useState<MediaDeviceInfo[]>([])
  const [devicesLoading, setDevicesLoading] = useState(false)
  const [requestingAudioAccess, setRequestingAudioAccess] = useState(false)
  const [deviceError, setDeviceError] = useState<string | null>(null)

  const [audioInputId, setAudioInputId] = useState(() => localStorage.getItem('settings.audioInputId') ?? 'default')
  const [audioOutputId, setAudioOutputId] = useState(() => localStorage.getItem('settings.audioOutputId') ?? 'default')
  const [videoInputId, setVideoInputId] = useState(() => localStorage.getItem('settings.videoInputId') ?? 'default')
  const [videoQuality, setVideoQuality] = useState(() => localStorage.getItem('settings.videoQuality') ?? 'auto')
  const [micVolume, setMicVolume] = useState(() => readSavedVolume('settings.micVolume'))
  const [speakerVolume, setSpeakerVolume] = useState(() => readSavedVolume('settings.speakerVolume', 'settings.outputVolume'))
  const [noiseSuppression, setNoiseSuppression] = useState(() => localStorage.getItem('settings.noiseSuppression') !== '0')
  const [echoCancellation, setEchoCancellation] = useState(() => localStorage.getItem('settings.echoCancellation') !== '0')

  useEffect(() => {
    if (localStorage.getItem('settings.noiseSuppression') == null) {
      localStorage.setItem('settings.noiseSuppression', '1')
    }
    if (localStorage.getItem('settings.echoCancellation') == null) {
      localStorage.setItem('settings.echoCancellation', '1')
    }
  }, [])

  const loadDevices = useCallback(async (): Promise<MediaDeviceInfo[]> => {
    if (!navigator.mediaDevices?.enumerateDevices) {
      setAudioInputs([])
      setAudioOutputs([])
      setVideoInputs([])
      setDeviceError('Браузер не поддерживает список устройств.')
      return []
    }

    setDevicesLoading(true)
    try {
      const devices = await navigator.mediaDevices.enumerateDevices()
      setAudioInputs(devices.filter((d) => d.kind === 'audioinput'))
      setAudioOutputs(devices.filter((d) => d.kind === 'audiooutput'))
      setVideoInputs(devices.filter((d) => d.kind === 'videoinput'))
      setDeviceError(null)
      return devices
    } catch {
      setAudioInputs([])
      setAudioOutputs([])
      setVideoInputs([])
      setDeviceError('Не удалось получить список устройств.')
      return []
    } finally {
      setDevicesLoading(false)
    }
  }, [])

  const requestAudioAccess = useCallback(async () => {
    if (!navigator.mediaDevices?.getUserMedia) {
      setDeviceError('Браузер не поддерживает запрос доступа к микрофону.')
      return
    }
    setRequestingAudioAccess(true)
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true })
      stream.getTracks().forEach((track) => track.stop())
      await loadDevices()
      setDeviceError(null)
    } catch {
      setDeviceError('Доступ к микрофону не выдан. Показаны доступные устройства без имен.')
    } finally {
      setRequestingAudioAccess(false)
    }
  }, [loadDevices])

  useEffect(() => {
    let cancelled = false
    const autoInit = async () => {
      const devices = await loadDevices()
      if (cancelled) return

      const hasUnnamedAudio = devices.some(
        (d) => (d.kind === 'audioinput' || d.kind === 'audiooutput') && (!d.label || d.label.trim() === ''),
      )
      if (!hasUnnamedAudio || !navigator.mediaDevices?.getUserMedia) return

      setRequestingAudioAccess(true)
      try {
        const stream = await navigator.mediaDevices.getUserMedia({ audio: true })
        stream.getTracks().forEach((track) => track.stop())
        if (cancelled) return
        await loadDevices()
        if (cancelled) return
        setDeviceError(null)
      } catch {
        if (cancelled) return
        setDeviceError('Доступ к микрофону не выдан. Показаны доступные устройства без имен.')
      } finally {
        if (!cancelled) {
          setRequestingAudioAccess(false)
        }
      }
    }

    void autoInit()

    if (!navigator.mediaDevices?.addEventListener) return

    const handleDeviceChange = () => {
      void loadDevices()
    }
    navigator.mediaDevices.addEventListener('devicechange', handleDeviceChange)

    return () => {
      cancelled = true
      navigator.mediaDevices.removeEventListener('devicechange', handleDeviceChange)
    }
  }, [loadDevices])

  useEffect(() => {
    localStorage.setItem('settings.audioInputId', audioInputId)
  }, [audioInputId])

  useEffect(() => {
    localStorage.setItem('settings.audioOutputId', audioOutputId)
  }, [audioOutputId])

  useEffect(() => {
    localStorage.setItem('settings.videoInputId', videoInputId)
  }, [videoInputId])

  useEffect(() => {
    localStorage.setItem('settings.videoQuality', videoQuality)
  }, [videoQuality])

  useEffect(() => {
    localStorage.setItem('settings.micVolume', String(micVolume))
    window.dispatchEvent(new CustomEvent('nook:call-settings-changed', {
      detail: { micVolume },
    }))
  }, [micVolume])

  useEffect(() => {
    localStorage.setItem('settings.speakerVolume', String(speakerVolume))
    window.dispatchEvent(new CustomEvent('nook:call-settings-changed', {
      detail: { speakerVolume },
    }))
  }, [speakerVolume])

  useEffect(() => {
    localStorage.setItem('settings.noiseSuppression', noiseSuppression ? '1' : '0')
  }, [noiseSuppression])

  useEffect(() => {
    localStorage.setItem('settings.echoCancellation', echoCancellation ? '1' : '0')
  }, [echoCancellation])

  const audioInputOptions = withSavedDeviceOption([
    { value: 'default', label: 'Системный микрофон (по умолчанию)' },
    ...audioInputs.map((device, i) => ({
      value: device.deviceId,
      label: deviceLabel(device, 'Микрофон', i),
    })),
  ], audioInputId, 'Сохраненный микрофон')

  const audioOutputOptions = withSavedDeviceOption([
    { value: 'default', label: 'Системный вывод (по умолчанию)' },
    ...audioOutputs.map((device, i) => ({
      value: device.deviceId,
      label: deviceLabel(device, 'Динамик', i),
    })),
  ], audioOutputId, 'Сохраненный вывод')

  const videoInputOptions = withSavedDeviceOption([
    { value: 'default', label: 'Системная камера (по умолчанию)' },
    ...videoInputs.map((device, i) => ({
      value: device.deviceId,
      label: deviceLabel(device, 'Камера', i),
    })),
  ], videoInputId, 'Сохраненная камера')

  return (
    <div className="max-w-2xl">
      <SectionTitle>Голос и видео</SectionTitle>

      <div className="space-y-5">
        <div className="bg-secondary rounded-xl p-5">
          <div className="mb-4 flex items-start justify-between gap-3 flex-wrap">
            <h3 className="text-[14px] font-semibold text-text">Голос</h3>
            <div className="flex items-center gap-2">
              <Button
                variant="ghost"
                size="sm"
                onClick={() => void loadDevices()}
                disabled={devicesLoading}
              >
                {devicesLoading ? 'Обновление...' : 'Обновить список'}
              </Button>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => void requestAudioAccess()}
                disabled={requestingAudioAccess}
              >
                {requestingAudioAccess ? 'Запрос...' : 'Доступ к микрофону'}
              </Button>
            </div>
          </div>

          {deviceError ? (
            <p className="text-[12px] text-error mb-4">{deviceError}</p>
          ) : (
            <p className="text-[12px] text-text-disabled mb-4">
              Для отображения названий устройств разрешите доступ к микрофону.
            </p>
          )}

          <div className="space-y-4">
            <SelectField
              label="Устройство ввода"
              value={audioInputId}
              onChange={setAudioInputId}
              options={audioInputOptions}
            />
            <SelectField
              label="Устройство вывода"
              value={audioOutputId}
              onChange={setAudioOutputId}
              options={audioOutputOptions}
            />
            <label className="block">
              <div className="flex items-center justify-between">
                <span className="text-sm font-medium text-text-secondary">Уровень микрофона</span>
                <span className="text-[12px] text-text-disabled">{micVolume}%</span>
              </div>
              <input
                type="range"
                min={0}
                max={100}
                step={1}
                value={micVolume}
                onChange={(e) => setMicVolume(Number(e.target.value))}
                className="mt-2 w-full accent-primary cursor-pointer"
              />
            </label>
            <label className="block">
              <div className="flex items-center justify-between">
                <span className="text-sm font-medium text-text-secondary">Громкость динамика</span>
                <span className="text-[12px] text-text-disabled">{speakerVolume}%</span>
              </div>
              <input
                type="range"
                min={0}
                max={100}
                step={1}
                value={speakerVolume}
                onChange={(e) => setSpeakerVolume(Number(e.target.value))}
                className="mt-2 w-full accent-primary cursor-pointer"
              />
            </label>
            <div className="h-px bg-elevated/60" />
            <div className="space-y-2">
              <ToggleRow
                id="noise-suppression"
                title="Шумоподавление"
                description="Убирает фоновые шумы с микрофона во время звонка."
                checked={noiseSuppression}
                onChange={setNoiseSuppression}
              />
              <ToggleRow
                id="echo-cancellation"
                title="Эхоподавление"
                description="Снижает эффект эха и обратной связи в голосовом канале."
                checked={echoCancellation}
                onChange={setEchoCancellation}
              />
            </div>
          </div>
        </div>

        <div className="bg-secondary rounded-xl p-5">
          <h3 className="text-[14px] font-semibold text-text mb-4">Видео</h3>
          <div className="space-y-4">
            <SelectField
              label="Камера"
              value={videoInputId}
              onChange={setVideoInputId}
              options={videoInputOptions}
            />
            <SelectField
              label="Качество видео"
              value={videoQuality}
              onChange={setVideoQuality}
              options={[
                { value: 'auto', label: 'Авто' },
                { value: '720p', label: '720p' },
                { value: '1080p', label: '1080p' },
              ]}
            />
          </div>
        </div>

        <p className="text-[12px] text-text-disabled">
          Настройки сохраняются локально и будут применяться при подключении к звонку.
        </p>
      </div>
    </div>
  )
}

function SessionsSection() {
  const navigate = useNavigate()
  const clearAuth = useAuthStore((s) => s.clearAuth)
  const currentHwid = getHwid()

  const [sessions, setSessions] = useState<Session[]>([])
  const [loading, setLoading] = useState(true)
  const [logoutAllLoading, setLogoutAllLoading] = useState(false)

  useEffect(() => {
    let cancelled = false

    usersApi.sessions().then((data) => {
      if (cancelled) return
      setSessions(normalizeSessions(data.sessions))
      setLoading(false)
    }).catch(() => {
      if (cancelled) return
      setLoading(false)
    })

    return () => {
      cancelled = true
    }
  }, [])

  async function handleLogoutAll() {
    setLogoutAllLoading(true)
    try {
      await usersApi.removePushToken(getHwid()).catch(() => {})
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
              {session.hwid === currentHwid ? (
                <span className="text-[11px] text-success font-medium shrink-0 mt-0.5">
                  Текущая
                </span>
              ) : null}
            </div>
          ))}
        </div>
      )}

      <p className="text-[12px] text-text-disabled mb-4">
        Завершение отдельных сессий пока не поддерживается API.
      </p>

      <Button variant="destructive" onClick={handleLogoutAll} disabled={logoutAllLoading}>
        {logoutAllLoading && <Spinner />}
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
      const hwid = getHwid()
      await usersApi.removePushToken(hwid).catch(() => {})
      await authApi.logout()
    } finally {
      clearAuth()
      navigate('/login')
    }
  }

  async function handleLogoutAll() {
    setLogoutAllLoading(true)
    try {
      const hwid = getHwid()
      await usersApi.removePushToken(hwid).catch(() => {})
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
          <Button variant="destructive" size="sm" onClick={handleLogout} disabled={logoutLoading}>
            {logoutLoading && <Spinner />}
            Выйти
          </Button>
        </div>

        <div className="h-px bg-error/10 mx-5" />

        <div className="px-5 py-4 flex items-center justify-between">
          <div>
            <p className="text-[14px] font-medium text-text">Выйти везде</p>
            <p className="text-[12px] text-text-secondary mt-0.5">Завершить все активные сессии</p>
          </div>
          <Button variant="destructive" size="sm" onClick={handleLogoutAll} disabled={logoutAllLoading}>
            {logoutAllLoading && <Spinner />}
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
              <SidebarTab active={activeTab === 'voice-video'} onClick={() => setActiveTab('voice-video')}>
                Голос/видео
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
            {activeTab === 'voice-video' && <VoiceVideoSection />}
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
