import { prisma } from '@expense/database'
import type { NotificationDto, PaginatedResponse } from '@expense/types'
import { Hono } from 'hono'
import { requireAuth } from '../middleware/auth.js'

export const categoryRoutes = new Hono<{
  Variables: { userId: string; userRole: string; sessionJti: string }
}>()
categoryRoutes.use('*', requireAuth)
categoryRoutes.get('/', async (c) => {
  const groupId = c.req.query('groupId')
  const userId = c.get('userId')
  
  const where: any = { isSystem: true }
  
  if (groupId) {
    const member = await prisma.groupMember.findFirst({
      where: { groupId, userId, isActive: true, leftAt: null },
    })
    if (member) {
      where.OR = [
        { isSystem: true },
        { groupId: groupId },
      ]
      delete where.isSystem
    }
  }

  const list = await prisma.category.findMany({
    where,
    orderBy: [{ isSystem: 'desc' }, { name: 'asc' }],
    select: { id: true, name: true, icon: true, color: true, isSystem: true },
  })
  return c.json({ data: list })
})

export const notificationRoutes = new Hono<{
  Variables: { userId: string; userRole: string; sessionJti: string }
}>()
notificationRoutes.use('*', requireAuth)

/** Bản SYSTEM mới nhất (để client so broadcastId với localStorage và hiện toast). */
notificationRoutes.get('/latest-system', async (c) => {
  const userId = c.get('userId')
  const row = await prisma.notification.findFirst({
    where: {
      userId,
      type: 'SYSTEM_ANNOUNCEMENT',
      broadcastId: { not: null },
    },
    orderBy: { createdAt: 'desc' },
    select: {
      id: true,
      broadcastId: true,
      title: true,
      body: true,
      createdAt: true,
    },
  })
  if (!row?.broadcastId) {
    return c.json({ data: null })
  }
  return c.json({
    data: {
      id: row.id,
      broadcastId: row.broadcastId,
      title: row.title,
      body: row.body,
      createdAt: row.createdAt.toISOString(),
    },
  })
})

notificationRoutes.get('/unread-count', async (c) => {
  const userId = c.get('userId')
  const count = await prisma.notification.count({ where: { userId, isRead: false } })
  return c.json({ data: { count } })
})

notificationRoutes.get('/', async (c) => {
  const userId = c.get('userId')
  const page = Number(c.req.query('page') ?? '1') || 1
  const limit = Math.min(100, Number(c.req.query('limit') ?? '20') || 20)
  const [total, rows] = await Promise.all([
    prisma.notification.count({ where: { userId } }),
    prisma.notification.findMany({
      where: { userId },
      orderBy: { createdAt: 'desc' },
      skip: (page - 1) * limit,
      take: limit,
    }),
  ])
  const data: PaginatedResponse<NotificationDto> = {
    data: rows.map((n) => ({
      id: n.id,
      type: n.type,
      title: n.title,
      body: n.body,
      isRead: n.isRead,
      data: (n.data as Record<string, unknown> | null) ?? null,
      broadcastId: n.broadcastId ?? null,
      createdAt: n.createdAt.toISOString(),
    })),
    total,
    page,
    limit,
    totalPages: Math.max(1, Math.ceil(total / limit)),
  }
  return c.json({ data })
})

notificationRoutes.patch('/read', async (c) => {
  const userId = c.get('userId')
  let body: { id?: string; markAll?: boolean }
  try {
    body = (await c.req.json()) as { id?: string; markAll?: boolean }
  } catch {
    return c.json({ error: 'Invalid JSON' }, 400)
  }
  if (body.markAll) {
    await prisma.notification.updateMany({ where: { userId }, data: { isRead: true } })
  } else if (body.id) {
    await prisma.notification.updateMany({
      where: { id: body.id, userId },
      data: { isRead: true },
    })
  }
  return c.json({ data: { ok: true } })
})
