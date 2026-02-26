import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { authApi } from '@/api/auth'
import { useAuthStore } from '@/store/auth'
import { getHwid } from '@/lib/hwid'
import { Button } from '@/components/ui/Button'
import { Input } from '@/components/ui/Input'
import { Logo } from '@/components/ui/Logo'
import { ApiError } from '@/api/client'

export function SetupPage() {
  const navigate = useNavigate()
  const setAuth = useAuthStore((s) => s.setAuth)
  const { t } = useTranslation()

  const [form, setForm] = useState({
    username: '',
    display_name: '',
    password: '',
  })
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')
    setLoading(true)

    try {
      const data = await authApi.setup({
        username: form.username,
        display_name: form.display_name,
        password: form.password,
        hwid: getHwid(),
      })
      setAuth(data.user, data.access_token, data.refresh_token)
      navigate('/app')
    } catch (err) {
      if (err instanceof ApiError && err.status === 409) {
        navigate('/login')
      } else {
        setError(t('auth.setup.error'))
      }
    } finally {
      setLoading(false)
    }
  }

  const set = (key: keyof typeof form) => (e: React.ChangeEvent<HTMLInputElement>) =>
    setForm((f) => ({ ...f, [key]: key === 'username' ? e.target.value.toLowerCase() : e.target.value }))

  return (
    <div className="min-h-screen bg-bg flex items-center justify-center p-4">
      <div className="w-full max-w-sm">
        <div className="flex flex-col items-center gap-4 mb-8">
          <Logo size={56} />
          <div className="text-center">
            <h1 className="font-pixel text-[28px] font-semibold leading-[1.1] text-text">{t('auth.setup.title')}</h1>
            <p className="text-text-secondary text-sm mt-1 max-w-xs">
              {t('auth.setup.subtitle')}
            </p>
          </div>
        </div>

        <div className="bg-primary/10 border border-primary/20 rounded-xl px-4 py-3 mb-6 text-sm text-primary-glow">
          {t('auth.setup.adminNotice')}
        </div>

        <form
          onSubmit={handleSubmit}
          className="bg-secondary border border-elevated rounded-2xl p-6 flex flex-col gap-4"
        >
          <Input
            label={t('common.fields.username')}
            placeholder="admin"
            value={form.username}
            onChange={set('username')}
            disabled={loading}
          />
          <Input
            label={t('common.fields.displayName')}
            placeholder="Admin"
            value={form.display_name}
            onChange={set('display_name')}
            disabled={loading}
          />
          <Input
            label={t('common.fields.password')}
            type="password"
            placeholder="••••••••"
            value={form.password}
            onChange={set('password')}
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
            disabled={!form.username || !form.display_name || !form.password}
            className="w-full mt-1"
          >
            {t('auth.setup.submit')}
          </Button>
        </form>
      </div>
    </div>
  )
}
