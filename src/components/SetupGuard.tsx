import { useEffect, useState } from 'react'
import { useNavigate, Outlet } from 'react-router-dom'
import { authApi } from '@/api/auth'

// Редиректит на /setup если система не инициализирована
export function SetupGuard() {
  const navigate = useNavigate()
  const [checked, setChecked] = useState(false)

  useEffect(() => {
    authApi.checkSetup().then(({ initialized }) => {
      if (!initialized) {
        navigate('/setup', { replace: true })
      }
      setChecked(true)
    }).catch(() => {
      setChecked(true)
    })
  }, [])

  if (!checked) return null

  return <Outlet />
}
