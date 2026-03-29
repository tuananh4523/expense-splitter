import { prisma, Prisma } from '@expense/database'
import type { AdminBroadcastHistoryItemDto, AdminBroadcastRecipientDto } from '@expense/types'
import {
  adminBroadcastSchema,
  adminCreateUserSchema,
  adminSetUserPasswordSchema,
  patchAdminFeedbackSchema,
  patchSystemSettingsSchema,
} from '@expense/types'
import bcrypt from 'bcryptjs'
import { randomUUID } from 'node:crypto'
import { Hono } from 'hono'
import { z } from 'zod'
import { emitSystemBroadcastToUsers, getOnlineUserIds } from '../realtime/socket.js'
import { deleteUserAndRelatedData } from '../lib/delete-user.js'
import { cleanupGroupOperationalData } from '../lib/group-data-cleanup.js'
import { signedStorageUrlForUser } from '../lib/minio.js'
import { deleteOrphanStorageObjects } from '../lib/storage-cleanup.js'
import { getOrCreateSystemConfig } from '../lib/systemConfig.js'
import { requireAuth } from '../middleware/auth.js'
import { requireAdmin } from '../middleware/requireAdmin.js'

const listUsersQuery = z.object({
  page: z.coerce.number().default(1),
  limit: z.coerce.number().min(1).max(500).default(20),
  search: z.string().optional(),
  role: z.enum(['ADMIN', 'USER']).optional(),
  isActive: z
    .enum(['true', 'false'])
    .optional()
    .transform((v) => (v === undefined ? undefined : v === 'true')),
})

const patchUserBody = z.object({
  role: z.enum(['ADMIN', 'USER']).optional(),
  isActive: z.boolean().optional(),
})

const categoryBody = z.object({
  name: z.string().min(1).max(100),
  icon: z.string().max(120).optional().nullable(),
  color: z.string().max(32).optional().nullable(),
  isSystem: z.boolean().optional(),
})

export const adminRoutes = new Hono<{
  Variables: { userId: string; userRole: string; sessionJti: string }
}>()
adminRoutes.use('*', requireAuth, requireAdmin)

/** Xóa object MinIO không còn bản ghi DB trỏ tới (avatar cũ, ảnh chi đã gỡ…). */
adminRoutes.post('/storage/cleanup-orphans', async (c) => {
  const data = await deleteOrphanStorageObjects()
  return c.json({ data })
})

/**
 * Dọn dữ liệu vận hành theo nhóm: giữ cài đặt nhóm; xóa comment, audit, log hoạt động, toàn bộ giao dịch quỹ,
 * đợt tổng kết COMPLETED và chi thuộc đợt.
 */
adminRoutes.post('/groups/:groupId/cleanup-data', async (c) => {
  const groupId = c.req.param('groupId')
  const result = await cleanupGroupOperationalData(groupId)
  if (!result) {
    return c.json({ error: 'Không tìm thấy nhóm' }, 404)
  }
  return c.json({ data: result })
})

adminRoutes.get('/stats', async (c) => {
  const thirtyDaysAgo = new Date(Date.now() - 30 * 86400000)
  const [userCount, groupCount, expenseCount, pendingSettlements] = await Promise.all([
    prisma.user.count({ where: { isActive: true } }),
    prisma.group.count({ where: { isActive: true } }),
    prisma.expense.count({ where: { expenseDate: { gte: thirtyDaysAgo } } }),
    prisma.settlement.count({ where: { status: 'PENDING' } }),
  ])
  return c.json({ data: { userCount, groupCount, expenseCount, pendingSettlements } })
})

adminRoutes.get('/settings', async (c) => {
  const cfg = await getOrCreateSystemConfig()
  return c.json({
    data: {
      idleTimeoutMinutes: cfg.idleTimeoutMinutes,
      updatedAt: cfg.updatedAt.toISOString(),
    },
  })
})

