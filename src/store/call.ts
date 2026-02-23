import { create } from 'zustand'

interface CallState {
  inCall: boolean
  ping: number | null
  setInCall: (v: boolean) => void
  setPing: (v: number | null) => void
}

export const useCallStore = create<CallState>((set) => ({
  inCall: false,
  ping: null,
  setInCall: (v) => set({ inCall: v }),
  setPing: (v) => set({ ping: v }),
}))
