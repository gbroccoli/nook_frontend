import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useParams } from 'react-router-dom'
import { Room as LiveKitRoom, RoomEvent, Track, LocalAudioTrack, type AudioCaptureOptions, type VideoCaptureOptions, type VideoResolution } from 'livekit-client'
import { messagesApi } from '@/api/messages'
import { callsApi } from '@/api/calls'
import { roomsApi } from '@/api/rooms'
import { ApiError } from '@/api/client'
import { useRoomsStore } from '@/store/rooms'
import { usePresenceStore } from '@/store/presence'
import { subscribe, sendWs } from '@/store/ws'
import { useCallStore } from '@/store/call'
import { useAuthStore } from '@/store/auth'
import { AudioPlayer } from '@/components/chat/AudioPlayer'
import { VideoPlayer } from '@/components/chat/VideoPlayer'
import { Check, CheckCheck, CornerUpLeft, Mic, MicOff, Phone, PhoneOff, Smile, Video, VideoOff, X } from 'lucide-react'
import type { Call, Message, MessageReaction } from '@/types/api'
import { parseLegacyAttachmentContent } from '@/utils/legacyAttachment'

const AVATAR_COLORS = ['#5B8AF5', '#E879A0', '#F59E0B', '#10B981', '#8B5CF6', '#EF4444']
const PAGE_SIZE = 50
const MAX_ATTACHMENT_BYTES = 100 * 1024 * 1024
const ALLOWED_IMAGE_MIMES = new Set(['image/jpeg', 'image/png', 'image/webp', 'image/gif'])
const ALLOWED_IMAGE_EXTS = new Set(['jpg', 'jpeg', 'png', 'webp', 'gif'])
const ALLOWED_FILE_MIMES = new Set([
  'application/pdf',
  'text/plain',
  'application/zip',
  'application/x-zip-compressed',
  'application/vnd.ms-excel',
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  'application/vnd.ms-powerpoint',
  'application/vnd.openxmlformats-officedocument.presentationml.presentation',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  'application/msword',
  'audio/mpeg',
  'audio/ogg',
  'audio/wav',
  'video/mp4',
  'video/webm',
])
const ALLOWED_FILE_EXTS = new Set([
  'pdf',
  'txt',
  'zip',
  'doc',
  'docx',
  'xls',
  'xlsx',
  'ppt',
  'pptx',
  'mp3',
  'ogg',
  'wav',
  'mp4',
  'webm',
])
const REACTION_OPTIONS = ['❤️', '👍', '🔥', '😂', '😮']
const REACTION_POPPER_WIDTH = 216
const REACTION_POPPER_HEIGHT = 44
const REACTION_POPPER_OFFSET = 8
const REACTION_POPPER_VIEWPORT_PADDING = 8
const PENDING_CALL_ACCEPT_KEY = 'pending_call_accept'

interface MessageDeletePayload {
  id?: string
  room_id?: string
}

interface MessageReactionPayload {
  message_id?: string
  room_id?: string
  user_id?: string
  emoji?: string
  action?: 'add' | 'remove'
  count?: number
}

interface MessageReadPayload {
  room_id?: string
  user_id?: string
  last_read_at?: string
}

interface CallIncomingPayload {
  call_id?: string
  id?: string
  room_id?: string
  roomId?: string
  call?: {
    id?: string
    room_id?: string
    roomId?: string
    caller_id?: string
    callerId?: string
  }
  caller?: {
    id?: string
    username?: string
    display_name?: string
    avatar_url?: string
  }
}

interface CallAcceptedPayload {
  call_id?: string
  id?: string
  room_id?: string
  roomId?: string
  call?: {
    id?: string
    room_id?: string
    roomId?: string
  }
  user_id?: string
}

interface CallDeclinedPayload {
  call_id?: string
  id?: string
  room_id?: string
  roomId?: string
  call?: {
    id?: string
    room_id?: string
    roomId?: string
  }
  user_id?: string
}

interface CallEndedPayload {
  call_id?: string
  id?: string
  room_id?: string
  roomId?: string
  call?: {
    id?: string
    room_id?: string
    roomId?: string
  }
}

interface ReactionPopoverPosition {
  left: number
  top: number
}

interface IncomingCallState {
  id: string
  roomId: string
  caller?: {
    id?: string
    username?: string
    display_name?: string
    avatar_url?: string
  }
}

interface PendingCallAccept {
  callId: string
  roomId: string
  withVideo: boolean
  createdAt?: string
}

function readPendingCallAccept(): PendingCallAccept | null {
  try {
    const raw = sessionStorage.getItem(PENDING_CALL_ACCEPT_KEY)
    if (!raw) return null
    const parsed = JSON.parse(raw) as Partial<PendingCallAccept>
    if (!parsed.callId || !parsed.roomId || typeof parsed.withVideo !== 'boolean') return null
    return {
      callId: parsed.callId,
      roomId: parsed.roomId,
      withVideo: parsed.withVideo,
      createdAt: parsed.createdAt,
    }
  } catch {
    return null
  }
}

function clearPendingCallAccept() {
  try {
    sessionStorage.removeItem(PENDING_CALL_ACCEPT_KEY)
  } catch {
    // Ignore storage errors.
  }
}

function resolveCallId(payload: {
  call_id?: string
  callId?: string
  id?: string
  call?: { id?: string }
}) {
  return payload.call_id ?? payload.callId ?? payload.id ?? payload.call?.id
}

function resolveCallRoomId(payload: {
  room_id?: string
  roomId?: string
  call?: { room_id?: string; roomId?: string }
}) {
  return payload.room_id ?? payload.roomId ?? payload.call?.room_id ?? payload.call?.roomId
}

function resolveCallCaller(payload: CallIncomingPayload) {
  return payload.caller
}

function getCallCallerId(call: Call | null | undefined) {
  if (!call) return undefined
  const callWithCamel = call as Call & { callerId?: string }
  return callWithCamel.caller_id ?? callWithCamel.callerId
}

function roomColor(str: string): string {
  let h = 0
  for (const c of str) h = (h * 31 + c.charCodeAt(0)) | 0
  return AVATAR_COLORS[Math.abs(h) % AVATAR_COLORS.length]
}

function formatTime(iso: string) {
  return new Date(iso).toLocaleTimeString('ru-RU', {
    hour: '2-digit',
    minute: '2-digit',
  })
}

function toMillis(iso?: string) {
  if (!iso) return NaN
  const ms = Date.parse(iso)
  return Number.isNaN(ms) ? NaN : ms
}

function normalizeForRender(messages: Message[]) {
  return [...messages].sort((a, b) => a.created_at.localeCompare(b.created_at))
}

function getFileExtension(name: string) {
  const idx = name.lastIndexOf('.')
  if (idx === -1) return ''
  return name.slice(idx + 1).toLowerCase()
}

function formatBytes(bytes: number) {
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
}

function isImageAttachment(mime?: string) {
  if (!mime) return false
  return mime.startsWith('image/')
}

function isAudioAttachment(mime?: string, name?: string) {
  if (mime?.startsWith('audio/')) return true
  const ext = name ? getFileExtension(name) : ''
  return ext === 'mp3' || ext === 'ogg' || ext === 'wav'
}

function isVideoAttachment(mime?: string, name?: string) {
  if (mime?.startsWith('video/')) return true
  const ext = name ? getFileExtension(name) : ''
  return ext === 'mp4' || ext === 'webm'
}

function getAuthorKey(message: Message) {
  const authorId = message.author.id?.trim()
  if (authorId) return `id:${authorId}`
  const username = message.author.username?.trim()
  if (username) return `username:${username}`
  return `message:${message.id}`
}

function getMessageSnippet(message: Message) {
  if (message.content && message.content.trim().length > 0) {
    return message.content.trim()
  }
  if (message.attachment?.name) {
    return `Вложение: ${message.attachment.name}`
  }
  return 'Сообщение'
}

type VideoQuality = 'auto' | '720p' | '1080p'

interface CallMediaSettings {
  audioInputId?: string
  audioOutputId?: string
  videoInputId?: string
  videoQuality: VideoQuality
  micVolume: number
  speakerVolume: number
  noiseSuppression: boolean
  echoCancellation: boolean
}

function readSettingDeviceId(key: string): string | undefined {
  const value = localStorage.getItem(key)
  if (!value || value === 'default') return undefined
  return value
}

function readBooleanSetting(key: string, defaultValue: boolean): boolean {
  const value = localStorage.getItem(key)
  if (value == null) return defaultValue
  return value !== '0'
}

function readVideoQualitySetting(): VideoQuality {
  const value = localStorage.getItem('settings.videoQuality')
  if (value === '720p' || value === '1080p') return value
  return 'auto'
}

function readMicVolumeSetting(): number {
  const raw = localStorage.getItem('settings.micVolume')
  if (raw == null) return 100
  const value = Number(raw)
  if (!Number.isFinite(value)) return 100
  return Math.min(100, Math.max(0, Math.round(value)))
}

function readSpeakerVolumeSetting(): number {
  const raw = localStorage.getItem('settings.speakerVolume') ?? localStorage.getItem('settings.outputVolume')
  if (raw == null) return 100
  const value = Number(raw)
  if (!Number.isFinite(value)) return 100
  return Math.min(100, Math.max(0, Math.round(value)))
}

function toMediaElementVolume(percent: number): number {
  return Math.min(1, Math.max(0, percent / 100))
}

function resolveVideoResolution(quality: VideoQuality): VideoResolution | undefined {
  if (quality === '720p') return { width: 1280, height: 720, frameRate: 30 }
  if (quality === '1080p') return { width: 1920, height: 1080, frameRate: 30 }
  return undefined
}

function readCallMediaSettings(): CallMediaSettings {
  return {
    audioInputId: readSettingDeviceId('settings.audioInputId'),
    audioOutputId: readSettingDeviceId('settings.audioOutputId'),
    videoInputId: readSettingDeviceId('settings.videoInputId'),
    videoQuality: readVideoQualitySetting(),
    micVolume: readMicVolumeSetting(),
    speakerVolume: readSpeakerVolumeSetting(),
    noiseSuppression: readBooleanSetting('settings.noiseSuppression', true),
    echoCancellation: readBooleanSetting('settings.echoCancellation', true),
  }
}

function buildAudioCaptureOptions(settings: CallMediaSettings): AudioCaptureOptions {
  return {
    deviceId: settings.audioInputId,
    sampleRate: 48000,
    // Браузерный шумодав отключён — DeepFilterNet3 применяется отдельно после создания трека
    noiseSuppression: false,
    echoCancellation: settings.echoCancellation ? { ideal: true } : false,
    autoGainControl: false,
  } as AudioCaptureOptions
}

function logAudioSettings(room: LiveKitRoom) {
  const pub = [...room.localParticipant.audioTrackPublications.values()]
    .find((p) => p.track?.mediaStreamTrack?.kind === 'audio')
  const mst = pub?.track?.mediaStreamTrack
  if (!mst) {
    console.log('[audio] no mediaStreamTrack yet')
    return
  }
  console.log('[audio] constraints:', mst.getConstraints?.())
  console.log('[audio] settings:', mst.getSettings?.())
}

function buildVideoCaptureOptions(settings: CallMediaSettings): VideoCaptureOptions {
  return {
    deviceId: settings.videoInputId,
    resolution: resolveVideoResolution(settings.videoQuality),
  }
}

function applyOptimisticReaction(
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
    if (nextCount === 0) {
      current.splice(idx, 1)
    } else {
      current[idx] = { ...item, count: nextCount, reacted_by_me: false }
    }
    return current.length > 0 ? current : undefined
  }

  if (idx === -1) {
    return [...current, { emoji, count: 1, reacted_by_me: true }]
  }

  const item = current[idx]
  current[idx] = { ...item, count: item.count + 1, reacted_by_me: true }
  return current
}

async function getPcRtt(pc: RTCPeerConnection): Promise<number | null> {
  const stats = await pc.getStats()
  let best: number | null = null

  stats.forEach((r) => {
    let rttMs: number | null = null

    // remote-inbound-rtp: roundTripTime — наиболее стабильный источник (Chrome/Firefox)
    if (r.type === 'remote-inbound-rtp' && typeof r.roundTripTime === 'number' && r.roundTripTime > 0) {
      rttMs = Math.round(r.roundTripTime * 1000)
    }

    // candidate-pair: currentRoundTripTime — без фильтра по state (Firefox не всегда ставит succeeded)
    if (r.type === 'candidate-pair' && typeof r.currentRoundTripTime === 'number' && r.currentRoundTripTime > 0) {
      rttMs = Math.round(r.currentRoundTripTime * 1000)
    }

    if (rttMs !== null && (best === null || rttMs < best)) best = rttMs
  })

  return best
}

