import { prisma } from '@expense/database'
import { createMiddleware } from 'hono/factory'
import { verifyAccessToken } from '../lib/jwt.js'

export const requireAuth = createMiddleware<{
  Variables: { userId: string; userRole: string; sessionJti: string }
}>(async (c, next) => {
  const auth = c.req.header('Authorization')
  if (!auth?.startsWith('Bearer ')) {
    return c.json({ error: 'Unauthorized' }, 401)
  }
  const token = auth.slice(7).trim()
  if (!token) {
    return c.json({ error: 'Unauthorized' }, 401)
  }
  try {
    const { sub, jti } = verifyAccessToken(token)
    const user = await prisma.user.findUnique({
      where: { id: sub },
      select: { isActive: true, role: true },
    })
    if (!user?.isActive) {
      return c.json({ error: 'Tài khoản đã bị khóa', code: 'ACCOUNT_DISABLED' }, 403)
    }
    const sess = await prisma.userSession.findUnique({
      where: { jti },
      select: { userId: true },
    })
    if (!sess || sess.userId !== sub) {
      return c.json({ error: 'Phiên đăng nhập không còn hiệu lực' }, 401)
    }
    c.set('userId', sub)
    /** Luôn lấy từ DB — quyền đổi sau đăng nhập (ADMIN/USER) áp dụng ngay, không phụ thuộc claim role trong JWT. */
    c.set('userRole', user.role)
    c.set('sessionJti', jti)
    await next()
  } catch {
    return c.json({ error: 'Unauthorized' }, 401)
  }
})
