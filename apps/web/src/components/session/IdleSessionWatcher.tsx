import { useMe } from '@/hooks/useProfile'
import { signOut, useSession } from 'next-auth/react'
import { useEffect } from 'react'

/**
 * Đọc `idleTimeoutMinutes` từ /users/me; nếu &gt; 0 thì đăng xuất sau khoảng thời gian không tương tác.
 */
export function IdleSessionWatcher() {
  const { status } = useSession()
  const { data: me } = useMe({ enabled: status === 'authenticated' })

  useEffect(() => {
    if (typeof window === 'undefined') return
    if (status !== 'authenticated' || !me) return
    const minutes = me.idleTimeoutMinutes ?? 0
    if (minutes <= 0) return

    const msLimit = minutes * 60_000
    let lastActivity = Date.now()
    let lastThrottle = 0

    const onActivity = () => {
      const t = Date.now()
      if (t - lastThrottle < 1000) return
      lastThrottle = t
      lastActivity = t
    }

    const events = [
      'mousedown',
      'keydown',
      'scroll',
      'touchstart',
      'click',
      'mousemove',
      'wheel',
    ] as const
    for (const e of events) {
      window.addEventListener(e, onActivity, { passive: true })
    }

    const interval = window.setInterval(() => {
      if (Date.now() - lastActivity >= msLimit) {
        void signOut({ callbackUrl: '/auth/login?reason=idle' })
      }
    }, 15_000)

    return () => {
      for (const e of events) {
        window.removeEventListener(e, onActivity)
      }
      window.clearInterval(interval)
    }
  }, [status, me?.idleTimeoutMinutes])

  return null
}