adminRoutes.patch('/settings', async (c) => {
  let body: unknown
  try {
    body = await c.req.json()
  } catch {
    return c.json({ error: 'Invalid JSON' }, 400)
  }
  const parsed = patchSystemSettingsSchema.safeParse(body)
  if (!parsed.success) {
    return c.json({ error: parsed.error.issues[0]?.message ?? 'Dữ liệu không hợp lệ' }, 400)
  }
  const row = await prisma.systemConfig.upsert({
    where: { id: 'default' },
    create: { id: 'default', idleTimeoutMinutes: parsed.data.idleTimeoutMinutes },
    update: { idleTimeoutMinutes: parsed.data.idleTimeoutMinutes },
  })
  return c.json({
    data: {
      idleTimeoutMinutes: row.idleTimeoutMinutes,
      updatedAt: row.updatedAt.toISOString(),
    },
  })
})

adminRoutes.get('/users', async (c) => {
  const parsed = listUsersQuery.safeParse({
    page: c.req.query('page'),
    limit: c.req.query('limit'),
    search: c.req.query('search'),
    role: c.req.query('role'),
    isActive: c.req.query('isActive'),
  })
  if (!parsed.success) {
    return c.json({ error: parsed.error.issues[0]?.message ?? 'Query không hợp lệ' }, 400)
  }
  const { page, limit, search, role, isActive } = parsed.data
  const where = {
    ...(search
      ? {
          OR: [
            { name: { contains: search, mode: 'insensitive' as const } },
            { email: { contains: search, mode: 'insensitive' as const } },
          ],
        }
      : {}),
    ...(role ? { role } : {}),
    ...(isActive !== undefined ? { isActive } : {}),
  }
  const [users, total, onlineIds] = await Promise.all([
    prisma.user.findMany({
      where,
      select: {
        id: true,
        email: true,
        name: true,
        avatarUrl: true,
        role: true,
        isActive: true,
        lastLoginAt: true,
        createdAt: true,
        _count: { select: { memberships: true } },
      },
      skip: (page - 1) * limit,
      take: limit,
      orderBy: { createdAt: 'desc' },
    }),
    prisma.user.count({ where }),
    getOnlineUserIds(),
  ])
  const data = users.map((u) => ({
    ...u,
    online: onlineIds.has(u.id),
  }))
  return c.json({
    data,
    total,
    onlineTotal: onlineIds.size,
    page,
    totalPages: Math.ceil(total / limit) || 1,
    limit,
  })
})

adminRoutes.post('/users', async (c) => {
  let body: unknown
  try {
    body = await c.req.json()
  } catch {
    return c.json({ error: 'Invalid JSON' }, 400)
  }
  const parsed = adminCreateUserSchema.safeParse(body)
  if (!parsed.success) {
    return c.json({ error: parsed.error.issues[0]?.message ?? 'Dữ liệu không hợp lệ' }, 400)
  }
  const { email, name, password, role } = parsed.data
  const normalized = email.toLowerCase().trim()
  const exists = await prisma.user.findUnique({ where: { email: normalized } })
  if (exists) {
    return c.json({ error: 'Email đã được sử dụng' }, 409)
  }
  const passwordHash = await bcrypt.hash(password, 12)
  const user = await prisma.user.create({
    data: {
      email: normalized,
      name: name.trim(),
      passwordHash,
      role,
      isActive: true,
      mustChangePassword: false,
    },
    select: {
      id: true,
      email: true,
      name: true,
      avatarUrl: true,
      role: true,
      isActive: true,
      lastLoginAt: true,
      createdAt: true,
      _count: { select: { memberships: true } },
    },
  })
  return c.json({
    data: {
      id: user.id,
      email: user.email,
      name: user.name,
      avatarUrl: user.avatarUrl,
      role: user.role,
      isActive: user.isActive,
      lastLoginAt: user.lastLoginAt?.toISOString() ?? null,
      createdAt: user.createdAt.toISOString(),
      _count: user._count,
    },
  })
})

