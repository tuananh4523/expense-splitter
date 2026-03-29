import { notificationKeys } from '@/hooks/useNotifications'
import { getSocketBaseUrl } from '@/lib/socketUrl'
import { Icon } from '@iconify/react'
import { App } from 'antd'
import { useQueryClient } from '@tanstack/react-query'
import { useSession } from 'next-auth/react'
import { useEffect, useRef } from 'react'
import { io } from 'socket.io-client'

const STORAGE_KEY = 'expense_seen_broadcast_ids'

function readSeen(): Set<string> {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (!raw) return new Set()
    const arr = JSON.parse(raw) as unknown
    if (!Array.isArray(arr)) return new Set()
    return new Set(arr.filter((x): x is string => typeof x === 'string'))
  } catch {
    return new Set()
  }
}

function writeSeen(ids: Set<string>) {
  const arr = [...ids].slice(-80)
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(arr))
  } catch {
    /* ignore */
  }
}

type SystemBroadcastPayload = {
  broadcastId: string
  title: string
  body: string
}

/**
 * Realtime qua Socket.IO: admin gửi broadcast → server đẩy tới room user — hiện notification (theo AntdApp) + làm mới thông báo.
 */
export function SystemBroadcastListener() {
  const { status, data: session } = useSession()
  const { notification } = App.useApp()
  const qc = useQueryClient()
  const seenRef = useRef<Set<string>>(new Set())

  useEffect(() => {
    if (status !== 'authenticated') return
    const token = session?.accessToken
    if (!token) return

    seenRef.current = readSeen()

    const base = getSocketBaseUrl()
    if (!base) return

    const socket = io(base, {
      path: '/socket.io/',
      // Ưu tiên polling để đảm bảo kết nối ổn định sau proxy; vẫn nâng cấp websocket khi khả dụng.
      transports: ['polling', 'websocket'],
      auth: { token },
      reconnection: true,
      reconnectionDelay: 1000,
      reconnectionDelayMax: 5000,
      reconnectionAttempts: 10,
    })

    const onBroadcast = (payload: SystemBroadcastPayload) => {
      if (!payload?.broadcastId) return
      if (seenRef.current.has(payload.broadcastId)) return
      seenRef.current.add(payload.broadcastId)
      writeSeen(seenRef.current)
      notification.open({
        message: (
          <div className="expense-broadcast-toast__title-row">
            <span className="expense-broadcast-toast__icon" aria-hidden>
              <Icon icon="mdi:bell-outline" width={18} />
            </span>
            <span className="expense-broadcast-toast__title">{payload.title}</span>
          </div>
        ),
        description: <div className="expense-broadcast-toast__body">{payload.body}</div>,
        className: 'expense-broadcast-toast',
        duration: 12,
      })
      void qc.invalidateQueries({ queryKey: notificationKeys.all })
    }

    socket.on('system_broadcast', onBroadcast)

    return () => {
      socket.off('system_broadcast', onBroadcast)
      socket.disconnect()
    }
  }, [status, session?.accessToken, notification, qc])

  return null
}