async function getRttMs(room: LiveKitRoom): Promise<number | null> {
  try {
    const anyRoom = room as unknown as Record<string, unknown>
    const engine = anyRoom['engine'] as Record<string, unknown> | undefined

    // Собираем все доступные peer connections (publisher + subscriber, разные пути LiveKit 2.x)
    const candidates: RTCPeerConnection[] = []

    const addPc = (src: Record<string, unknown> | undefined) => {
      const pc = src?.['pc'] as RTCPeerConnection | undefined
      if (pc && pc.connectionState !== 'closed' && pc.connectionState !== 'failed') {
        candidates.push(pc)
      }
    }

    addPc(engine?.['publisher'] as Record<string, unknown> | undefined)
    addPc(engine?.['subscriber'] as Record<string, unknown> | undefined)

    // LiveKit 2.x pcManager architecture (если используется)
    const pcMgr = engine?.['pcManager'] as Record<string, unknown> | undefined
    addPc(pcMgr?.['publisher'] as Record<string, unknown> | undefined)
    addPc(pcMgr?.['subscriber'] as Record<string, unknown> | undefined)

    for (const pc of candidates) {
      const rtt = await getPcRtt(pc)
      if (rtt !== null) return rtt
    }
  } catch {
    // ignore
  }

  // Fallback: navigator.connection.rtt (доступно в Chromium, приблизительный RTT сети)
  const conn = (navigator as Navigator & { connection?: { rtt?: number } }).connection
  if (typeof conn?.rtt === 'number' && conn.rtt > 0) return conn.rtt

  return null
}

