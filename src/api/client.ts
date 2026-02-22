import type { AuthResponse } from '@/types/api'

const BASE_URL = '/api/v1'

class ApiError extends Error {
  status: number
  body: { error: string }

  constructor(status: number, body: { error: string }) {
    super(body.error)
    this.status = status
    this.body = body
  }
}

async function request<T>(
  path: string,
  options: RequestInit = {},
  isFormData = false,
): Promise<T> {
  const token = localStorage.getItem('access_token')

  const headers: Record<string, string> = isFormData
    ? {}
    : { 'Content-Type': 'application/json', ...(options.headers as Record<string, string>) }

  if (token) {
    headers['Authorization'] = `Bearer ${token}`
  }

  const res = await fetch(`${BASE_URL}${path}`, {
    ...options,
    headers,
  })

  if (res.status === 204) return undefined as T

  const data = await res.json()

  if (!res.ok) {
    if (res.status === 401) {
      const refreshed = await tryRefresh()
      if (refreshed) {
        return request<T>(path, options, isFormData)
      }
    }
    throw new ApiError(res.status, data)
  }

  return data as T
}

async function tryRefresh(): Promise<boolean> {
  const refreshToken = localStorage.getItem('refresh_token')
  if (!refreshToken) return false

  try {
    const res = await fetch(`${BASE_URL}/auth/refresh`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ refresh_token: refreshToken }),
    })

    if (!res.ok) {
      localStorage.removeItem('access_token')
      localStorage.removeItem('refresh_token')
      return false
    }

    const data: AuthResponse = await res.json()
    localStorage.setItem('access_token', data.access_token)
    localStorage.setItem('refresh_token', data.refresh_token)
    return true
  } catch {
    return false
  }
}

export const api = {
  get: <T>(path: string) => request<T>(path),
  post: <T>(path: string, body?: unknown) =>
    request<T>(path, { method: 'POST', body: body ? JSON.stringify(body) : undefined }),
  postForm: <T>(path: string, form: FormData) =>
    request<T>(path, { method: 'POST', body: form }, true),
  patch: <T>(path: string, body?: unknown) =>
    request<T>(path, { method: 'PATCH', body: body ? JSON.stringify(body) : undefined }),
  delete: <T>(path: string) => request<T>(path, { method: 'DELETE' }),
}

export { ApiError }
