import { create } from 'zustand'
import type { User } from '@/types/api'

type AuthTokens = {
  access_token: string
  refresh_token: string
}

interface AuthState {
  user: User | null
  isAuthenticated: boolean
  isLoading: boolean

  setAuth: (user: User, accessTokenOrTokens?: string | AuthTokens, refreshToken?: string) => void
  clearAuth: () => void
  setLoading: (loading: boolean) => void
}

export const useAuthStore = create<AuthState>((set) => ({
  user: null,
  isAuthenticated: false,
  isLoading: true,

  setAuth: (user, accessTokenOrTokens, refreshToken) => {
    let accessToken = localStorage.getItem('access_token') ?? ''
    let nextRefreshToken = localStorage.getItem('refresh_token') ?? ''

    if (typeof accessTokenOrTokens === 'string') {
      accessToken = accessTokenOrTokens
      nextRefreshToken = refreshToken ?? nextRefreshToken
    } else if (accessTokenOrTokens) {
      accessToken = accessTokenOrTokens.access_token
      nextRefreshToken = accessTokenOrTokens.refresh_token
    }

    if (accessToken) localStorage.setItem('access_token', accessToken)
    if (nextRefreshToken) localStorage.setItem('refresh_token', nextRefreshToken)

    set({ user, isAuthenticated: true })
  },

  clearAuth: () => {
    localStorage.removeItem('access_token')
    localStorage.removeItem('refresh_token')
    set({ user: null, isAuthenticated: false })
  },

  setLoading: (isLoading) => set({ isLoading }),
}))