export function ChatPage() {
  const { roomId } = useParams<{ roomId: string }>()
  const rooms = useRoomsStore((s) => s.rooms)
  const dmUsers = useRoomsStore((s) => s.dmUsers)
  const online = usePresenceStore((s) => s.online)
  const refreshRooms = useRoomsStore((s) => s.fetch)
  const currentUser = useAuthStore((s) => s.user)
  const currentUserId = useAuthStore((s) => s.user?.id)

  const room = rooms.find((r) => r.id === roomId)
  const dmUser = roomId ? dmUsers[roomId] : undefined
  const displayName = room?.type === 'dm' ? (dmUser?.display_name ?? '...') : (room?.name ?? 'Группа')
  const isOnline = dmUser ? online.has(dmUser.id) : false
  const color = roomId ? roomColor(roomId) : '#5B8AF5'

  const [messages, setMessages] = useState<Message[]>([])
  const [loading, setLoading] = useState(false)
  const [loadingMore, setLoadingMore] = useState(false)
  const [sending, setSending] = useState(false)
  const [uploadingAttachment, setUploadingAttachment] = useState(false)
  const [hasMore, setHasMore] = useState(true)
  const [content, setContent] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [replyToMessage, setReplyToMessage] = useState<Message | null>(null)
  const [reactionPickerFor, setReactionPickerFor] = useState<string | null>(null)
  const [reactionPopoverPosition, setReactionPopoverPosition] = useState<ReactionPopoverPosition | null>(null)
  const [highlightedMessageId, setHighlightedMessageId] = useState<string | null>(null)
  const [lastReadByUser, setLastReadByUser] = useState<Record<string, string>>({})
  const [friendProfileOpen, setFriendProfileOpen] = useState(false)
  const [friendPhotoOpen, setFriendPhotoOpen] = useState(false)
  const [typingUsers, setTypingUsers] = useState<Map<string, { username: string; display_name?: string }>>(new Map())
  const [activeCall, setActiveCall] = useState<Call | null>(null)
  const [incomingCall, setIncomingCall] = useState<IncomingCallState | null>(null)
  const [callBusy, setCallBusy] = useState(false)
  const [callError, setCallError] = useState<string | null>(null)
  const [inCall, setInCall] = useState(false)
  const [callMode, setCallMode] = useState<'audio' | 'video'>('audio')
  const [micEnabled, setMicEnabled] = useState(true)
  const [cameraEnabled, setCameraEnabled] = useState(false)
  const [remoteVideoCount, setRemoteVideoCount] = useState(0)
  const [remoteParticipantCount, setRemoteParticipantCount] = useState(0)
  const [remoteParticipantTracks, setRemoteParticipantTracks] = useState<Record<string, { microphone?: boolean; camera?: boolean; screen_share?: boolean }>>({})
  const scrollerRef = useRef<HTMLDivElement | null>(null)
  const composerRef = useRef<HTMLTextAreaElement | null>(null)
  const fileInputRef = useRef<HTMLInputElement | null>(null)
  const remoteVideoContainerRef = useRef<HTMLDivElement | null>(null)
  const remoteAudioContainerRef = useRef<HTMLDivElement | null>(null)
  const localVideoRef = useRef<HTMLVideoElement | null>(null)
  const liveKitRoomRef = useRef<LiveKitRoom | null>(null)
  const attachedTrackElementsRef = useRef<Map<string, HTMLMediaElement[]>>(new Map())
  const endingCallIdRef = useRef<string | null>(null)
  const micEnabledRef = useRef(micEnabled)
  const highlightTimerRef = useRef<number | null>(null)
  const openScrollTimerRef = useRef<number | null>(null)
  const newMessageScrollTimerRef = useRef<number | null>(null)
  const lastReadRequestAtRef = useRef(0)
  const lastReadMessageIdRef = useRef<string | null>(null)
  const latestIncomingMessageIdRef = useRef<string | undefined>(undefined)
  const knownMessageIdsRef = useRef<Set<string>>(new Set())
  const isTypingRef = useRef(false)
  const audioContextRef = useRef<AudioContext | null>(null)
  const typingRepeatTimerRef = useRef<number | null>(null)
  const typingAutoRemoveTimers = useRef<Map<string, number>>(new Map())

  const oldestId = useMemo(() => (messages.length > 0 ? messages[0].id : undefined), [messages])
  const newestId = useMemo(() => (messages.length > 0 ? messages[messages.length - 1].id : undefined), [messages])
  const typingLabel = useMemo(() => {
    const list = [...typingUsers.values()]
    if (list.length === 0) return ''
    const name = (u: { username: string; display_name?: string }) => u.display_name || u.username
    if (list.length === 1) return `${name(list[0])} печатает...`
    if (list.length === 2) return `${name(list[0])} и ${name(list[1])} печатают...`
    return `${list.length} человека печатают...`
  }, [typingUsers])
  const usersById = useMemo(() => {
    const map = new Map<string, { username: string; display_name?: string; avatar_url?: string }>()
    if (currentUser) {
      map.set(currentUser.id, {
        username: currentUser.username,
        display_name: currentUser.display_name,
        avatar_url: currentUser.avatar_url,
      })
    }

    for (const user of Object.values(dmUsers)) {
      map.set(user.id, {
        username: user.username,
        display_name: user.display_name,
        avatar_url: user.avatar_url,
      })
    }

    return map
  }, [currentUser, dmUsers])

  const usersByUsername = useMemo(() => {
    const map = new Map<string, { id: string; username: string; display_name?: string; avatar_url?: string }>()
    if (currentUser) {
      map.set(currentUser.username, {
        id: currentUser.id,
        username: currentUser.username,
        display_name: currentUser.display_name,
        avatar_url: currentUser.avatar_url,
      })
    }

    for (const user of Object.values(dmUsers)) {
      map.set(user.username, {
        id: user.id,
        username: user.username,
        display_name: user.display_name,
        avatar_url: user.avatar_url,
      })
    }

    return map
  }, [currentUser, dmUsers])

  const activeReactionMessage = useMemo(
    () => (reactionPickerFor ? messages.find((message) => message.id === reactionPickerFor) ?? null : null),
    [reactionPickerFor, messages],
  )

  const activeReactionMessageReactions = activeReactionMessage?.reactions ?? []
  const peerLastReadAt = room?.type === 'dm' && dmUser ? lastReadByUser[dmUser.id] : undefined
  const latestIncomingMessageId = useMemo(() => {
    for (let i = messages.length - 1; i >= 0; i -= 1) {
      const msg = messages[i]
      const authorId = msg.author.id?.trim()
      const authorUsername = msg.author.username?.trim()
      const isOwn =
        (authorId != null && authorId.length > 0 && authorId === currentUserId) ||
        (authorUsername != null && authorUsername.length > 0 && authorUsername === currentUser?.username)
      if (!isOwn) return msg.id
    }
    return undefined
  }, [messages, currentUserId, currentUser?.username])

  useEffect(() => {
    latestIncomingMessageIdRef.current = latestIncomingMessageId
  }, [latestIncomingMessageId])

  useEffect(() => {
    micEnabledRef.current = micEnabled
  }, [micEnabled])

  useEffect(() => {
    knownMessageIdsRef.current = new Set(messages.map((m) => m.id))
  }, [messages])

  const scrollToBottom = useCallback(() => {
    const node = scrollerRef.current
    if (!node) return
    node.scrollTop = node.scrollHeight
  }, [])

  const scrollToBottomSoon = useCallback(() => {
    requestAnimationFrame(() => scrollToBottom())
    if (newMessageScrollTimerRef.current !== null) {
      window.clearTimeout(newMessageScrollTimerRef.current)
    }
    newMessageScrollTimerRef.current = window.setTimeout(() => {
      scrollToBottom()
      newMessageScrollTimerRef.current = null
    }, 80)
  }, [scrollToBottom])

  const isMessageVisibleInScroller = useCallback((messageId: string) => {
    const container = scrollerRef.current
    const target = document.getElementById(`msg-${messageId}`)
    if (!container || !target) return false

    const containerRect = container.getBoundingClientRect()
    const targetRect = target.getBoundingClientRect()
    const visibleTop = Math.max(containerRect.top, targetRect.top)
    const visibleBottom = Math.min(containerRect.bottom, targetRect.bottom)
    const visibleHeight = Math.max(0, visibleBottom - visibleTop)
    const totalHeight = Math.max(1, targetRect.height)
    const ratio = visibleHeight / totalHeight

    return ratio >= 0.6
  }, [])

  const isOwnAuthor = useCallback((author?: { id?: string; username?: string }) => {
    const authorId = author?.id?.trim()
    const authorUsername = author?.username?.trim()
    return (
      (authorId != null && authorId.length > 0 && authorId === currentUserId) ||
      (authorUsername != null && authorUsername.length > 0 && authorUsername === currentUser?.username)
    )
  }, [currentUserId, currentUser?.username])

  const clearAttachedTracks = useCallback(() => {
    attachedTrackElementsRef.current.forEach((elements) => {
      for (const element of elements) {
        element.pause?.()
        if (element.parentElement) {
          element.parentElement.removeChild(element)
        }
      }
    })
    attachedTrackElementsRef.current.clear()
    setRemoteVideoCount(0)
  }, [])

  const attachLocalVideoTrack = useCallback((roomInstance: LiveKitRoom) => {
    if (!localVideoRef.current) return
    const videoPublication = [...roomInstance.localParticipant.videoTrackPublications.values()].find(
      (publication) => publication.track != null,
    )
    if (!videoPublication?.track) {
      localVideoRef.current.srcObject = null
      return
    }
    videoPublication.track.attach(localVideoRef.current)
    localVideoRef.current.muted = true
    localVideoRef.current.autoplay = true
    localVideoRef.current.playsInline = true
  }, [])

  const detachTrackByKey = useCallback((trackKey: string) => {
    const elements = attachedTrackElementsRef.current.get(trackKey)
    if (!elements) return
    for (const element of elements) {
      element.pause?.()
      if (element.parentElement) {
        element.parentElement.removeChild(element)
      }
    }
    attachedTrackElementsRef.current.delete(trackKey)
    setRemoteVideoCount(remoteVideoContainerRef.current?.childElementCount ?? 0)
  }, [])

  // volume constraint не поддерживается в WebRTC — управление громкостью входа
  // возможно только через WebAudio GainNode; пока оставляем заглушку
  const applyMicVolumeToRoom = useCallback(async (_micVolume: number) => {}, [])

  // Применяет DeepFilterNet3 к уже опубликованному треку микрофона.
  // Процессор нельзя передавать в setMicrophoneEnabled — LiveKit не успевает
  // установить audioContext на новый трек до вызова setProcessor.
  const applyNoiseProcessorIfEnabled = useCallback(async (room: LiveKitRoom) => {
    const settings = readCallMediaSettings()
    if (!settings.noiseSuppression) return

    const micPub = [...room.localParticipant.audioTrackPublications.values()]
      .find((pub) => pub.source === Track.Source.Microphone)
    if (!micPub?.track) return

    const audioTrack = micPub.track as LocalAudioTrack

    if (!audioContextRef.current || audioContextRef.current.state === 'closed') {
      audioContextRef.current = new AudioContext()
    }
    const ctx = audioContextRef.current
    if (ctx.state === 'suspended') {
      await ctx.resume()
    }

    audioTrack.setAudioContext(ctx)
    try {
      const { DeepFilterNoiseFilterProcessor } = await import('deepfilternet3-noise-filter')
      await audioTrack.setProcessor(
        new DeepFilterNoiseFilterProcessor({
          sampleRate: 48000,
          noiseReductionLevel: 60,
          assetConfig: { cdnUrl: '/deepfilter' },
        }),
      )
    } catch (e) {
      console.warn('[mic] Failed to apply DeepFilterNet3 processor:', e)
    }
  }, [])

  const applyOutputVolumeToAttachedElements = useCallback((outputVolume: number) => {
    const normalizedVolume = toMediaElementVolume(outputVolume)
    const isMuted = normalizedVolume === 0
    attachedTrackElementsRef.current.forEach((elements) => {
      for (const element of elements) {
        element.volume = normalizedVolume
        element.muted = isMuted
      }
    })
  }, [])

  const restartMicWithNewSettings = useCallback(async () => {
    const roomInstance = liveKitRoomRef.current
    if (!roomInstance || !micEnabledRef.current) return
    try {
      await roomInstance.localParticipant.setMicrophoneEnabled(false)
      const newSettings = readCallMediaSettings()
      await roomInstance.localParticipant.setMicrophoneEnabled(true, buildAudioCaptureOptions(newSettings))
      await applyMicVolumeToRoom(newSettings.micVolume)
      await applyNoiseProcessorIfEnabled(roomInstance)
    } catch {
      // Ignore — mic restart is best-effort
    }
  }, [applyMicVolumeToRoom, applyNoiseProcessorIfEnabled])

  const attachRemoteTrack = useCallback((trackKey: string, track: Track) => {
    const element = track.attach()
    element.autoplay = true
    element.controls = false
    const normalizedVolume = toMediaElementVolume(readSpeakerVolumeSetting())
    element.volume = normalizedVolume
    element.muted = normalizedVolume === 0

    if (track.kind === Track.Kind.Video) {
      if (element instanceof HTMLVideoElement) {
        element.playsInline = true
      }
      element.className = 'w-full h-full object-contain bg-black'
      remoteVideoContainerRef.current?.appendChild(element)
      setRemoteVideoCount(remoteVideoContainerRef.current?.childElementCount ?? 0)
    } else {
      element.className = 'hidden'
      remoteAudioContainerRef.current?.appendChild(element)
    }

    const existing = attachedTrackElementsRef.current.get(trackKey) ?? []
    attachedTrackElementsRef.current.set(trackKey, [...existing, element])
  }, [])

  useEffect(() => {
    const syncVolume = () => {
      applyOutputVolumeToAttachedElements(readSpeakerVolumeSetting())
    }

    const onSettingsChanged = (event: Event) => {
      const customEvent = event as CustomEvent<{
        speakerVolume?: number
        micVolume?: number
        noiseSuppression?: boolean
        echoCancellation?: boolean
        audioInputId?: string
        audioOutputId?: string
      }>
      const detail = customEvent.detail ?? {}

      if (typeof detail.speakerVolume === 'number') {
        applyOutputVolumeToAttachedElements(detail.speakerVolume)
      } else if (
        detail.audioInputId === undefined &&
        detail.audioOutputId === undefined &&
        detail.noiseSuppression === undefined &&
        detail.echoCancellation === undefined
      ) {
        syncVolume()
      }

      if (typeof detail.micVolume === 'number') {
        void applyMicVolumeToRoom(detail.micVolume)
      }

      // Restart mic track when constraints or device change
      if (
        detail.noiseSuppression !== undefined ||
        detail.echoCancellation !== undefined ||
        detail.audioInputId !== undefined
      ) {
        void restartMicWithNewSettings()
      }
    }

    syncVolume()
    window.addEventListener('nook:call-settings-changed', onSettingsChanged as EventListener)
    return () => {
      window.removeEventListener('nook:call-settings-changed', onSettingsChanged as EventListener)
    }
  }, [applyMicVolumeToRoom, applyOutputVolumeToAttachedElements, restartMicWithNewSettings])

  // Подключаем локальный видеотрек ПОСЛЕ рендера, когда localVideoRef.current уже установлен.
  // attachLocalVideoTrack вызывается синхронно до ре-рендера → ref ещё null → трек теряется.
  useEffect(() => {
    if (!cameraEnabled || !liveKitRoomRef.current) return
    attachLocalVideoTrack(liveKitRoomRef.current)
  }, [cameraEnabled, attachLocalVideoTrack])

  // Когда inCall становится true, панель монтируется и remoteVideoContainerRef.current наконец
  // установлен. Перепривязываем удалённые треки, которые были получены до монтирования панели
  // (attachRemoteTrack вызывался пока inCall=false → ref=null → appendChild упал молча).
  useEffect(() => {
    if (!inCall || !remoteVideoContainerRef.current || !liveKitRoomRef.current) return
    liveKitRoomRef.current.remoteParticipants.forEach((participant) => {
      participant.trackPublications.forEach((publication) => {
        if (!publication.track) return
        const key = publication.trackSid
        // Если элемент уже реально добавлен в DOM — пропускаем
        const existing = attachedTrackElementsRef.current.get(key)
        if (existing?.some((el) => el.parentElement != null)) return
        // Удаляем осиротевшую запись (элемент создан, но не добавлен) и прикрепляем заново
        if (existing) attachedTrackElementsRef.current.delete(key)
        attachRemoteTrack(key, publication.track)
      })
    })
  }, [inCall, attachRemoteTrack])

  const disconnectCallSession = useCallback(() => {
    const roomInstance = liveKitRoomRef.current
    if (roomInstance) {
      roomInstance.disconnect()
      liveKitRoomRef.current = null
    }
    // Закрываем AudioContext — иначе AudioWorklet DeepFilterNet3 держит
    // ссылку на MediaStream и браузер не отпускает микрофон
    if (audioContextRef.current) {
      void audioContextRef.current.close()
      audioContextRef.current = null
    }
    clearAttachedTracks()
    if (localVideoRef.current) {
      localVideoRef.current.srcObject = null
    }
    setInCall(false)
    setRemoteParticipantCount(0)
    setRemoteParticipantTracks({})
    setMicEnabled(true)
    setCameraEnabled(false)
    setCallMode('audio')
  }, [clearAttachedTracks])

  const connectLiveKit = useCallback(async (token: string, livekitUrl: string, withVideo: boolean) => {
    const mediaSettings = readCallMediaSettings()
    const roomInstance = new LiveKitRoom({
      adaptiveStream: true,
      dynacast: true,
      videoCaptureDefaults: buildVideoCaptureOptions(mediaSettings),
      audioOutput: mediaSettings.audioOutputId ? { deviceId: mediaSettings.audioOutputId } : undefined,
    })
    liveKitRoomRef.current = roomInstance
    try {
      roomInstance.on(RoomEvent.TrackSubscribed, (track, publication) => {
        attachRemoteTrack(publication.trackSid, track)
      })

      roomInstance.on(RoomEvent.TrackUnsubscribed, (_track, publication) => {
        detachTrackByKey(publication.trackSid)
      })

      roomInstance.on(RoomEvent.LocalTrackPublished, (publication) => {
        if (publication.kind === Track.Kind.Video) {
          attachLocalVideoTrack(roomInstance)
        }
      })

      roomInstance.on(RoomEvent.LocalTrackUnpublished, (publication) => {
        if (publication.kind !== Track.Kind.Video || !localVideoRef.current) return
        publication.track?.detach(localVideoRef.current)
        localVideoRef.current.srcObject = null
      })

      roomInstance.on(RoomEvent.Disconnected, () => {
        clearAttachedTracks()
        if (localVideoRef.current) {
          localVideoRef.current.srcObject = null
        }
        setInCall(false)
        setRemoteParticipantCount(0)
      })

      roomInstance.on(RoomEvent.ParticipantConnected, () => {
        setRemoteParticipantCount(roomInstance.remoteParticipants.size)
      })

      roomInstance.on(RoomEvent.ParticipantDisconnected, () => {
        setRemoteParticipantCount(roomInstance.remoteParticipants.size)
      })

      // Апгрейдим ws:// → wss:// если страница открыта по HTTPS (иначе Mixed Content)
      const safeUrl =
        window.location.protocol === 'https:' && livekitUrl.startsWith('ws://')
          ? 'wss://' + livekitUrl.slice('ws://'.length)
          : livekitUrl
      await roomInstance.connect(safeUrl, token)

      let micIsEnabled = false
      try {
        await roomInstance.localParticipant.setMicrophoneEnabled(true, buildAudioCaptureOptions(mediaSettings))
        micIsEnabled = true
      } catch (micErr) {
        console.error('[mic] setMicrophoneEnabled failed:', micErr)
        setCallError((prev) => prev ?? 'Подключено без микрофона: разрешение не выдано или устройство недоступно.')
      }
      if (micIsEnabled) {
        await applyNoiseProcessorIfEnabled(roomInstance)
        logAudioSettings(roomInstance)
        await applyMicVolumeToRoom(mediaSettings.micVolume)
      }

      let cameraIsEnabled = false
      if (withVideo) {
        try {
          await roomInstance.localParticipant.setCameraEnabled(true, buildVideoCaptureOptions(mediaSettings))
          cameraIsEnabled = true
        } catch {
          setCallError((prev) => prev ?? 'Подключено без камеры: разрешение не выдано или устройство недоступно.')
        }
      }

      setMicEnabled(micIsEnabled)
      setCameraEnabled(cameraIsEnabled)
      setCallMode(cameraIsEnabled ? 'video' : 'audio')
      attachLocalVideoTrack(roomInstance)
      setRemoteParticipantCount(roomInstance.remoteParticipants.size)

      roomInstance.remoteParticipants.forEach((participant) => {
        participant.trackPublications.forEach((publication) => {
          if (!publication.track) return
          attachRemoteTrack(publication.trackSid, publication.track)
        })
      })

      setInCall(true)
    } catch (err) {
      roomInstance.disconnect()
      if (liveKitRoomRef.current === roomInstance) {
        liveKitRoomRef.current = null
      }
      clearAttachedTracks()
      if (localVideoRef.current) {
        localVideoRef.current.srcObject = null
      }
      setInCall(false)
      throw err
    }
  }, [applyMicVolumeToRoom, attachLocalVideoTrack, attachRemoteTrack, clearAttachedTracks, detachTrackByKey])

  const refreshActiveCall = useCallback(async (targetRoomId: string) => {
    try {
      const response = await callsApi.active(targetRoomId)
      setActiveCall(response.call)
    } catch (err) {
      if (err instanceof ApiError && err.status === 404) {
        setActiveCall(null)
        return
      }
      throw err
    }
  }, [])

  const handleStartCall = useCallback(async (withVideo: boolean) => {
    if (!roomId || callBusy) return
    setCallBusy(true)
    setCallError(null)
    try {
      const response = await callsApi.start(roomId)
      setActiveCall(response.call)
      setIncomingCall(null)
      disconnectCallSession()
      await connectLiveKit(response.token, response.livekit_url, withVideo)
    } catch (err) {
      if (err instanceof ApiError && err.status === 403) {
        setCallError('Нельзя начать звонок: вы не участник комнаты.')
      } else {
        setCallError('Не удалось начать звонок.')
      }
    } finally {
      setCallBusy(false)
    }
  }, [roomId, callBusy, disconnectCallSession, connectLiveKit])

  const handleAcceptCall = useCallback(async (callId: string, withVideo: boolean) => {
    if (callBusy) return
    setCallBusy(true)
    setCallError(null)
    try {
      const response = await callsApi.accept(callId)
      setActiveCall(response.call)
      setIncomingCall(null)
      disconnectCallSession()
      await connectLiveKit(response.token, response.livekit_url, withVideo)
    } catch (err) {
      if (err instanceof ApiError && err.status === 409) {
        setCallError('Звонок уже не активен.')
      } else if (err instanceof ApiError && err.status === 403) {
        setCallError('Нельзя принять этот звонок.')
      } else {
        setCallError('Не удалось принять звонок.')
      }
    } finally {
      setCallBusy(false)
    }
  }, [callBusy, disconnectCallSession, connectLiveKit])

  useEffect(() => {
    if (!roomId) return

    const pending = readPendingCallAccept()
    if (!pending) return
    if (pending.roomId !== roomId) return

    if (pending.createdAt) {
      const createdAtTs = Date.parse(pending.createdAt)
      if (!Number.isNaN(createdAtTs) && Date.now() - createdAtTs > 5 * 60 * 1000) {
        clearPendingCallAccept()
        return
      }
    }

    clearPendingCallAccept()
    void handleAcceptCall(pending.callId, pending.withVideo)
  }, [roomId, handleAcceptCall])

  const handleDeclineCall = useCallback(async (callId: string) => {
    if (callBusy) return
    setCallBusy(true)
    setCallError(null)
    try {
      await callsApi.decline(callId)
      setActiveCall(null)
      setIncomingCall(null)
    } catch (err) {
      if (err instanceof ApiError && err.status === 409) {
        setCallError('Звонок уже не в ожидании.')
      } else {
        setCallError('Не удалось отклонить звонок.')
      }
    } finally {
      setCallBusy(false)
    }
  }, [callBusy])

  const handleHangUp = useCallback(async () => {
    if (!activeCall || callBusy) return
    const roomInstance = liveKitRoomRef.current
    const isLast = !roomInstance || roomInstance.remoteParticipants.size === 0

    if (isLast) {
      // Последний участник — завершаем звонок для всех
      setCallBusy(true)
      setCallError(null)
      endingCallIdRef.current = activeCall.id
      try {
        await callsApi.end(activeCall.id)
      } catch (err) {
        if (!(err instanceof ApiError && err.status === 404)) {
          setCallError('Не удалось завершить звонок.')
        }
      } finally {
        setActiveCall(null)
        setIncomingCall(null)
        disconnectCallSession()
        setCallBusy(false)
      }
    } else {
      // Другие участники ещё в звонке — просто уходим
      disconnectCallSession()
      // activeCall остаётся, чтобы показать кнопку "Войти снова"
    }
  }, [activeCall, callBusy, disconnectCallSession])

  const handleJoinActiveCall = useCallback(async (withVideo: boolean) => {
    if (!activeCall || callBusy) return
    await handleAcceptCall(activeCall.id, withVideo)
  }, [activeCall, callBusy, handleAcceptCall])

  const handleToggleMic = useCallback(async () => {
    const roomInstance = liveKitRoomRef.current
    if (!roomInstance || callBusy) return
    try {
      if (!micEnabled) {
        const mediaSettings = readCallMediaSettings()
        await roomInstance.localParticipant.setMicrophoneEnabled(true, buildAudioCaptureOptions(mediaSettings))
        await applyMicVolumeToRoom(mediaSettings.micVolume)
        await applyNoiseProcessorIfEnabled(roomInstance)
      } else {
        await roomInstance.localParticipant.setMicrophoneEnabled(false)
      }
      setMicEnabled((prev) => !prev)
    } catch {
      setCallError('Не удалось переключить микрофон.')
    }
  }, [applyMicVolumeToRoom, applyNoiseProcessorIfEnabled, callBusy, micEnabled])

  const handleToggleCamera = useCallback(async () => {
    const roomInstance = liveKitRoomRef.current
    if (!roomInstance || callBusy) return
    try {
      if (!cameraEnabled) {
        const mediaSettings = readCallMediaSettings()
        await roomInstance.localParticipant.setCameraEnabled(true, buildVideoCaptureOptions(mediaSettings))
      } else {
        await roomInstance.localParticipant.setCameraEnabled(false)
      }
      setCameraEnabled((prev) => !prev)
      setCallMode((prev) => {
        if (prev === 'video' && cameraEnabled) return 'audio'
        return !cameraEnabled ? 'video' : prev
      })
      attachLocalVideoTrack(roomInstance)
    } catch {
      setCallError('Не удалось переключить камеру.')
    }
  }, [attachLocalVideoTrack, callBusy, cameraEnabled])

  const markRoomRead = useCallback((force = false) => {
    if (!roomId) return
    const latestIncomingId = latestIncomingMessageIdRef.current
    if (!latestIncomingId && !force) return
    if (!force && latestIncomingId && !isMessageVisibleInScroller(latestIncomingId)) return
    if (!force && latestIncomingId && lastReadMessageIdRef.current === latestIncomingId) return
    const now = Date.now()
    if (!force && now - lastReadRequestAtRef.current < 1200) return
    lastReadRequestAtRef.current = now
    if (latestIncomingId) {
      lastReadMessageIdRef.current = latestIncomingId
    }
    void roomsApi.read(roomId).catch(() => {
      // Ignore read-mark errors.
    })
  }, [roomId, isMessageVisibleInScroller])

  const positionReactionPopover = useCallback((messageId: string) => {
    const anchor = document.querySelector<HTMLButtonElement>(`[data-reaction-anchor-id="${messageId}"]`)
    if (!anchor) {
      setReactionPopoverPosition(null)
      return
    }

    const rect = anchor.getBoundingClientRect()
    const maxLeft = Math.max(
      REACTION_POPPER_VIEWPORT_PADDING,
      window.innerWidth - REACTION_POPPER_WIDTH - REACTION_POPPER_VIEWPORT_PADDING,
    )

    let left = rect.left + rect.width / 2 - REACTION_POPPER_WIDTH / 2
    left = Math.max(REACTION_POPPER_VIEWPORT_PADDING, Math.min(left, maxLeft))

    let top = rect.bottom + REACTION_POPPER_OFFSET
    if (top + REACTION_POPPER_HEIGHT > window.innerHeight - REACTION_POPPER_VIEWPORT_PADDING) {
      top = rect.top - REACTION_POPPER_HEIGHT - REACTION_POPPER_OFFSET
    }
    top = Math.max(REACTION_POPPER_VIEWPORT_PADDING, top)

    setReactionPopoverPosition({ left, top })
  }, [])

  const toggleReactionPopover = useCallback((messageId: string) => {
    setReactionPickerFor((prev) => {
      if (prev === messageId) {
        setReactionPopoverPosition(null)
        return null
      }
      requestAnimationFrame(() => {
        positionReactionPopover(messageId)
      })
      return messageId
    })
  }, [positionReactionPopover])

  useEffect(() => {
    if (!roomId) return
    let cancelled = false

    setLoading(true)
    setError(null)
    setMessages([])
    knownMessageIdsRef.current = new Set()
    setHasMore(true)

    messagesApi
      .list(roomId, { limit: PAGE_SIZE })
      .then((res) => {
        if (cancelled) return
        const normalized = normalizeForRender(res.messages)
        setMessages(normalized)
        knownMessageIdsRef.current = new Set(normalized.map((m) => m.id))
        setHasMore(res.messages.length === PAGE_SIZE)

        // Open chat at the latest message.
        requestAnimationFrame(() => scrollToBottom())
        if (openScrollTimerRef.current !== null) {
          window.clearTimeout(openScrollTimerRef.current)
        }
        openScrollTimerRef.current = window.setTimeout(() => {
          scrollToBottom()
          markRoomRead()
          openScrollTimerRef.current = null
        }, 120)

        void roomsApi.members(roomId)
          .then(({ members }) => {
            if (cancelled) return
            const next: Record<string, string> = {}
            for (const member of members) {
              if (member.user_id === currentUserId) continue
              if (member.last_read_at) {
                next[member.user_id] = member.last_read_at
              }
            }
            setLastReadByUser((prev) => ({ ...prev, ...next }))
          })
          .catch(() => {
            // Ignore members read-state load errors.
          })
      })
      .catch((err) => {
        if (cancelled) return
        if (err instanceof ApiError && err.status === 403) {
          setError('Нет доступа к этой комнате.')
        } else {
          setError('Не удалось загрузить сообщения.')
        }
      })
      .finally(() => {
        if (!cancelled) setLoading(false)
      })

    return () => {
      cancelled = true
      if (openScrollTimerRef.current !== null) {
        window.clearTimeout(openScrollTimerRef.current)
        openScrollTimerRef.current = null
      }
    }
  }, [roomId, scrollToBottom, markRoomRead, currentUserId])

  useEffect(() => {
    if (!roomId) return
    let cancelled = false

    setCallError(null)
    callsApi.active(roomId)
      .then((response) => {
        if (cancelled) return
        setActiveCall(response.call)
      })
      .catch((err) => {
        if (cancelled) return
        if (err instanceof ApiError && err.status === 404) {
          setActiveCall(null)
          return
        }
        setCallError('Не удалось загрузить состояние звонка.')
      })

    return () => {
      cancelled = true
    }
  }, [roomId])

  useEffect(() => {
    setReplyToMessage(null)
    setReactionPickerFor(null)
    setReactionPopoverPosition(null)
    setHighlightedMessageId(null)
    setLastReadByUser({})
    setFriendProfileOpen(false)
    setFriendPhotoOpen(false)
    setTypingUsers(new Map())
    setActiveCall(null)
    setIncomingCall(null)
    setCallError(null)
    setRemoteParticipantTracks({})
    endingCallIdRef.current = null
    disconnectCallSession()
    lastReadRequestAtRef.current = 0
    lastReadMessageIdRef.current = null
    latestIncomingMessageIdRef.current = undefined
    knownMessageIdsRef.current = new Set()
    if (highlightTimerRef.current !== null) {
      window.clearTimeout(highlightTimerRef.current)
      highlightTimerRef.current = null
    }
    isTypingRef.current = false
    if (typingRepeatTimerRef.current !== null) {
      window.clearInterval(typingRepeatTimerRef.current)
      typingRepeatTimerRef.current = null
    }
    typingAutoRemoveTimers.current.forEach((t) => window.clearTimeout(t))
    typingAutoRemoveTimers.current.clear()
  }, [roomId, disconnectCallSession])

  useEffect(() => {
    if (!friendProfileOpen && !friendPhotoOpen) return

    const handler = (event: KeyboardEvent) => {
      if (event.key !== 'Escape') return
      if (friendPhotoOpen) {
        setFriendPhotoOpen(false)
        return
      }
      setFriendProfileOpen(false)
    }

    window.addEventListener('keydown', handler)
    return () => {
      window.removeEventListener('keydown', handler)
    }
  }, [friendProfileOpen, friendPhotoOpen])

  useEffect(() => {
    const typingTimers = typingAutoRemoveTimers.current
    return () => {
      disconnectCallSession()
      if (highlightTimerRef.current !== null) {
        window.clearTimeout(highlightTimerRef.current)
      }
      if (openScrollTimerRef.current !== null) {
        window.clearTimeout(openScrollTimerRef.current)
      }
      if (newMessageScrollTimerRef.current !== null) {
        window.clearTimeout(newMessageScrollTimerRef.current)
      }
      if (typingRepeatTimerRef.current !== null) {
        window.clearInterval(typingRepeatTimerRef.current)
      }
      typingTimers.forEach((t) => window.clearTimeout(t))
      typingTimers.clear()
    }
  }, [disconnectCallSession])

  useEffect(() => {
    if (!reactionPickerFor) return

    const reposition = () => {
      positionReactionPopover(reactionPickerFor)
    }

    const rafId = requestAnimationFrame(reposition)
    window.addEventListener('resize', reposition)
    window.addEventListener('scroll', reposition, true)

    return () => {
      cancelAnimationFrame(rafId)
      window.removeEventListener('resize', reposition)
      window.removeEventListener('scroll', reposition, true)
    }
  }, [reactionPickerFor, positionReactionPopover])

  useEffect(() => {
    if (!roomId) return

    const unsubscribe = subscribe((event) => {
      if (event.type === 'call.incoming') {
        const payload = (event.payload ?? {}) as CallIncomingPayload & { callId?: string; roomId?: string }
        const callId = resolveCallId(payload)
        const eventRoomId = resolveCallRoomId(payload)
        if (!callId || !eventRoomId || eventRoomId !== roomId) return
        setIncomingCall({
          id: callId,
          roomId: eventRoomId,
          caller: resolveCallCaller(payload),
        })
        void refreshActiveCall(eventRoomId).catch(() => {
          setCallError('Не удалось обновить входящий звонок.')
        })
      }

      if (event.type === 'call.accepted') {
        const payload = (event.payload ?? {}) as CallAcceptedPayload & { callId?: string; roomId?: string }
        const callId = resolveCallId(payload)
        const eventRoomId = resolveCallRoomId(payload)
        if (!callId || !eventRoomId || eventRoomId !== roomId) return
        setActiveCall((prev) => {
          if (!prev || prev.id !== callId) return prev
          return {
            ...prev,
            status: 'accepted',
            started_at: prev.started_at ?? new Date().toISOString(),
          }
        })
      }

      if (event.type === 'call.declined') {
        const payload = (event.payload ?? {}) as CallDeclinedPayload & { callId?: string; roomId?: string }
        const callId = resolveCallId(payload)
        const eventRoomId = resolveCallRoomId(payload)
        if (!callId || !eventRoomId || eventRoomId !== roomId) return
        setIncomingCall((prev) => (prev?.id === callId ? null : prev))
        setActiveCall((prev) => {
          if (!prev || prev.id !== callId) return prev
          return { ...prev, status: 'declined' }
        })
        if (inCall) {
          disconnectCallSession()
        }
        if (payload.user_id && payload.user_id !== currentUserId) {
          setCallError('Звонок отклонён.')
        }
      }

      if (event.type === 'call.ended') {
        const payload = (event.payload ?? {}) as CallEndedPayload & { callId?: string; roomId?: string }
        const callId = resolveCallId(payload)
        const eventRoomId = resolveCallRoomId(payload)
        if (!callId || !eventRoomId || eventRoomId !== roomId) return
        setIncomingCall((prev) => (prev?.id === callId ? null : prev))
        setActiveCall((prev) => {
          if (!prev || prev.id !== callId) return prev
          return { ...prev, status: 'ended', ended_at: prev.ended_at ?? new Date().toISOString() }
        })
        disconnectCallSession()
        if (endingCallIdRef.current !== callId) {
          setCallError('Звонок завершён.')
        }
        endingCallIdRef.current = null
      }

      if (event.type === 'message.new') {
        const payload = event.payload as Message | undefined
        if (!payload || payload.room_id !== roomId) return
        if (!payload.id || knownMessageIdsRef.current.has(payload.id)) return
        knownMessageIdsRef.current.add(payload.id)
        setMessages((prev) => normalizeForRender([...prev, payload]))
        scrollToBottomSoon()
        if (!isOwnAuthor(payload.author)) {
          const peerId = payload.author?.id?.trim()
          if (peerId && payload.created_at) {
            setLastReadByUser((prev) => {
              const prevValue = prev[peerId]
              const prevMs = toMillis(prevValue)
              const nextMs = toMillis(payload.created_at)
              if (!Number.isNaN(prevMs) && !Number.isNaN(nextMs) && prevMs >= nextMs) return prev
              return { ...prev, [peerId]: payload.created_at }
            })
          }
          markRoomRead()
        }
      }

      if (event.type === 'message.edit') {
        const payload = event.payload as Message | undefined
        if (!payload || payload.room_id !== roomId) return
        setMessages((prev) => prev.map((m) => (m.id === payload.id ? { ...m, ...payload } : m)))
      }

      if (event.type === 'message.delete') {
        const payload = (event.payload ?? {}) as MessageDeletePayload
        if (payload.room_id !== roomId || !payload.id) return
        knownMessageIdsRef.current.delete(payload.id)
        setReplyToMessage((prev) => (prev?.id === payload.id ? null : prev))
        setMessages((prev) => prev.filter((m) => m.id !== payload.id))
      }

      if (event.type === 'message.reaction') {
        const payload = (event.payload ?? {}) as MessageReactionPayload
        if (!payload.message_id || payload.room_id !== roomId || !payload.emoji || !payload.action) return
        const emoji = payload.emoji

        setMessages((prev) =>
          prev.map((m) => {
            if (m.id !== payload.message_id) return m

            const existing = m.reactions ?? []
            const idx = existing.findIndex((r) => r.emoji === emoji)
            const currentEntry = idx >= 0 ? existing[idx] : undefined
            const nextCount = Math.max(0, payload.count ?? currentEntry?.count ?? 0)

            if (nextCount <= 0) {
              const nextReactions = existing.filter((r) => r.emoji !== emoji)
              return { ...m, reactions: nextReactions.length > 0 ? nextReactions : undefined }
            }

            const reactedByMe =
              payload.user_id === currentUserId
                ? payload.action === 'add'
                : (currentEntry?.reacted_by_me ?? false)

            const nextEntry = {
              emoji,
              count: nextCount,
              reacted_by_me: reactedByMe,
            }

            if (idx >= 0) {
              const nextReactions = [...existing]
              nextReactions[idx] = nextEntry
              return { ...m, reactions: nextReactions }
            }

            return { ...m, reactions: [...existing, nextEntry] }
          }),
        )
      }

      if (event.type === 'typing.start') {
        const payload = event.payload as { room_id?: string; user_id?: string; username?: string; display_name?: string }
        if (!payload.room_id || payload.room_id !== roomId || !payload.user_id) return
        const userId = payload.user_id
        const existing = typingAutoRemoveTimers.current.get(userId)
        if (existing !== undefined) window.clearTimeout(existing)
        setTypingUsers((prev) => {
          const next = new Map(prev)
          next.set(userId, { username: payload.username ?? userId, display_name: payload.display_name })
          return next
        })
        const timer = window.setTimeout(() => {
          setTypingUsers((prev) => { const next = new Map(prev); next.delete(userId); return next })
          typingAutoRemoveTimers.current.delete(userId)
        }, 6000)
        typingAutoRemoveTimers.current.set(userId, timer)
      }

      if (event.type === 'typing.stop') {
        const payload = event.payload as { room_id?: string; user_id?: string }
        if (!payload.room_id || payload.room_id !== roomId || !payload.user_id) return
        const userId = payload.user_id
        const existing = typingAutoRemoveTimers.current.get(userId)
        if (existing !== undefined) { window.clearTimeout(existing); typingAutoRemoveTimers.current.delete(userId) }
        setTypingUsers((prev) => { const next = new Map(prev); next.delete(userId); return next })
      }

      if (event.type === 'message.read') {
        const payload = event.payload as MessageReadPayload
        if (!payload.room_id || payload.room_id !== roomId || !payload.user_id || !payload.last_read_at) return
        if (payload.user_id === currentUserId) return
        setLastReadByUser((prev) => {
          const prevValue = prev[payload.user_id!]
          const prevMs = toMillis(prevValue)
          const nextMs = toMillis(payload.last_read_at)
          if (!Number.isNaN(prevMs) && !Number.isNaN(nextMs) && prevMs >= nextMs) return prev
          return { ...prev, [payload.user_id!]: payload.last_read_at! }
        })
      }

      if (event.type === 'call.participant_left') {
        const payload = (event.payload ?? {}) as {
          call_id?: string
          room_id?: string
          user_id?: string
        }
        if (!payload.call_id || payload.room_id !== roomId) return
        // Когда не в LiveKit-комнате, обновляем счётчик вручную (в звонке это делает SDK)
        if (!inCall) {
          setRemoteParticipantCount((prev) => Math.max(0, prev - 1))
        }
        if (payload.user_id) {
          setRemoteParticipantTracks((prev) => {
            const next = { ...prev }
            delete next[payload.user_id!]
            return next
          })
        }
      }

      if (event.type === 'call.track_update') {
        const payload = (event.payload ?? {}) as {
          call_id?: string
          room_id?: string
          user_id?: string
          source?: 'microphone' | 'camera' | 'screen_share'
          published?: boolean
        }
        if (!payload.call_id || payload.room_id !== roomId || !payload.user_id || !payload.source) return
        if (payload.user_id === currentUserId) return
        const { user_id, source, published } = payload
        setRemoteParticipantTracks((prev) => ({
          ...prev,
          [user_id]: {
            ...prev[user_id],
            [source]: published ?? false,
          },
        }))
      }
    })

    return unsubscribe
  }, [roomId, currentUserId, scrollToBottomSoon, isOwnAuthor, markRoomRead, refreshActiveCall, inCall, disconnectCallSession])

  useEffect(() => {
    const rafId = requestAnimationFrame(() => {
      scrollToBottom()
    })
    return () => {
      cancelAnimationFrame(rafId)
    }
  }, [roomId, newestId, scrollToBottom])

  // Синхронизируем inCall в глобальный стор и измеряем RTT каждые 2с
  useEffect(() => {
    useCallStore.getState().setInCall(inCall)
    if (!inCall) return

    let alive = true
    const measure = async () => {
      const room = liveKitRoomRef.current
      if (!room || !alive) return
      const rtt = await getRttMs(room)
      if (alive && rtt !== null) useCallStore.getState().setPing(rtt)
    }

    void measure()
    const timer = window.setInterval(() => void measure(), 2000)
    return () => {
      alive = false
      window.clearInterval(timer)
      useCallStore.getState().setPing(null)
    }
  }, [inCall])

  useEffect(() => {
    if (!roomId) return
    const node = scrollerRef.current
    if (!node) return

    const handleScroll = () => {
      const distanceToBottom = node.scrollHeight - node.scrollTop - node.clientHeight
      if (distanceToBottom <= 64) {
        markRoomRead()
      }
    }

    node.addEventListener('scroll', handleScroll, { passive: true })
    handleScroll()

    return () => {
      node.removeEventListener('scroll', handleScroll)
    }
  }, [roomId, markRoomRead])

  useEffect(() => {
    const node = composerRef.current
    if (!node) return
    node.style.height = '0px'
    node.style.height = `${Math.min(node.scrollHeight, 144)}px`
  }, [content])

  useEffect(() => {
    if (!roomId) return
    if (content.trim().length > 0) {
      if (!isTypingRef.current) {
        isTypingRef.current = true
        sendWs('typing.start', { room_id: roomId })
        typingRepeatTimerRef.current = window.setInterval(() => {
          sendWs('typing.start', { room_id: roomId })
        }, 3500)
      }
    } else {
      if (isTypingRef.current) {
        isTypingRef.current = false
        if (typingRepeatTimerRef.current !== null) {
          window.clearInterval(typingRepeatTimerRef.current)
          typingRepeatTimerRef.current = null
        }
        sendWs('typing.stop', { room_id: roomId })
      }
    }
  }, [content, roomId])

  const normalizeOwnMessage = (message: Message): Message => {
    if (!currentUser) return message
    return {
      ...message,
      author: {
        ...message.author,
        id: message.author.id?.trim() || currentUser.id,
        username: message.author.username?.trim() || currentUser.username,
        display_name: message.author.display_name || currentUser.display_name,
        avatar_url: message.author.avatar_url || currentUser.avatar_url,
      },
    }
  }

  const loadOlder = async () => {
    if (!roomId || !oldestId || loadingMore || !hasMore) return
    setLoadingMore(true)

    try {
      const res = await messagesApi.list(roomId, { limit: PAGE_SIZE, before: oldestId })
      const normalized = normalizeForRender(res.messages)
      setMessages((prev) => normalizeForRender([...normalized, ...prev]))
      setHasMore(res.messages.length === PAGE_SIZE)
    } catch {
      setError('Не удалось загрузить старые сообщения.')
    } finally {
      setLoadingMore(false)
    }
  }

  const handleReplyTo = (message: Message) => {
    setReactionPickerFor(null)
    setReplyToMessage(message)
    composerRef.current?.focus()
  }

  const jumpToMessage = (messageId: string) => {
    const target = document.getElementById(`msg-${messageId}`)
    if (!target) return

    target.scrollIntoView({ behavior: 'smooth', block: 'center' })
    setHighlightedMessageId(messageId)

    if (highlightTimerRef.current !== null) {
      window.clearTimeout(highlightTimerRef.current)
    }
    highlightTimerRef.current = window.setTimeout(() => {
      setHighlightedMessageId((prev) => (prev === messageId ? null : prev))
      highlightTimerRef.current = null
    }, 1600)
  }

  const handleToggleReaction = async (message: Message, emoji: string) => {
    const existing = message.reactions?.find((r) => r.emoji === emoji)
    const alreadyReactedByMe = existing?.reacted_by_me === true
    const prevReactions = message.reactions ? message.reactions.map((r) => ({ ...r })) : undefined
    const optimisticReactions = applyOptimisticReaction(prevReactions, emoji, alreadyReactedByMe)

    setMessages((prev) =>
      prev.map((m) =>
        m.id === message.id
          ? { ...m, reactions: optimisticReactions }
          : m,
      ),
    )

    try {
      const res = alreadyReactedByMe
        ? await messagesApi.removeReaction(message.id, emoji)
        : await messagesApi.addReaction(message.id, emoji)

      setMessages((prev) =>
        prev.map((m) =>
          m.id === message.id
            ? { ...m, reactions: res.reactions && res.reactions.length > 0 ? res.reactions : undefined }
            : m,
        ),
      )
    } catch (err) {
      setMessages((prev) =>
        prev.map((m) =>
          m.id === message.id
            ? { ...m, reactions: prevReactions }
            : m,
        ),
      )

      if (err instanceof ApiError) {
        if (err.status === 403) {
          setError('Нельзя поставить реакцию: вы не участник комнаты.')
        } else if (err.status === 404) {
          setError('Сообщение для реакции не найдено.')
        } else if (err.status === 400) {
          setError('Некорректная реакция.')
        } else {
          setError('Не удалось обновить реакцию.')
        }
      } else {
        setError('Не удалось обновить реакцию.')
      }
    }
  }

  const handleSend = async () => {
    if (!roomId || sending || uploadingAttachment) return
    const trimmed = content.trim()
    if (!trimmed) return

    if (isTypingRef.current) {
      isTypingRef.current = false
      if (typingRepeatTimerRef.current !== null) {
        window.clearInterval(typingRepeatTimerRef.current)
        typingRepeatTimerRef.current = null
      }
      sendWs('typing.stop', { room_id: roomId })
    }

    setSending(true)
    setError(null)
    try {
      const created = await messagesApi.send(roomId, trimmed, replyToMessage?.id)
      const normalizedCreated = normalizeOwnMessage(created)
      knownMessageIdsRef.current.add(normalizedCreated.id)

      setMessages((prev) => {
        if (prev.some((m) => m.id === normalizedCreated.id)) return prev
        return normalizeForRender([...prev, normalizedCreated])
      })
      scrollToBottomSoon()
      setContent('')
      setReplyToMessage(null)
      refreshRooms()
    } catch (err) {
      if (err instanceof ApiError) {
        if (err.status === 403) {
          setError('Нельзя отправить сообщение: вы не участник комнаты.')
        } else if (err.status === 404 || err.body?.error === 'reply message not found') {
          setError('Сообщение для ответа не найдено.')
          setReplyToMessage(null)
        } else if (err.status === 400 && err.body?.error === 'reply message must belong to the same room') {
          setError('Нельзя ответить на сообщение из другой комнаты.')
          setReplyToMessage(null)
        } else if (err.status === 400 && err.body?.error === 'invalid reply_to_message_id') {
          setError('Некорректный reply_to_message_id.')
          setReplyToMessage(null)
        } else {
          setError('Не удалось отправить сообщение.')
        }
      } else {
        setError('Не удалось отправить сообщение.')
      }
    } finally {
      setSending(false)
    }
  }

  const handleOpenPicker = () => {
    if (sending || uploadingAttachment) return
    fileInputRef.current?.click()
  }

  const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    e.target.value = ''
    if (!file || !roomId) return

    const ext = getFileExtension(file.name)
    const isImage = ALLOWED_IMAGE_MIMES.has(file.type) || ALLOWED_IMAGE_EXTS.has(ext)
    const isFile = ALLOWED_FILE_MIMES.has(file.type) || ALLOWED_FILE_EXTS.has(ext)

    if (!isImage && !isFile) {
      setError('Недопустимый тип вложения.')
      return
    }

    if (file.size > MAX_ATTACHMENT_BYTES) {
      setError(`Файл слишком большой. Максимум ${formatBytes(MAX_ATTACHMENT_BYTES)}.`)
      return
    }

    setUploadingAttachment(true)
    setError(null)
    try {
      const created = await messagesApi.sendWithFile(roomId, file, '', replyToMessage?.id)
      const normalizedCreated = normalizeOwnMessage(created)
      knownMessageIdsRef.current.add(normalizedCreated.id)
      setMessages((prev) => {
        if (prev.some((m) => m.id === normalizedCreated.id)) return prev
        return normalizeForRender([...prev, normalizedCreated])
      })
      scrollToBottomSoon()
      setReplyToMessage(null)
      refreshRooms()
    } catch (err) {
      if (err instanceof ApiError) {
        if (err.status === 404 || err.body?.error === 'reply message not found') {
          setError('Сообщение для ответа не найдено.')
          setReplyToMessage(null)
        } else if (err.status === 400 && err.body?.error === 'reply message must belong to the same room') {
          setError('Нельзя ответить на сообщение из другой комнаты.')
          setReplyToMessage(null)
        } else if (err.status === 400 && err.body?.error === 'invalid reply_to_message_id') {
          setError('Некорректный reply_to_message_id.')
          setReplyToMessage(null)
        } else {
          setError('Не удалось отправить файл.')
        }
      } else {
        setError('Не удалось отправить файл.')
      }
    } finally {
      setUploadingAttachment(false)
    }
  }

  const handleComposerKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      void handleSend()
    }
  }

  const contentLength = content.trim().length
  const canSend = !sending && !uploadingAttachment && contentLength > 0
  const replyPreviewAuthor =
    replyToMessage?.author.display_name || replyToMessage?.author.username || 'Пользователь'
  const replyPreviewText = replyToMessage ? getMessageSnippet(replyToMessage) : ''
  const incomingCallerName =
    incomingCall?.caller?.display_name ||
    incomingCall?.caller?.username ||
    'Пользователь'
  const activeCallCallerId = getCallCallerId(activeCall)
  const canJoinPendingCall = Boolean(
    activeCall?.status === 'pending' &&
    (activeCallCallerId ? activeCallCallerId !== currentUserId : incomingCall),
  )
  const canJoinCall = Boolean(
    activeCall &&
    !inCall &&
    (
      activeCall.status === 'accepted' ||
      canJoinPendingCall
    ),
  )
  const awaitingAnswer = Boolean(
    activeCall?.status === 'pending' &&
    (activeCallCallerId ? activeCallCallerId === currentUserId : !incomingCall),
  )
  const pendingCallStatusText =
    activeCallCallerId
      ? (activeCallCallerId === currentUserId ? 'Ожидание ответа' : 'Входящий звонок')
      : (incomingCall ? 'Входящий звонок' : 'Звонок в ожидании')
  const shouldShowActiveCallCard = Boolean(
    activeCall &&
    !(incomingCall && !inCall && activeCall.status === 'pending'),
  )
  const shouldShowCallPanel = Boolean(incomingCall || activeCall || inCall || callError)

  return (
    <div className="flex-1 flex flex-col overflow-hidden">
      <div className="h-12 px-4 flex items-center justify-between gap-3 border-b border-elevated shadow-[0_1px_3px_rgba(0,0,0,0.3)] shrink-0">
        <div className="min-w-0">
          {room?.type === 'dm' ? (
            <button
              type="button"
              onClick={() => setFriendProfileOpen(true)}
              className="min-w-0 flex items-center gap-3 hover:bg-elevated/50 rounded-lg px-2 py-1 -mx-2 transition-colors text-left"
              title="Открыть профиль"
            >
              <div className="relative shrink-0">
                {dmUser?.avatar_url ? (
                  <img src={dmUser.avatar_url} alt={displayName} className="w-6 h-6 rounded-full object-cover" />
                ) : (
                  <div
                    className="w-6 h-6 rounded-full flex items-center justify-center text-[11px] font-semibold text-bg"
                    style={{ backgroundColor: color }}
                  >
                    {displayName[0]?.toUpperCase()}
                  </div>
                )}
                {isOnline && (
                  <span className="absolute -bottom-0.5 -right-0.5 w-2.5 h-2.5 rounded-full bg-success border-[1.5px] border-bg" />
                )}
              </div>
              <span className="font-semibold text-text text-[15px] truncate">{displayName}</span>
              <span className={`text-[12px] font-medium ${isOnline ? 'text-success' : 'text-text-disabled'}`}>
                {isOnline ? 'В сети' : 'Не в сети'}
              </span>
            </button>
          ) : (
            <div className="flex items-center gap-2 min-w-0">
              <svg className="w-5 h-5 text-text-disabled shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M18 18.72a9.094 9.094 0 003.741-.479 3 3 0 00-4.682-2.72m.94 3.198l.001.031c0 .225-.012.447-.037.666A11.944 11.944 0 0112 21c-2.17 0-4.207-.576-5.963-1.584A6.062 6.062 0 016 18.719m12 0a5.971 5.971 0 00-.941-3.197m0 0A5.995 5.995 0 0012 12.75a5.995 5.995 0 00-5.058 2.772m0 0a3 3 0 00-4.681 2.72 8.986 8.986 0 003.74.477m.94-3.197a5.971 5.971 0 00-.94 3.197M15 6.75a3 3 0 11-6 0 3 3 0 016 0zm6 3a2.25 2.25 0 11-4.5 0 2.25 2.25 0 014.5 0zm-13.5 0a2.25 2.25 0 11-4.5 0 2.25 2.25 0 014.5 0z" />
              </svg>
              <span className="font-semibold text-text text-[15px] truncate">{displayName}</span>
            </div>
          )}
        </div>

        {roomId && (
          <div className="shrink-0 flex items-center gap-1.5">
            <button
              type="button"
              onClick={() => void handleStartCall(false)}
              disabled={callBusy}
              className="w-8 h-8 rounded-lg border border-elevated/70 bg-elevated/70 text-text-secondary hover:text-text hover:border-primary/35 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center"
              title="Голосовой звонок"
            >
              <Phone className="w-4 h-4" />
            </button>
            <button
              type="button"
              onClick={() => void handleStartCall(true)}
              disabled={callBusy}
              className="w-8 h-8 rounded-lg border border-elevated/70 bg-elevated/70 text-text-secondary hover:text-text hover:border-primary/35 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center"
              title="Видеозвонок"
            >
              <Video className="w-4 h-4" />
            </button>
          </div>
        )}
      </div>

      {shouldShowCallPanel && (
        <div className="px-4 pt-2 shrink-0 space-y-2">
          {callError && (
            <div className="text-[12px] text-error bg-error/10 border border-error/20 rounded-lg px-3 py-2">
              {callError}
            </div>
          )}

          {incomingCall && !inCall && (
            <div className="rounded-xl border border-primary/35 bg-primary/10 px-3 py-2.5 flex items-center justify-between gap-3">
              <div className="min-w-0">
                <p className="text-[12px] uppercase tracking-wide text-primary/90 font-semibold">Входящий звонок</p>
                <p className="text-[14px] text-text truncate mt-0.5">{incomingCallerName}</p>
              </div>
              <div className="flex items-center gap-1.5 shrink-0">
                <button
                  type="button"
                  onClick={() => void handleAcceptCall(incomingCall.id, false)}
                  disabled={callBusy}
                  className="h-8 px-2.5 rounded-lg bg-success/85 hover:bg-success text-bg text-[12px] font-semibold disabled:opacity-60 disabled:cursor-not-allowed flex items-center gap-1"
                  title="Принять как голосовой"
                >
                  <Phone className="w-3.5 h-3.5" />
                  Аудио
                </button>
                <button
                  type="button"
                  onClick={() => void handleAcceptCall(incomingCall.id, true)}
                  disabled={callBusy}
                  className="h-8 px-2.5 rounded-lg bg-primary/85 hover:bg-primary text-bg text-[12px] font-semibold disabled:opacity-60 disabled:cursor-not-allowed flex items-center gap-1"
                  title="Принять как видеозвонок"
                >
                  <Video className="w-3.5 h-3.5" />
                  Видео
                </button>
                <button
                  type="button"
                  onClick={() => void handleDeclineCall(incomingCall.id)}
                  disabled={callBusy}
                  className="w-8 h-8 rounded-lg bg-error/80 hover:bg-error text-bg disabled:opacity-60 disabled:cursor-not-allowed flex items-center justify-center"
                  title="Отклонить звонок"
                >
                  <PhoneOff className="w-4 h-4" />
                </button>
              </div>
            </div>
          )}

          {shouldShowActiveCallCard && activeCall && (
            <div className="rounded-xl border border-elevated/75 bg-elevated/35 px-3 py-2">
              <div className="flex items-center justify-between gap-3">
                <div className="min-w-0">
                  <p className="text-[12px] text-text-secondary">
                    {inCall
                      ? 'Вы в звонке'
                      : activeCall.status === 'accepted'
                        ? 'Активный звонок'
                        : activeCall.status === 'pending'
                          ? pendingCallStatusText
                          : activeCall.status === 'declined'
                            ? 'Звонок отклонён'
                            : 'Звонок завершён'}
                  </p>
                  <p className="text-[13px] text-text truncate">
                    #{activeCall.id.slice(0, 8)} · {callMode === 'video' || cameraEnabled ? 'видео' : 'аудио'}
                  </p>
                </div>

                <div className="flex items-center gap-1.5 shrink-0">
                  {!inCall && canJoinCall && (
                    <>
                      <button
                        type="button"
                        onClick={() => void handleJoinActiveCall(false)}
                        disabled={callBusy}
                        className="h-8 px-2.5 rounded-lg bg-success/85 hover:bg-success text-bg text-[12px] font-semibold disabled:opacity-60 disabled:cursor-not-allowed flex items-center gap-1"
                        title="Подключиться к звонку (аудио)"
                      >
                        <Phone className="w-3.5 h-3.5" />
                        Войти
                      </button>
                      <button
                        type="button"
                        onClick={() => void handleJoinActiveCall(true)}
                        disabled={callBusy}
                        className="h-8 px-2.5 rounded-lg bg-primary/85 hover:bg-primary text-bg text-[12px] font-semibold disabled:opacity-60 disabled:cursor-not-allowed flex items-center gap-1"
                        title="Подключиться к звонку (видео)"
                      >
                        <Video className="w-3.5 h-3.5" />
                        Видео
                      </button>
                    </>
                  )}

                  {inCall && (
                    <>
                      <button
                        type="button"
                        onClick={() => void handleToggleMic()}
                        disabled={callBusy}
                        className="w-8 h-8 rounded-lg bg-bg/65 hover:bg-bg/80 text-text-secondary hover:text-text disabled:opacity-60 disabled:cursor-not-allowed flex items-center justify-center"
                        title={micEnabled ? 'Выключить микрофон' : 'Включить микрофон'}
                      >
                        {micEnabled ? <Mic className="w-4 h-4" /> : <MicOff className="w-4 h-4" />}
                      </button>
                      <button
                        type="button"
                        onClick={() => void handleToggleCamera()}
                        disabled={callBusy}
                        className="w-8 h-8 rounded-lg bg-bg/65 hover:bg-bg/80 text-text-secondary hover:text-text disabled:opacity-60 disabled:cursor-not-allowed flex items-center justify-center"
                        title={cameraEnabled ? 'Выключить камеру' : 'Включить камеру'}
                      >
                        {cameraEnabled ? <Video className="w-4 h-4" /> : <VideoOff className="w-4 h-4" />}
                      </button>
                    </>
                  )}

                  {(inCall || awaitingAnswer || canJoinCall) && (
                    <button
                      type="button"
                      onClick={() => void handleHangUp()}
                      disabled={callBusy || !activeCall}
                      className="w-8 h-8 rounded-lg bg-error/85 hover:bg-error text-bg disabled:opacity-60 disabled:cursor-not-allowed flex items-center justify-center"
                      title={inCall && remoteParticipantCount > 0 ? 'Покинуть звонок' : 'Завершить звонок'}
                    >
                      <PhoneOff className="w-4 h-4" />
                    </button>
                  )}
                </div>
              </div>
            </div>
          )}

          {inCall && (
            <div className="rounded-xl border border-elevated/75 bg-secondary/55 overflow-hidden">
              {/* Видео-панель — ВСЕГДА в DOM, иначе remoteVideoContainerRef = null
                  когда собеседник включает камеру в аудиорежиме */}
              <div className={
                (callMode === 'video' || cameraEnabled || remoteVideoCount > 0)
                  ? 'relative w-full aspect-video bg-black overflow-hidden'
                  : 'hidden'
              }>
                <div
                  ref={remoteVideoContainerRef}
                  className={`absolute inset-0 ${remoteVideoCount > 1 ? 'grid grid-cols-2 gap-1 p-1' : ''}`}
                />
                <div className="absolute top-2 left-2 px-2 py-1 rounded-md bg-black/45 text-white text-[11px]">
                  {remoteParticipantCount > 0 ? `${remoteParticipantCount} участник(а)` : 'Ожидание участников...'}
                </div>
                <video
                  ref={localVideoRef}
                  autoPlay
                  muted
                  playsInline
                  className={
                    !cameraEnabled
                      ? 'hidden'
                      : remoteVideoCount === 0
                        ? 'absolute inset-0 w-full h-full object-contain'
                        : 'absolute right-2 bottom-2 w-[28%] aspect-video rounded-lg border border-white/20 bg-black/60 object-cover'
                  }
                />
              </div>

              {/* Аудио-режим — показывается когда нет видео */}
              {!(callMode === 'video' || cameraEnabled || remoteVideoCount > 0) && (
                <div className="px-3 py-3 text-[13px] text-text-secondary flex items-center justify-between gap-3">
                  <span>Аудиозвонок активен</span>
                  <div className="flex items-center gap-2">
                    {Object.entries(remoteParticipantTracks).some(([, t]) => t.microphone === true) && (
                      <Mic className="w-3.5 h-3.5 text-success shrink-0" />
                    )}
                    <span className="text-[11px] text-text-disabled">
                      {remoteParticipantCount > 0 ? `${remoteParticipantCount} участник(а) в звонке` : 'Ожидание участников...'}
                    </span>
                  </div>
                </div>
              )}

              <div ref={remoteAudioContainerRef} className="hidden" />
            </div>
          )}
        </div>
      )}

      <div ref={scrollerRef} className="flex-1 overflow-y-auto overflow-x-hidden px-4 py-4">
        {hasMore && messages.length > 0 && (
          <div className="flex justify-center mb-3">
            <button
              onClick={loadOlder}
              disabled={loadingMore}
              className="px-3 py-1.5 rounded-md text-[12px] bg-elevated text-text-secondary hover:text-text disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {loadingMore ? 'Загрузка...' : 'Показать более старые'}
            </button>
          </div>
        )}

        {loading && (
          <div className="text-text-disabled text-sm text-center py-6 mb-3">Загрузка сообщений...</div>
        )}

        {!loading && messages.length === 0 && (
          <div className="text-text-disabled text-sm text-center py-6 mb-3">
            Сообщений пока нет. Напишите первое сообщение.
          </div>
        )}

        {messages.map((message, index) => {
          const startsGroup = index === 0 || getAuthorKey(messages[index - 1]) !== getAuthorKey(message)
          const rawAuthorId = message.author.id?.trim() ?? ''
          const rawAuthorUsername = message.author.username?.trim() ?? ''
          const parsedLegacyAttachment = !message.attachment ? parseLegacyAttachmentContent(message.content) : null
          const attachment = message.attachment ?? parsedLegacyAttachment ?? undefined
          const textContent = parsedLegacyAttachment ? '' : message.content
          const storeAuthor =
            (rawAuthorId ? usersById.get(rawAuthorId) : undefined) ??
            (rawAuthorUsername ? usersByUsername.get(rawAuthorUsername) : undefined)
          const authorName =
            storeAuthor?.display_name ||
            message.author.display_name ||
            storeAuthor?.username ||
            rawAuthorUsername ||
            'Unknown'
          const authorAvatar = storeAuthor?.avatar_url || message.author.avatar_url
          const isOwn =
            (rawAuthorId.length > 0 && rawAuthorId === currentUserId) ||
            (rawAuthorUsername.length > 0 && rawAuthorUsername === currentUser?.username)
          const shouldShowReadStatus = isOwn && room?.type === 'dm'
          const peerReadMs = toMillis(peerLastReadAt)
          const messageMs = toMillis(message.created_at)
          const isReadByPeer = Boolean(
            shouldShowReadStatus &&
            !Number.isNaN(peerReadMs) &&
            !Number.isNaN(messageMs) &&
            peerReadMs >= messageMs,
          )
          const reactionsForMessage = message.reactions ?? []
          const replyTo = message.reply_to
          const replyAuthorName = replyTo?.author?.display_name || replyTo?.author?.username || 'Пользователь'
          const replyPreviewText = replyTo?.content?.trim() || 'Сообщение'

          const spacingClass = startsGroup ? (index === 0 ? 'mt-0' : 'mt-0.5') : 'mt-1'
          const timeLabel = formatTime(message.created_at)

          const messageBody = (
            <>
              {replyTo && (
                <button
                  type="button"
                  onClick={() => jumpToMessage(replyTo.id)}
                  className={`mt-1 inline-flex max-w-75 flex-col rounded-lg border border-elevated/70 bg-elevated/45 px-2.5 py-1.5 text-left ${isOwn ? 'ml-auto' : ''}`}
                >
                  <span className="text-[11px] font-semibold text-primary truncate">{replyAuthorName}</span>
                  <span className="text-[12px] text-text-secondary truncate">{replyPreviewText}</span>
                </button>
              )}
              {textContent && (
                <p className="text-[14px] text-text-secondary whitespace-pre-wrap break-words">{textContent}</p>
              )}
              {attachment && (
                isImageAttachment(attachment.mime) ? (
                  <div className={`mt-1 inline-block rounded-xl overflow-hidden border border-elevated/70 ${isOwn ? 'ml-auto' : ''}`}>
                    <img
                      src={attachment.url}
                      alt={attachment.name}
                      className="max-w-75 max-h-70 object-cover bg-black/20"
                    />
                  </div>
                ) : isAudioAttachment(attachment.mime, attachment.name) ? (
                  <AudioPlayer
                    src={attachment.url}
                    name={attachment.name}
                    alignRight={isOwn}
                  />
                ) : isVideoAttachment(attachment.mime, attachment.name) ? (
                  <VideoPlayer
                    src={attachment.url}
                    name={attachment.name}
                    alignRight={isOwn}
                  />
                ) : (
                  <a
                    href={attachment.url}
                    download={attachment.name}
                    className={`mt-1 inline-flex items-center gap-3 rounded-xl border border-elevated/70 bg-elevated/60 px-3 py-2 text-left hover:bg-elevated ${isOwn ? 'ml-auto' : ''}`}
                  >
                    <span className="w-8 h-8 rounded-lg bg-bg/60 flex items-center justify-center text-[10px] font-bold text-text-secondary">FILE</span>
                    <span className="min-w-0">
                      <span className="block text-[13px] text-text truncate max-w-55">{attachment.name}</span>
                      <span className="block text-[11px] text-text-disabled">{formatBytes(attachment.size)}</span>
                    </span>
                  </a>
                )
              )}
            </>
          )

          return (
            <div
              key={message.id}
              id={`msg-${message.id}`}
              className={`group flex items-start gap-2 rounded-xl px-2 py-0 -mx-2 transition-colors duration-500 ${
                isOwn ? 'flex-row-reverse' : ''
              } ${spacingClass} ${
                highlightedMessageId === message.id
                  ? 'bg-primary/12 shadow-[0_0_0_1px_rgba(0,245,160,0.35)]'
                  : ''
              }`}
            >
              {startsGroup ? (
                authorAvatar ? (
                  <img src={authorAvatar} alt={authorName} className="w-8 h-8 rounded-full object-cover shrink-0" />
                ) : (
                  <div
                    className="w-8 h-8 rounded-full flex items-center justify-center text-[12px] font-semibold text-bg shrink-0"
                    style={{ backgroundColor: roomColor(rawAuthorId || rawAuthorUsername || message.id) }}
                  >
                    {authorName[0]?.toUpperCase() ?? '?'}
                  </div>
                )
              ) : (
                <div className="w-8 h-0 shrink-0" aria-hidden />
              )}
              <div className={`relative min-w-0 ${isOwn ? 'text-right' : ''}`}>
                <div
                  className={`absolute top-1/2 -translate-y-1/2 z-20 ${
                    isOwn ? 'right-full mr-2' : 'left-full ml-2'
                  } ${
                    reactionPickerFor === message.id ? 'opacity-100' : 'opacity-0 group-hover:opacity-100'
                  } transition-opacity pointer-events-none`}
                >
                  <div className="relative flex items-center gap-1 pointer-events-auto">
                    <button
                      type="button"
                      onClick={() => handleReplyTo(message)}
                      className="w-8 h-8 rounded-full bg-elevated/90 hover:bg-elevated text-text-secondary hover:text-text flex items-center justify-center shadow-[0_6px_16px_rgba(0,0,0,0.25)]"
                      title="Ответить"
                    >
                      <CornerUpLeft className="w-4 h-4" />
                    </button>
                    <button
                      type="button"
                      data-reaction-anchor-id={message.id}
                      onClick={() => toggleReactionPopover(message.id)}
                      className="w-8 h-8 rounded-full bg-elevated/90 hover:bg-elevated text-text-secondary hover:text-text flex items-center justify-center shadow-[0_6px_16px_rgba(0,0,0,0.25)]"
                      title="Реакция"
                    >
                      <Smile className="w-4 h-4" />
                    </button>
                  </div>
                </div>
                {startsGroup ? (
                  <>
                    <div className={`flex items-center gap-2 ${isOwn ? 'justify-end' : ''}`}>
                      <span className="text-[13px] font-semibold text-text">{authorName}</span>
                      {!isOwn && (
                        <>
                          <span className="text-[11px] text-text-disabled">{timeLabel}</span>
                          {message.edited_at && (
                            <span className="text-[11px] text-text-disabled">(изменено)</span>
                          )}
                        </>
                      )}
                    </div>
                    {isOwn ? (
                      <div className="flex items-end gap-2 justify-end">
                        <span className="text-[11px] text-text-disabled shrink-0 pb-0.5">{timeLabel}</span>
                        {shouldShowReadStatus && (
                          <span className={`shrink-0 pb-0.5 ${isReadByPeer ? 'text-primary' : 'text-text-disabled'}`}>
                            {isReadByPeer ? <CheckCheck className="w-3.5 h-3.5" /> : <Check className="w-3.5 h-3.5" />}
                          </span>
                        )}
                        {message.edited_at && (
                          <span className="text-[11px] text-text-disabled shrink-0 pb-0.5">(изменено)</span>
                        )}
                        <div className="min-w-0">{messageBody}</div>
                      </div>
                    ) : (
                      messageBody
                    )}
                  </>
                ) : (
                  <div className={`flex items-end gap-2 ${isOwn ? 'justify-end' : ''}`}>
                    {isOwn && (
                      <span className="text-[11px] text-text-disabled shrink-0 pb-0.5">{timeLabel}</span>
                    )}
                    {isOwn && shouldShowReadStatus && (
                      <span className={`shrink-0 pb-0.5 ${isReadByPeer ? 'text-primary' : 'text-text-disabled'}`}>
                        {isReadByPeer ? <CheckCheck className="w-3.5 h-3.5" /> : <Check className="w-3.5 h-3.5" />}
                      </span>
                    )}
                    <div className="min-w-0">{messageBody}</div>
                    {!isOwn && (
                      <span className="text-[11px] text-text-disabled shrink-0 pb-0.5">{timeLabel}</span>
                    )}
                  </div>
                )}

                {reactionsForMessage.length > 0 && (
                  <div className={`mt-0.5 flex items-center gap-1 ${isOwn ? 'justify-end' : ''}`}>
                    {reactionsForMessage.map((reaction) => (
                      <button
                        key={`${message.id}-${reaction.emoji}`}
                        type="button"
                        onClick={() => void handleToggleReaction(message, reaction.emoji)}
                        className={`h-7 px-2 rounded-full border text-[13px] hover:bg-elevated ${
                          reaction.reacted_by_me
                            ? 'border-primary/45 bg-primary/15'
                            : 'border-elevated/70 bg-elevated/60'
                        }`}
                        title={reaction.reacted_by_me ? 'Убрать реакцию' : 'Поставить реакцию'}
                      >
                        {reaction.emoji} {reaction.count}
                      </button>
                    ))}
                  </div>
                )}
              </div>
            </div>
          )
        })}
      </div>

      {reactionPickerFor && activeReactionMessage && reactionPopoverPosition && (
        <div
          className="fixed z-40 flex items-center gap-1 rounded-xl border border-elevated/70 bg-secondary/95 backdrop-blur px-2 py-1.5 shadow-[0_12px_26px_rgba(0,0,0,0.35)]"
          style={{
            top: reactionPopoverPosition.top,
            left: reactionPopoverPosition.left,
            width: REACTION_POPPER_WIDTH,
          }}
        >
          {REACTION_OPTIONS.map((emoji) => {
            const active = activeReactionMessageReactions.some((r) => r.emoji === emoji && r.reacted_by_me)
            return (
              <button
                key={emoji}
                type="button"
                onClick={() => {
                  void handleToggleReaction(activeReactionMessage, emoji)
                  setReactionPickerFor(null)
                  setReactionPopoverPosition(null)
                }}
                className={`h-7 flex-1 rounded-md border text-[14px] ${
                  active
                    ? 'border-primary/50 bg-primary/15'
                    : 'border-elevated/70 bg-elevated/60 hover:bg-elevated'
                }`}
              >
                {emoji}
              </button>
            )
          })}
        </div>
      )}

      {typingUsers.size > 0 && (
        <div className="px-5 pb-1 shrink-0">
          <span className="text-[11px] text-text-disabled italic">{typingLabel}</span>
        </div>
      )}

      <div className="px-4 pb-5 pt-2 shrink-0">
        {error && (
          <div className="mb-2 text-[12px] text-error bg-error/10 border border-error/20 rounded-lg px-3 py-2">
            {error}
          </div>
        )}
        <div className="rounded-2xl border border-elevated/80 bg-[linear-gradient(180deg,rgba(30,34,40,0.96)_0%,rgba(23,26,31,0.96)_100%)] shadow-[0_10px_30px_rgba(0,0,0,0.35),inset_0_1px_0_rgba(255,255,255,0.03)] transition-colors focus-within:border-primary/45">
          {replyToMessage && (
            <div className="px-3 pt-2">
              <div className="flex items-start gap-2 rounded-xl border border-primary/30 bg-primary/10 px-3 py-2">
                <button
                  type="button"
                  onClick={() => jumpToMessage(replyToMessage.id)}
                  className="min-w-0 flex-1 text-left"
                >
                  <p className="text-[11px] font-semibold text-primary truncate">
                    Ответ на: {replyPreviewAuthor}
                  </p>
                  <p className="text-[12px] text-text-secondary truncate">{replyPreviewText}</p>
                </button>
                <button
                  type="button"
                  onClick={() => setReplyToMessage(null)}
                  className="w-7 h-7 rounded-md bg-bg/45 hover:bg-bg/70 text-text-secondary hover:text-text flex items-center justify-center shrink-0"
                  title="Отменить ответ"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
            </div>
          )}
          <div className="flex items-start gap-2 p-2">
            <button
              type="button"
              onClick={handleOpenPicker}
              disabled={sending || uploadingAttachment}
              className="w-9 h-9 rounded-xl bg-bg/55 text-text-secondary hover:text-text hover:bg-bg/80 transition-colors shrink-0"
              title="Attach"
            >
              <svg className="w-5 h-5 mx-auto" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 5v14m7-7H5" />
              </svg>
            </button>

            <div className="flex-1 min-w-0 bg-bg/35 rounded-xl px-3 py-2 border border-elevated/70 focus-within:border-primary/35 transition-colors">
              <textarea
                ref={composerRef}
                value={content}
                onChange={(e) => setContent(e.target.value)}
                onKeyDown={handleComposerKeyDown}
                rows={1}
                placeholder={`Написать ${displayName}...`}
                className="w-full resize-none max-h-36 bg-transparent text-[15px] leading-6 text-text placeholder:text-text-disabled outline-none"
              />
            </div>

            <button
              type="button"
              onClick={() => void handleSend()}
              disabled={!canSend}
              className="w-10 h-10 rounded-xl bg-primary text-bg flex items-center justify-center shadow-[0_0_16px_rgba(0,245,160,0.35)] hover:bg-primary-hover disabled:bg-elevated disabled:text-text-disabled disabled:shadow-none disabled:cursor-not-allowed transition-all shrink-0"
              title="Send"
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

          <div className="px-3 pb-2 flex items-center justify-between text-[11px] text-text-disabled">
            <span>{uploadingAttachment ? 'Uploading file...' : 'Enter to send, Shift+Enter for newline'}</span>
            <span>{contentLength}</span>
          </div>
        </div>
        <input
          ref={fileInputRef}
          type="file"
          onChange={handleFileSelect}
          className="hidden"
          accept=".jpg,.jpeg,.png,.webp,.gif,.pdf,.txt,.zip,.doc,.docx,.xls,.xlsx,.ppt,.pptx,.mp3,.ogg,.wav,.mp4,.webm,image/jpeg,image/png,image/webp,image/gif,application/pdf,text/plain,application/zip,application/x-zip-compressed,application/msword,application/vnd.openxmlformats-officedocument.wordprocessingml.document,application/vnd.ms-excel,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet,application/vnd.ms-powerpoint,application/vnd.openxmlformats-officedocument.presentationml.presentation,audio/mpeg,audio/ogg,audio/wav,video/mp4,video/webm"
        />
      </div>

      {friendProfileOpen && room?.type === 'dm' && dmUser && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/65 backdrop-blur-[2px]"
          onClick={() => setFriendProfileOpen(false)}
        >
          <div
            className="w-full max-w-md bg-secondary border border-elevated rounded-2xl shadow-2xl overflow-hidden"
            onClick={(event) => event.stopPropagation()}
          >
            <div className="px-5 pt-5 pb-3 flex items-start justify-between border-b border-elevated/60">
              <div>
                <h2 className="font-pixel text-[20px] font-semibold text-text leading-tight">Профиль</h2>
                <p className="text-[12px] text-text-secondary mt-1">Информация о собеседнике</p>
              </div>
              <button
                type="button"
                onClick={() => setFriendProfileOpen(false)}
                className="w-8 h-8 rounded-lg text-text-disabled hover:text-text hover:bg-elevated/60 flex items-center justify-center"
                title="Закрыть"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="px-5 py-5">
              <div className="flex items-center gap-4 rounded-xl border border-elevated/70 bg-bg/40 p-4">
                <div className="relative shrink-0">
                  {dmUser.avatar_url ? (
                    <button
                      type="button"
                      onClick={() => setFriendPhotoOpen(true)}
                      className="block rounded-full overflow-hidden ring-2 ring-transparent hover:ring-primary/45 transition"
                      title="Открыть фото"
                    >
                      <img src={dmUser.avatar_url} alt={displayName} className="w-[72px] h-[72px] rounded-full object-cover" />
                    </button>
                  ) : (
                    <div
                      className="w-[72px] h-[72px] rounded-full flex items-center justify-center text-[26px] font-semibold text-bg"
                      style={{ backgroundColor: color }}
                    >
                      {displayName[0]?.toUpperCase() ?? '?'}
                    </div>
                  )}
                  <span className={`absolute -bottom-1 -right-1 w-4 h-4 rounded-full border-2 border-secondary ${isOnline ? 'bg-success' : 'bg-text-disabled'}`} />
                </div>
                <div className="min-w-0">
                  <p className="text-[18px] font-semibold text-text truncate">{dmUser.display_name ?? dmUser.username}</p>
                  <p className="text-[14px] text-text-secondary truncate">@{dmUser.username}</p>
                  <p className={`text-[12px] mt-1 ${isOnline ? 'text-success' : 'text-text-disabled'}`}>
                    {isOnline ? 'В сети' : 'Не в сети'}
                  </p>
                </div>
              </div>

              {dmUser.avatar_url && (
                <button
                  type="button"
                  onClick={() => setFriendPhotoOpen(true)}
                  className="mt-3 px-3 py-2 rounded-lg bg-elevated/65 hover:bg-elevated text-[13px] text-text-secondary hover:text-text transition-colors"
                >
                  Посмотреть фото
                </button>
              )}
            </div>
          </div>
        </div>
      )}

      {friendPhotoOpen && dmUser?.avatar_url && (
        <div
          className="fixed inset-0 z-[60] bg-black/85 backdrop-blur-[2px] flex items-center justify-center p-1"
          onClick={() => setFriendPhotoOpen(false)}
        >
          <button
            type="button"
            onClick={() => setFriendPhotoOpen(false)}
            className="absolute top-4 right-4 w-10 h-10 rounded-lg bg-black/35 text-white/85 hover:text-white hover:bg-black/55 flex items-center justify-center"
            title="Закрыть фото"
          >
            <X className="w-5 h-5" />
          </button>
          <img
            src={dmUser.avatar_url}
            alt={displayName}
            className="max-w-[98vw] max-h-[96vh] object-contain rounded-lg shadow-[0_20px_45px_rgba(0,0,0,0.5)]"
            onClick={(event) => event.stopPropagation()}
          />
        </div>
      )}
    </div>
  )
}