adminRoutes.patch('/users/:userId', async (c) => {
  const userId = c.req.param('userId')
  let body: unknown
  try {
    body = await c.req.json()
  } catch {
    return c.json({ error: 'Invalid JSON' }, 400)
  }
  const parsed = patchUserBody.safeParse(body)
  if (!parsed.success) {
    return c.json({ error: parsed.error.issues[0]?.message ?? 'Dữ liệu không hợp lệ' }, 400)
  }
  const data = parsed.data
  if (userId === c.get('userId') && data.role === 'USER') {
    return c.json({ error: 'Không thể tự đổi vai trò của mình thành USER' }, 400)
  }
  if (userId === c.get('userId') && data.isActive === false) {
    return c.json({ error: 'Không thể tự khóa tài khoản của mình' }, 400)
  }
  if (data.role === 'USER') {
    const targetUser = await prisma.user.findUnique({
      where: { id: userId },
      select: { role: true },
    })
    if (!targetUser) {
      return c.json({ error: 'Không tìm thấy người dùng' }, 404)
    }
    if (targetUser.role === 'ADMIN') {
      const otherAdmins = await prisma.user.count({
        where: { role: 'ADMIN', id: { not: userId } },
      })
      if (otherAdmins === 0) {
        return c.json({ error: 'Phải còn ít nhất một tài khoản ADMIN trên hệ thống' }, 400)
      }
    }
  }
  const update: { role?: 'ADMIN' | 'USER'; isActive?: boolean } = {}
  if (data.role !== undefined) update.role = data.role
  if (data.isActive !== undefined) update.isActive = data.isActive
  if (Object.keys(update).length === 0) {
    return c.json({ error: 'Không có dữ liệu cập nhật' }, 400)
  }
  const user = await prisma.user.update({
    where: { id: userId },
    data: update,
  })
  return c.json({
    data: {
      id: user.id,
      email: user.email,
      name: user.name,
      avatarUrl: user.avatarUrl,
      role: user.role,
      isActive: user.isActive,
      createdAt: user.createdAt.toISOString(),
    },
  })
})

adminRoutes.delete('/users/:userId', async (c) => {
  const userId = c.req.param('userId')
  if (userId === c.get('userId')) {
    return c.json({ error: 'Không thể xóa tài khoản của chính mình' }, 400)
  }
  const target = await prisma.user.findUnique({ where: { id: userId }, select: { id: true, role: true } })
  if (!target) {
    return c.json({ error: 'Không tìm thấy người dùng' }, 404)
  }
  if (target.role === 'ADMIN') {
    const otherAdmins = await prisma.user.count({
      where: { role: 'ADMIN', id: { not: userId } },
    })
    if (otherAdmins === 0) {
      return c.json({ error: 'Không thể xóa admin cuối cùng của hệ thống' }, 400)
    }
  }
  try {
    await deleteUserAndRelatedData(userId)
  } catch (e) {
    console.error('deleteUserAndRelatedData', e)
    return c.json({ error: 'Không xóa được người dùng (còn dữ liệu liên quan chưa xử lý)' }, 500)
  }
  return c.json({ data: { ok: true } })
})

adminRoutes.post('/users/:userId/reset-password', async (c) => {
  const userId = c.req.param('userId')
  const target = await prisma.user.findUnique({ where: { id: userId } })
  if (!target) {
    return c.json({ error: 'Không tìm thấy người dùng' }, 404)
  }

  let body: unknown
  try {
    body = await c.req.json()
  } catch {
    return c.json({ error: 'Invalid JSON' }, 400)
  }
  const parsed = adminSetUserPasswordSchema.safeParse(body)
  if (!parsed.success) {
    return c.json({ error: parsed.error.issues[0]?.message ?? 'Dữ liệu không hợp lệ' }, 400)
  }

  const { newPassword } = parsed.data
  const passwordHash = await bcrypt.hash(newPassword, 12)

  await prisma.user.update({
    where: { id: userId },
    data: {
      passwordHash,
      passwordResetToken: null,
      passwordResetExpires: null,
      mustChangePassword: true,
    },
  })

  await prisma.userSession.deleteMany({ where: { userId } })

  return c.json({
    data: {
      ok: true,
      message: 'Đã đặt mật khẩu mới. Gửi cho người dùng và nhắc đổi sau khi đăng nhập.',
    },
  })
})

