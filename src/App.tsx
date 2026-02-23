import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import { SetupGuard } from '@/components/SetupGuard'
import { AuthGuard } from '@/components/AuthGuard'
import { SetupPage } from '@/pages/auth/SetupPage'
import { LoginPage } from '@/pages/auth/LoginPage'
import { RegisterPage } from '@/pages/auth/RegisterPage'
import { AppLayout } from '@/pages/app/AppLayout'
import { HomePage } from '@/pages/app/HomePage'
import { ChatPage } from '@/pages/app/ChatPage'

export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        {/* Публичные маршруты — сначала проверяем инициализацию */}
        <Route element={<SetupGuard />}>
          <Route path="/setup" element={<SetupPage />} />
          <Route path="/login" element={<LoginPage />} />
          <Route path="/register" element={<RegisterPage />} />
        </Route>

        {/* Защищённые маршруты */}
        <Route element={<AuthGuard />}>
          <Route path="/app" element={<AppLayout />}>
            <Route index element={<HomePage />} />
            <Route path="dm/:roomId" element={<ChatPage />} />
          </Route>
        </Route>

        {/* Корень — редирект */}
        <Route path="/" element={<Navigate to="/app" replace />} />
        <Route path="*" element={<Navigate to="/app" replace />} />
      </Routes>
    </BrowserRouter>
  )
}
