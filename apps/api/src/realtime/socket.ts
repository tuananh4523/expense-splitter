import type { Server as HttpServer } from 'node:http'
import { prisma } from '@expense/database'
import { Server } from 'socket.io'
import { verifyAccessToken } from '../lib/jwt.js'

let io: Server | null = null

function allowedWebOrigins(): string[] {
  const raw = process.env.WEB_URL ?? 'http://localhost:3000'
  const origins = raw
    .split(',')
    .map((v) => v.trim())
    .filter((v) => v.length > 0)
  return origins.length > 0 ? origins : ['http://localhost:3000']
}

export function attachSocketServer(httpServer: HttpServer): Server {
  const origins = allowedWebOrigins()
  io = new Server(httpServer, {
    path: '/socket.io/',
    transports: ['websocket', 'polling'],
    cors: {
      origin: origins,
      credentials: true,
    },
  })

  io.use(async (socket, next) => {
    try {
      const token = socket.handshake.auth.token as string | undefined
      if (!token) {
        return next(new Error('Unauthorized'))
      }
      const { sub, jti } = verifyAccessToken(token)
      const user = await prisma.user.findUnique({
        where: { id: sub },
        select: { isActive: true },
      })
      if (!user?.isActive) {
        return next(new Error('Forbidden'))
      }
      const sess = await prisma.userSession.findUnique({
        where: { jti },
        select: { userId: true },
      })
      if (!sess || sess.userId !== sub) {
        return next(new Error('Unauthorized'))
      }
      socket.data.userId = sub
      next()
    } catch {
      next(new Error('Unauthorized'))
    }
  })

  io.on('connection', (socket) => {
    const uid = socket.data.userId as string
    void socket.join(`user:${uid}`)
  })

  return io
}

export function getIo(): Server | null {
  return io
}

/** User đang có ít nhất một kết nối Socket.IO (thường là đang mở web app). */
export async function getOnlineUserIds(): Promise<Set<string>> {
  if (!io) return new Set()
  const sockets = await io.fetchSockets()
  const ids = new Set<string>()
  for (const s of sockets) {
    const uid = s.data.userId as string | undefined
    if (uid) ids.add(uid)
  }
  return ids
}

/** Đẩy thông báo hệ thống tới từng user đang kết nối (realtime). */
export function emitSystemBroadcastToUsers(
  userIds: string[],
  payload: { broadcastId: string; title: string; body: string },
): void {
  if (!io || userIds.length === 0) return
  for (const uid of userIds) {
    io.to(`user:${uid}`).emit('system_broadcast', payload)
  }
}
