import { create } from 'zustand'
import { usePresenceStore } from './presence'

type WsStatus = 'disconnected' | 'connecting' | 'connected'

interface WsState {
  status: WsStatus
}

export interface WsEvent {
  type: string
  payload: unknown
}

let socket: WebSocket | null = null
let reconnectTimer: ReturnType<typeof setTimeout> | null = null
let reconnectDelay = 1000
let active = false
let _set: (partial: Partial<WsState>) => void = () => {}
const listeners = new Set<(event: WsEvent) => void>()

export const useWsStore = create<WsState>((set) => {
  _set = set
  return { status: 'disconnected' }
})

function _extractOnlineUsers(msg: Record<string, unknown>): string[] {
  const payload = msg.payload

  if (Array.isArray(payload)) {
    return payload.filter((v): v is string => typeof v === 'string')
  }

  if (payload && typeof payload === 'object') {
    const inner = payload as Record<string, unknown>
    const users = inner.users ?? inner.online_users
    if (Array.isArray(users)) {
      return users.filter((v): v is string => typeof v === 'string')
    }
  }

  const users = msg.users ?? msg.online_users
  if (Array.isArray(users)) {
    return users.filter((v): v is string => typeof v === 'string')
  }

  return []
}

function _emit(event: WsEvent) {
  for (const listener of listeners) {
    listener(event)
  }
}

function _handleEvent(raw: string) {
  let msg: Record<string, unknown>
  try {
    msg = JSON.parse(raw)
  } catch {
    return
  }

  const type = msg.type as string | undefined
  if (!type) return

  // Some backends send full event in root (without `payload` wrapper).
  const normalizedPayload = msg.payload ?? msg
  _emit({ type, payload: normalizedPayload })

  if (type === 'presence.update') {
    const inner = (msg.payload ?? msg.data ?? msg) as Record<string, unknown>
    const userId = (inner.user_id ?? inner.userId) as string | undefined
    const status = inner.status as string | undefined
    if (!userId) return

    if (status === 'online') {
      usePresenceStore.getState().setOnline(userId)
    } else if (status === 'offline') {
      usePresenceStore.getState().setOffline(userId)
    }
    return
  }

  if (type === 'presence.init' || type === 'presence.bulk') {
    _extractOnlineUsers(msg).forEach((id) => usePresenceStore.getState().setOnline(id))
  }
}

export function subscribe(handler: (event: WsEvent) => void) {
  listeners.add(handler)
  return () => {
    listeners.delete(handler)
  }
}

export function connect() {
  active = true

  if (socket && (socket.readyState === WebSocket.OPEN || socket.readyState === WebSocket.CONNECTING)) {
    return
  }

  const token = localStorage.getItem('access_token')
  if (!token) return

  const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:'
  const url = `${protocol}//${window.location.host}/api/v1/ws?token=${encodeURIComponent(token)}`

  _set({ status: 'connecting' })
  socket = new WebSocket(url)

  socket.onopen = () => {
    reconnectDelay = 1000
    _set({ status: 'connected' })
  }

  socket.onmessage = (e) => {
    _handleEvent(e.data)
  }

  socket.onerror = () => {
    socket?.close()
  }

  socket.onclose = () => {
    socket = null
    _set({ status: 'disconnected' })

    if (!active) return

    reconnectTimer = setTimeout(() => {
      reconnectDelay = Math.min(reconnectDelay * 2, 30_000)
      connect()
    }, reconnectDelay)
  }
}

export function sendWs(type: string, payload: unknown) {
  if (socket && socket.readyState === WebSocket.OPEN) {
    socket.send(JSON.stringify({ type, payload }))
  }
}

export function disconnect() {
  active = false

  if (reconnectTimer !== null) {
    clearTimeout(reconnectTimer)
    reconnectTimer = null
  }

  if (socket) {
    socket.close()
    socket = null
  }

  usePresenceStore.getState().clear()
  _set({ status: 'disconnected' })
}
