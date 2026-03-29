import { prisma } from '@expense/database'
import { createFeedbackSchema } from '@expense/types'
import { Hono } from 'hono'
import { requireAuth } from '../middleware/auth.js'

export const feedbackRoutes = new Hono<{
  Variables: { userId: string; userRole: string; sessionJti: string }
}>()
feedbackRoutes.use('*', requireAuth)

feedbackRoutes.post('/', async (c) => {
  const userId = c.get('userId')
  let body: unknown
  try {
    body = await c.req.json()
  } catch {
    return c.json({ error: 'Invalid JSON' }, 400)
  }
  const parsed = createFeedbackSchema.safeParse(body)
  if (!parsed.success) {
    return c.json({ error: parsed.error.issues[0]?.message ?? 'Dữ liệu không hợp lệ' }, 400)
  }

  const d = parsed.data
  if (d.type === 'PRAISE') {
    const row = await prisma.feedback.create({
      data: {
        userId,
        type: 'PRAISE',
        rating: d.rating,
        title: d.title?.trim() || null,
        body: d.description?.trim() || null,
        imageUrls: [],
      },
      select: { id: true, createdAt: true },
    })
    return c.json({
      data: { id: row.id, createdAt: row.createdAt.toISOString() },
    })
  }

  const row = await prisma.feedback.create({
    data: {
      userId,
      type: 'ISSUE',
      title: d.title.trim(),
      body: d.description.trim(),
      imageUrls: d.imageUrls,
    },
    select: { id: true, createdAt: true },
  })
  return c.json({
    data: { id: row.id, createdAt: row.createdAt.toISOString() },
  })
})
