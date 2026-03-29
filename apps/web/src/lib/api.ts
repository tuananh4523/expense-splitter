import type { ApiError } from '@expense/types'
import axios, { type AxiosError } from 'axios'
import { getSession, signOut } from 'next-auth/react'

// Points to Next.js rewrite → Hono backend (except /api/auth/*)
export const api = axios.create({
  baseURL: '/api',
  headers: { 'Content-Type': 'application/json' },
  timeout: 15_000,
})

api.interceptors.request.use(async (config) => {
  const session = await getSession()
  if (session?.accessToken) {
    config.headers.Authorization = `Bearer ${session.accessToken}`
  }
  /** Tránh trình duyệt / proxy trả bản GET cũ sau khi PATCH — làm list chi tiêu không đổi đến khi F5. */
  if ((config.method ?? 'get').toLowerCase() === 'get' && typeof window !== 'undefined') {
    config.headers['Cache-Control'] = 'no-cache'
    config.headers['Pragma'] = 'no-cache'
  }
  return config
})

api.interceptors.response.use(
  (r) => r,
  async (error: AxiosError<ApiError>) => {
    const status = error.response?.status
    const data = error.response?.data
    if (typeof window !== 'undefined') {
      if (status === 403 && data?.code === 'ACCOUNT_DISABLED') {
        await signOut({ callbackUrl: '/auth/login?reason=locked' })
      } else if (status === 401) {
        const session = await getSession()
        if (session?.accessToken) {
          await signOut({ callbackUrl: '/auth/login?reason=session' })
        }
      }
    }
    const message = data?.error ?? error.message ?? 'Lỗi không xác định'
    return Promise.reject(new Error(message))
  },
)
