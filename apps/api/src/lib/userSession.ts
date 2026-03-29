import { Prisma, prisma } from '@expense/database'
import type { Context } from 'hono'
import { clientIp, summarizeUserAgent } from './requestMeta.js'

/** Giải thích lỗi khi create UserSession (vd. thiếu bảng sau khi chưa migrate). */
export function formatUserSessionCreateError(e: unknown): string {
  if (e instanceof Prisma.PrismaClientKnownRequestError) {
    if (e.code === 'P2021') {
      return (
        'Cơ sở dữ liệu chưa có bảng phiên đăng nhập (UserSession). ' +
        'Chạy migration: pnpm db:migrate (môi trường dev) hoặc pnpm db:migrate:deploy (production).'
      )
    }
  }
  return 'Không tạo được phiên đăng nhập'
}

export async function createUserSession(c: Context, userId: string, jti: string) {
  const ua = (c.req.header('user-agent') ?? '').trim()
  const ip = clientIp(c).trim()
  await prisma.userSession.create({
    data: {
      userId,
      jti,
      userAgent: ua ? ua.slice(0, 512) : null,
      ipAddress: ip ? ip.slice(0, 64) : null,
      deviceLabel: summarizeUserAgent(ua),
    },
  })
}
