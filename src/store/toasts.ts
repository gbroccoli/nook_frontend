import { create } from 'zustand'

export type ToastType = 'message' | 'friend_request' | 'call' | 'success' | 'error' | 'info'

export interface Toast {
  id: string
  type: ToastType
  title: string
  body?: string
  avatarUrl?: string
  avatarLetter?: string
  duration?: number
  action?: () => void
  actionLabel?: string
}

interface ToastsState {
  toasts: Toast[]
  add: (toast: Omit<Toast, 'id'>) => string
  remove: (id: string) => void
}

let _counter = 0

export const useToastsStore = create<ToastsState>((set) => ({
  toasts: [],

  add: (toast) => {
    const id = String(++_counter)
    const duration = toast.duration ?? 5000
    set((s) => ({ toasts: [...s.toasts.slice(-4), { ...toast, id }] }))
    if (duration > 0) {
      setTimeout(() => {
        set((s) => ({ toasts: s.toasts.filter((t) => t.id !== id) }))
      }, duration)
    }
    return id
  },

  remove: (id) => set((s) => ({ toasts: s.toasts.filter((t) => t.id !== id) })),
}))
