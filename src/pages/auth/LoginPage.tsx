import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { authApi } from '@/api/auth'
import { useAuthStore } from '@/store/auth'
import { getHwid } from '@/lib/hwid'
import { Button } from '@/components/ui/Button'
import { Input } from '@/components/ui/Input'
import { Logo } from '@/components/ui/Logo'
import { ApiError } from '@/api/client'

export function LoginPage() {
  const navigate = useNavigate()
  const setAuth = useAuthStore((s) => s.setAuth)

  const [form, setForm] = useState({ username: '', password: '' })
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')
    setLoading(true)

    try {
      const data = await authApi.login({
        username: form.username,
        password: form.password,
        hwid: getHwid(),
      })
      setAuth(data.user, data.access_token, data.refresh_token)
      navigate('/app')
    } catch (err) {
      if (err instanceof ApiError && err.status === 401) {
        setError('Неверное имя пользователя или пароль')
      } else {
        setError('Ошибка сервера. Попробуйте позже.')
      }
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen bg-bg flex items-center justify-center p-4">
      <div className="w-full max-w-sm">
        {/* Header */}
        <div className="flex flex-col items-center gap-3 mb-8">
          <Logo size={48} />
          <div className="text-center">
            <h1 className="font-pixel text-[28px] font-semibold leading-[1.1] text-text">Добро пожаловать</h1>
            <p className="text-text-secondary text-sm mt-1">Войдите в свой аккаунт Nook</p>
          </div>
        </div>

        {/* Form */}
        <form
          onSubmit={handleSubmit}
          className="bg-secondary border border-elevated rounded-2xl p-6 flex flex-col gap-4"
        >
          <Input
            label="Имя пользователя"
            placeholder="username"
            autoComplete="username"
            value={form.username}
            onChange={(e) => setForm((f) => ({ ...f, username: e.target.value.toLowerCase() }))}
            disabled={loading}
          />
          <Input
            label="Пароль"
            type="password"
            placeholder="••••••••"
            autoComplete="current-password"
            value={form.password}
            onChange={(e) => setForm((f) => ({ ...f, password: e.target.value }))}
            disabled={loading}
          />

          {error && (
            <p className="text-sm text-error bg-error/10 border border-error/20 rounded-lg px-3 py-2">
              {error}
            </p>
          )}

          <Button
            type="submit"
            size="lg"
            loading={loading}
            disabled={!form.username || !form.password}
            className="w-full mt-1"
          >
            Войти
          </Button>
        </form>

        {/* Footer */}
        <p className="text-center text-text-disabled text-sm mt-4">
          Нет аккаунта?{' '}
          <Link to="/register" className="text-primary hover:text-primary-hover transition-colors">
            Зарегистрироваться
          </Link>
        </p>
      </div>
    </div>
  )
}
