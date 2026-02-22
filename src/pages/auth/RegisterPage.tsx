import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { authApi } from '@/api/auth'
import { useAuthStore } from '@/store/auth'
import { getHwid } from '@/lib/hwid'
import { Button } from '@/components/ui/Button'
import { Input } from '@/components/ui/Input'
import { Logo } from '@/components/ui/Logo'
import { ApiError } from '@/api/client'

export function RegisterPage() {
  const navigate = useNavigate()
  const setAuth = useAuthStore((s) => s.setAuth)

  const [form, setForm] = useState({
    username: '',
    display_name: '',
    password: '',
    confirm: '',
  })
  const [errors, setErrors] = useState<Record<string, string>>({})
  const [loading, setLoading] = useState(false)

  const validate = () => {
    const e: Record<string, string> = {}
    if (form.username.length < 3) e.username = 'Минимум 3 символа'
    if (!/^[a-z0-9_]+$/.test(form.username))
      e.username = 'Только строчные буквы, цифры и _'
    if (!form.display_name.trim()) e.display_name = 'Обязательное поле'
    if (form.password.length < 8) e.password = 'Минимум 8 символов'
    if (form.password !== form.confirm) e.confirm = 'Пароли не совпадают'
    return e
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    const errs = validate()
    if (Object.keys(errs).length) {
      setErrors(errs)
      return
    }
    setErrors({})
    setLoading(true)

    try {
      const data = await authApi.register({
        username: form.username,
        display_name: form.display_name,
        password: form.password,
        hwid: getHwid(),
      })
      setAuth(data.user, data.access_token, data.refresh_token)
      navigate('/app')
    } catch (err) {
      if (err instanceof ApiError && err.status === 409) {
        setErrors({ username: 'Имя пользователя занято' })
      } else {
        setErrors({ global: 'Ошибка сервера. Попробуйте позже.' })
      }
    } finally {
      setLoading(false)
    }
  }

  const set = (key: keyof typeof form) => (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = key === 'username' ? e.target.value.toLowerCase() : e.target.value
    setForm((f) => ({ ...f, [key]: value }))
    if (errors[key]) setErrors((prev) => ({ ...prev, [key]: '' }))
  }

  return (
    <div className="min-h-screen bg-bg flex items-center justify-center p-4">
      <div className="w-full max-w-sm">
        <div className="flex flex-col items-center gap-3 mb-8">
          <Logo size={48} />
          <div className="text-center">
            <h1 className="font-pixel text-[28px] font-semibold leading-[1.1] text-text">Создать аккаунт</h1>
            <p className="text-text-secondary text-sm mt-1">Присоединяйтесь к Nook</p>
          </div>
        </div>

        <form
          onSubmit={handleSubmit}
          className="bg-secondary border border-elevated rounded-2xl p-6 flex flex-col gap-4"
        >
          <Input
            label="Имя пользователя"
            placeholder="alice"
            autoComplete="username"
            value={form.username}
            onChange={set('username')}
            error={errors.username}
            hint="Только строчные буквы, цифры и _"
            disabled={loading}
          />
          <Input
            label="Отображаемое имя"
            placeholder="Alice"
            value={form.display_name}
            onChange={set('display_name')}
            error={errors.display_name}
            disabled={loading}
          />
          <Input
            label="Пароль"
            type="password"
            placeholder="••••••••"
            autoComplete="new-password"
            value={form.password}
            onChange={set('password')}
            error={errors.password}
            disabled={loading}
          />
          <Input
            label="Повторите пароль"
            type="password"
            placeholder="••••••••"
            autoComplete="new-password"
            value={form.confirm}
            onChange={set('confirm')}
            error={errors.confirm}
            disabled={loading}
          />

          {errors.global && (
            <p className="text-sm text-error bg-error/10 border border-error/20 rounded-lg px-3 py-2">
              {errors.global}
            </p>
          )}

          <Button
            type="submit"
            size="lg"
            loading={loading}
            className="w-full mt-1"
          >
            Зарегистрироваться
          </Button>
        </form>

        <p className="text-center text-text-disabled text-sm mt-4">
          Уже есть аккаунт?{' '}
          <Link to="/login" className="text-primary hover:text-primary-hover transition-colors">
            Войти
          </Link>
        </p>
      </div>
    </div>
  )
}
