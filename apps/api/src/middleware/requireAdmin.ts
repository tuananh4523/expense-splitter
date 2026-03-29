import { createMiddleware } from 'hono/factory'

export const requireAdmin = createMiddleware<{
  Variables: { userId: string; userRole: string; sessionJti: string }
}>(async (c, next) => {
  if (c.get('userRole') !== 'ADMIN') {
    return c.json({ error: 'Forbidden — Admin only' }, 403)
  }
  await next()
})
