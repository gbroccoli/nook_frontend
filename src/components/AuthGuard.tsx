import { useEffect } from 'react'
import { useNavigate, Outlet } from 'react-router-dom'
import { useAuthStore } from '@/store/auth'
import { usersApi } from '@/api/users'

export function AuthGuard() {
  const { isAuthenticated, isLoading, setAuth, clearAuth, setLoading } = useAuthStore()
  const navigate = useNavigate()

  useEffect(() => {
    const token = localStorage.getItem('access_token')
    if (!token) {
      clearAuth()
      setLoading(false)
      navigate('/login', { replace: true })
      return
    }

    usersApi
      .me()
      .then((user) => {
        const access = localStorage.getItem('access_token') ?? ''
        const refresh = localStorage.getItem('refresh_token') ?? ''
        setAuth(user, access, refresh)
      })
      .catch(() => {
        clearAuth()
        navigate('/login', { replace: true })
      })
      .finally(() => setLoading(false))
  }, [])

  if (isLoading) {
    return (
      <div className="min-h-screen bg-bg flex items-center justify-center">
        <div className="flex flex-col items-center gap-3">
          <svg
            className="animate-spin h-8 w-8 text-primary"
            viewBox="0 0 24 24"
            fill="none"
          >
            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
          </svg>
          <p className="text-text-disabled text-sm">Загрузка...</p>
        </div>
      </div>
    )
  }

  if (!isAuthenticated) return null

  return <Outlet />
}