adminRoutes.get('/categories', async (c) => {
  const list = await prisma.category.findMany({
    orderBy: { name: 'asc' },
    include: { _count: { select: { expenses: true } } },
  })
  return c.json({
    data: list.map((cat) => ({
      id: cat.id,
      name: cat.name,
      icon: cat.icon,
      color: cat.color,
      isSystem: cat.isSystem,
      expenseCount: cat._count.expenses,
    })),
  })
})

adminRoutes.get('/groups', async (c) => {
  const groups = await prisma.group.findMany({
    include: {
      _count: {
        select: {
          members: { where: { isActive: true, leftAt: null } },
          expenses: true,
        },
      },
      fund: { select: { balance: true } },
    },
    orderBy: { createdAt: 'desc' },
    take: 200,
  })
  return c.json({
    data: groups.map((g) => ({
      id: g.id,
      name: g.name,
      isActive: g.isActive,
      createdAt: g.createdAt.toISOString(),
      memberCount: g._count.members,
      expenseCount: g._count.expenses,
      fundBalance: g.fund ? String(g.fund.balance) : null,
    })),
  })
})

adminRoutes.patch('/groups/:groupId', async (c) => {
  const groupId = c.req.param('groupId')
  let body: unknown
  try {
    body = await c.req.json()
  } catch {
    return c.json({ error: 'Invalid JSON' }, 400)
  }
  const schema = z.object({ isActive: z.boolean() })
  const parsed = schema.safeParse(body)
  if (!parsed.success) {
    return c.json({ error: 'Dữ liệu không hợp lệ' }, 400)
  }
  const g = await prisma.group.update({
    where: { id: groupId },
    data: { isActive: parsed.data.isActive },
  })
  return c.json({ data: { id: g.id, isActive: g.isActive } })
})

adminRoutes.delete('/groups/:groupId', async (c) => {
  const groupId = c.req.param('groupId')
  await prisma.group.delete({ where: { id: groupId } })
  return c.json({ data: { ok: true } })
})

adminRoutes.post('/categories', async (c) => {
  let body: unknown
  try {
    body = await c.req.json()
  } catch {
    return c.json({ error: 'Invalid JSON' }, 400)
  }
  const parsed = categoryBody.safeParse(body)
  if (!parsed.success) {
    return c.json({ error: parsed.error.issues[0]?.message ?? 'Dữ liệu không hợp lệ' }, 400)
  }
  const { name, icon, color, isSystem } = parsed.data
  const cat = await prisma.category.create({
    data: {
      name: name.trim(),
      icon: icon?.trim() || null,
      color: color?.trim() || null,
      isSystem: isSystem ?? false,
    },
  })
  return c.json({
    data: {
      id: cat.id,
      name: cat.name,
      icon: cat.icon,
      color: cat.color,
      isSystem: cat.isSystem,
    },
  })
})

