import { api } from '@/lib/api'
import { useSession } from 'next-auth/react'
import { useEffect, useRef } from 'react'

const INTERVAL_MS = 20_000
const MIN_GAP_MS = 4000

/**
 * Khi phiên bị thu hồi (đăng xuất từ xa), JWT vẫn còn trong cookie nhưng API từ chối.
 * Gọi /users/me định kỳ và khi quay lại tab để 401 đi qua interceptor → signOut về login.
 */
export function SessionValidityWatcher() {
  const { status } = useSession()
  const lastProbeRef = useRef(0)

  useEffect(() => {
    if (typeof window === 'undefined') return
    if (status !== 'authenticated') return

    const probe = (force = false) => {
      const t = Date.now()
      if (!force && t - lastProbeRef.current < MIN_GAP_MS) return
      lastProbeRef.current = t
      void api.get('/users/me').catch(() => {
        /* 401: lib/api đã signOut + redirect */
      })
    }

    const interval = window.setInterval(() => probe(true), INTERVAL_MS)

    const onVisible = () => {
      if (document.visibilityState === 'visible') probe(false)
    }
    const onFocus = () => probe(false)
    const onOnline = () => probe(true)

    document.addEventListener('visibilitychange', onVisible)
    window.addEventListener('focus', onFocus)
    window.addEventListener('online', onOnline)

    return () => {
      window.clearInterval(interval)
      document.removeEventListener('visibilitychange', onVisible)
      window.removeEventListener('focus', onFocus)
      window.removeEventListener('online', onOnline)
    }
  }, [status])

  return null
}
