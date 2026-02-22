import { create } from 'zustand'
import type { User } from '@/types/api'

interface AuthState {
  user: User | null
  isAuthenticated: boolean
  isLoading: boolean

  setAuth: (user: User, accessToken: string, refreshToken: string) => void
  clearAuth: () => void
  setLoading: (loading: boolean) => void
}

export const useAuthStore = create<AuthState>((set) => ({
  user: null,
  isAuthenticated: false,
  isLoading: true,

  setAuth: (user, accessToken, refreshToken) => {
    localStorage.setItem('access_token', accessToken)
    localStorage.setItem('refresh_token', refreshToken)
    set({ user, isAuthenticated: true })
  },

  clearAuth: () => {
    localStorage.removeItem('access_token')
    localStorage.removeItem('refresh_token')
    set({ user: null, isAuthenticated: false })
  },

  setLoading: (isLoading) => set({ isLoading }),
}))
