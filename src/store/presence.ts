import { create } from 'zustand'

interface PresenceState {
  online: Set<string>
  setOnline: (userId: string) => void
  setOffline: (userId: string) => void
  clear: () => void
  isOnline: (userId: string) => boolean
}

export const usePresenceStore = create<PresenceState>((set, get) => ({
  online: new Set<string>(),

  setOnline: (userId) =>
    set((s) => ({ online: new Set(s.online).add(userId) })),

  setOffline: (userId) => {
    set((s) => {
      const next = new Set(s.online)
      next.delete(userId)
      return { online: next }
    })
  },

  clear: () => set({ online: new Set<string>() }),

  isOnline: (userId) => get().online.has(userId),
}))
