import { create } from 'zustand'

interface UnreadState {
  byRoom: Record<string, number>
  increment: (roomId: string) => void
  clear: (roomId: string) => void
}

export const useUnreadStore = create<UnreadState>((set) => ({
  byRoom: {},
  increment: (roomId) =>
    set((s) => ({ byRoom: { ...s.byRoom, [roomId]: (s.byRoom[roomId] ?? 0) + 1 } })),
  clear: (roomId) =>
    set((s) => {
      const next = { ...s.byRoom }
      delete next[roomId]
      return { byRoom: next }
    }),
}))