adminRoutes.patch('/categories/:id', async (c) => {
  const id = c.req.param('id')
  let body: unknown
  try {
    body = await c.req.json()
  } catch {
    return c.json({ error: 'Invalid JSON' }, 400)
  }
  const patchSchema = z.object({
    name: z.string().min(1).max(100).optional(),
    icon: z.string().max(120).optional().nullable(),
    color: z.string().max(32).optional().nullable(),
    isSystem: z.boolean().optional(),
  })
  const parsed = patchSchema.safeParse(body)
  if (!parsed.success) {
    return c.json({ error: parsed.error.issues[0]?.message ?? 'Dữ liệu không hợp lệ' }, 400)
  }
  const d = parsed.data
  const cat = await prisma.category.update({
    where: { id },
    data: {
      ...(d.name != null ? { name: d.name.trim() } : {}),
      ...(d.icon !== undefined ? { icon: d.icon?.trim() ?? null } : {}),
      ...(d.color !== undefined ? { color: d.color?.trim() ?? null } : {}),
      ...(d.isSystem !== undefined ? { isSystem: d.isSystem } : {}),
    },
  })
  return c.json({
    data: {
      id: cat.id,
      name: cat.name,
      icon: cat.icon,
      color: cat.color,
      isSystem: cat.isSystem,
    },
  })
})

adminRoutes.delete('/categories/:id', async (c) => {
  const id = c.req.param('id')
  const count = await prisma.expense.count({ where: { categoryId: id } })
  if (count > 0) {
    return c.json({ error: `Không xóa được: ${count} chi tiêu đang dùng danh mục này` }, 400)
  }
  await prisma.category.delete({ where: { id } })
  return c.json({ data: { ok: true } })
})

const listFeedbackQuery = z.object({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
  type: z.enum(['PRAISE', 'ISSUE']).optional(),
  status: z.enum(['NEW', 'IN_PROGRESS', 'RESOLVED', 'ARCHIVED']).optional(),
  search: z.string().max(200).optional(),
})

adminRoutes.get('/feedback', async (c) => {
  const parsed = listFeedbackQuery.safeParse({
    page: c.req.query('page'),
    limit: c.req.query('limit'),
    type: c.req.query('type'),
    status: c.req.query('status'),
    search: c.req.query('search'),
  })
  if (!parsed.success) {
    return c.json({ error: parsed.error.issues[0]?.message ?? 'Query không hợp lệ' }, 400)
  }
  const { page, limit, type, status, search } = parsed.data
  const adminId = c.get('userId')
  const q = search?.trim()
  const where = {
    ...(type ? { type } : {}),
    ...(status ? { status } : {}),
    ...(q
      ? {
          OR: [
            { title: { contains: q, mode: 'insensitive' as const } },
            { body: { contains: q, mode: 'insensitive' as const } },
          ],
        }
      : {}),
  }
  const [total, rows] = await Promise.all([
    prisma.feedback.count({ where }),
    prisma.feedback.findMany({
      where,
      include: {
        user: { select: { id: true, name: true, email: true } },
      },
      orderBy: { createdAt: 'desc' },
      skip: (page - 1) * limit,
      take: limit,
    }),
  ])

  const data = await Promise.all(
    rows.map(async (r) => {
      const resolvedImages: string[] = []
      for (const u of r.imageUrls) {
        const signed = await signedStorageUrlForUser(u, adminId)
        resolvedImages.push(signed ?? u)
      }
      return {
        id: r.id,
        userId: r.userId,
        type: r.type,
        status: r.status,
        rating: r.rating,
        title: r.title,
        body: r.body,
        imageUrls: r.imageUrls,
        resolvedImageUrls: resolvedImages,
        adminNote: r.adminNote,
        createdAt: r.createdAt.toISOString(),
        updatedAt: r.updatedAt.toISOString(),
        user: r.user,
      }
    }),
  )

  return c.json({
    data,
    total,
    page,
    limit,
    totalPages: Math.max(1, Math.ceil(total / limit)),
  })
})

adminRoutes.patch('/feedback/:id', async (c) => {
  const id = c.req.param('id')
  let body: unknown
  try {
    body = await c.req.json()
  } catch {
    return c.json({ error: 'Invalid JSON' }, 400)
  }
  const parsed = patchAdminFeedbackSchema.safeParse(body)
  if (!parsed.success) {
    return c.json({ error: parsed.error.issues[0]?.message ?? 'Dữ liệu không hợp lệ' }, 400)
  }
  const d = parsed.data
  if (d.status === undefined && d.adminNote === undefined) {
    return c.json({ error: 'Không có dữ liệu cập nhật' }, 400)
  }
  const existing = await prisma.feedback.findUnique({ where: { id }, select: { id: true } })
  if (!existing) return c.json({ error: 'Không tìm thấy phản hồi' }, 404)
  const row = await prisma.feedback.update({
    where: { id },
    data: {
      ...(d.status !== undefined ? { status: d.status } : {}),
      ...(d.adminNote !== undefined ? { adminNote: d.adminNote?.trim() || null } : {}),
    },
    include: {
      user: { select: { id: true, name: true, email: true } },
    },
  })
  const adminId = c.get('userId')
  const resolvedImages: string[] = []
  for (const u of row.imageUrls) {
    const signed = await signedStorageUrlForUser(u, adminId)
    resolvedImages.push(signed ?? u)
  }
  return c.json({
    data: {
      id: row.id,
      userId: row.userId,
      type: row.type,
      status: row.status,
      rating: row.rating,
      title: row.title,
      body: row.body,
      imageUrls: row.imageUrls,
      resolvedImageUrls: resolvedImages,
      adminNote: row.adminNote,
      createdAt: row.createdAt.toISOString(),
      updatedAt: row.updatedAt.toISOString(),
      user: row.user,
    },
  })
})

adminRoutes.get('/audit', async (c) => {
  const page = Number(c.req.query('page') ?? '1') || 1
  const limit = Math.min(100, Number(c.req.query('limit') ?? '20') || 20)
  const userId = c.req.query('userId') ?? undefined
  const groupId = c.req.query('groupId') ?? undefined
  const action = c.req.query('action') ?? undefined
  const where = {
    ...(userId ? { userId } : {}),
    ...(groupId ? { groupId } : {}),
    ...(action ? { action: { contains: action, mode: 'insensitive' as const } } : {}),
  }
  const [total, rows] = await Promise.all([
    prisma.auditLog.count({ where }),
    prisma.auditLog.findMany({
      where,
      include: {
        user: { select: { id: true, name: true, email: true } },
        group: { select: { id: true, name: true } },
      },
      orderBy: { createdAt: 'desc' },
      skip: (page - 1) * limit,
      take: limit,
    }),
  ])
  return c.json({
    data: rows.map((r) => ({
      id: r.id,
      userId: r.userId,
      groupId: r.groupId,
      expenseId: r.expenseId,
      action: r.action,
      before: r.before,
      after: r.after,
      ipAddress: r.ipAddress,
      createdAt: r.createdAt.toISOString(),
      user: r.user,
      group: r.group,
    })),
    total,
    page,
    limit,
    totalPages: Math.max(1, Math.ceil(total / limit)),
  })
})

/** Xóa log hoạt động nhóm (giảm dung lượng). Mặc định xóa toàn bộ log của nhóm; có `before` thì chỉ bản ghi cũ hơn mốc ISO. */
adminRoutes.delete('/groups/:groupId/activity-logs', async (c) => {
  const groupId = c.req.param('groupId')
  const beforeRaw = c.req.query('before')
  const g = await prisma.group.findUnique({ where: { id: groupId }, select: { id: true } })
  if (!g) return c.json({ error: 'Không tìm thấy nhóm' }, 404)
  const where =
    beforeRaw != null && beforeRaw !== ''
      ? { groupId, createdAt: { lt: new Date(beforeRaw) } }
      : { groupId }
  const del = await prisma.groupActivityLog.deleteMany({ where })
  return c.json({ data: { ok: true, deleted: del.count } })
})

/** Lịch sử các đợt thông báo hệ thống đã gửi (gom theo broadcastId). */
adminRoutes.get('/broadcasts', async (c) => {
  const rows = await prisma.$queryRaw<
    Array<{
      broadcastId: string
      title: string
      body: string
      sentAt: Date
      recipientCount: number
    }>
  >(Prisma.sql`
    SELECT "broadcastId", MAX(title) AS title, MAX(body) AS body, MAX("createdAt") AS "sentAt", COUNT(*)::int AS "recipientCount"
    FROM "Notification"
    WHERE type = 'SYSTEM_ANNOUNCEMENT'::"NotificationType" AND "broadcastId" IS NOT NULL
    GROUP BY "broadcastId"
    ORDER BY MAX("createdAt") DESC
  `)
  const data: AdminBroadcastHistoryItemDto[] = rows.map((r) => ({
    broadcastId: r.broadcastId,
    title: r.title,
    body: r.body,
    sentAt: r.sentAt.toISOString(),
    recipientCount: Number(r.recipientCount),
  }))
  return c.json({ data })
})

/** Danh sách người nhận của một đợt (mở rộng dòng bảng lịch sử). */
adminRoutes.get('/broadcasts/:broadcastId/recipients', async (c) => {
  const broadcastId = c.req.param('broadcastId')?.trim()
  if (!broadcastId) {
    return c.json({ error: 'Thiếu mã đợt gửi' }, 400)
  }
  const MAX = 5000
  const where = { broadcastId, type: 'SYSTEM_ANNOUNCEMENT' as const }
  const [rows, total] = await Promise.all([
    prisma.notification.findMany({
      where,
      select: {
        user: { select: { id: true, name: true, email: true } },
      },
      orderBy: { user: { name: 'asc' } },
      take: MAX,
    }),
    prisma.notification.count({ where }),
  ])
  const data: AdminBroadcastRecipientDto[] = rows.map((r) => ({
    userId: r.user.id,
    name: r.user.name,
    email: r.user.email,
  }))
  return c.json({
    data,
    total,
    truncated: total > data.length,
  })
})

/** Xóa toàn bộ thông báo của một đợt gửi (khỏi hộp thư mọi user). */
adminRoutes.delete('/broadcasts/:broadcastId', async (c) => {
  const broadcastId = c.req.param('broadcastId')?.trim()
  if (!broadcastId) {
    return c.json({ error: 'Thiếu mã đợt gửi' }, 400)
  }
  const del = await prisma.notification.deleteMany({
    where: { broadcastId, type: 'SYSTEM_ANNOUNCEMENT' },
  })
  return c.json({ data: { deleted: del.count } })
})

/** Gửi thông báo hệ thống: một bản ghi Notification / user (toast + hộp thư). */
adminRoutes.post('/broadcast', async (c) => {
  let raw: unknown
  try {
    raw = await c.req.json()
  } catch {
    return c.json({ error: 'Invalid JSON' }, 400)
  }
  const parsed = adminBroadcastSchema.safeParse(raw)
  if (!parsed.success) {
    return c.json({ error: parsed.error.issues[0]?.message ?? 'Dữ liệu không hợp lệ' }, 400)
  }
  const { title, body: bodyText, excludeUserIds } = parsed.data
  const senderId = c.get('userId')
  const excludeUnique: string[] = [...new Set([senderId, ...excludeUserIds])]

  const users = await prisma.user.findMany({
    where: {
      isActive: true,
      id: { notIn: excludeUnique },
    },
    select: { id: true },
  })

  const broadcastId = randomUUID()
  const titleT = title.trim()
  const bodyT = bodyText.trim()

  const chunk = 300
  for (let i = 0; i < users.length; i += chunk) {
    const slice = users.slice(i, i + chunk)
    await prisma.notification.createMany({
      data: slice.map((u) => ({
        userId: u.id,
        type: 'SYSTEM_ANNOUNCEMENT' as const,
        title: titleT,
        body: bodyT,
        broadcastId,
        data: { kind: 'admin_broadcast' },
      })),
    })
  }

  emitSystemBroadcastToUsers(
    users.map((u) => u.id),
    { broadcastId, title: titleT, body: bodyT },
  )

  return c.json({
    data: {
      broadcastId,
      sent: users.length,
    },
  })
})