import { Prisma, prisma } from '@expense/database'
import type { GroupMember } from '@expense/database'
import {
  acceptPaymentSchema,
  addCommentSchema,
  confirmPaymentSchema,
  createExpenseSchema,
  expenseFilterSchema,
  updateExpenseSchema,
} from '@expense/types'
import type {
  CommentDto,
  ExpenseDto,
  ExpenseHistoryEntryDto,
  PaginatedResponse,
  PaymentRecordDto,
} from '@expense/types'
import { Hono } from 'hono'
import { formatVndForSummary } from '../lib/format-vnd.js'
import { actorSnapshot, writeGroupActivityLog } from '../lib/group-activity-log.js'
import { findGroupLeaderIncludingFormer, runGroupSubresourceGate } from '../lib/group-gate.js'
import { signedStorageUrlForUser } from '../lib/minio.js'
import { clientIp } from '../lib/requestMeta.js'
import { requireAuth } from '../middleware/auth.js'

const activeMemberWhere = { isActive: true, leftAt: null } as const

function legacyAuditSummary(l: { action: string; user: { name: string } }): string {
  const map: Record<string, string> = {
    EXPENSE_CREATED: 'tạo chi tiêu (bản ghi audit cũ)',
    EXPENSE_UPDATED: 'cập nhật chi tiêu (bản ghi audit cũ)',
  }
  return `${l.user.name} — ${map[l.action] ?? l.action}`
}

function standaloneAttentionForViewer(
  expense: {
    isStandalone: boolean
    status: string
    deletedAt?: Date | null
    standalonePayment: {
      paymentRecords: { payerUserId: string; receiverUserId: string; status: string }[]
    } | null
  },
  viewerUserId: string,
  memberRole: string,
): boolean {
  if (expense.deletedAt) return false
  if (!expense.isStandalone || expense.status === 'STANDALONE_DONE') return false
  const recs = expense.standalonePayment?.paymentRecords ?? []
  if (recs.length === 0) return false
  const isLeader = memberRole === 'LEADER'
  for (const r of recs) {
    if (r.payerUserId === viewerUserId && r.status !== 'ACCEPTED') return true
    if (r.receiverUserId === viewerUserId && r.status === 'CONFIRMED') return true
    if (isLeader && r.status === 'CONFIRMED') return true
  }
  return false
}

function toExpenseDto(
  e: {
    id: string
    groupId: string
    title: string
    description: string | null
    amount: Prisma.Decimal
    currency: string
    splitType: string
    status: string
    isStandalone: boolean
    settlementId: string | null
    expenseDate: Date
    tags: string[]
    imageUrls: string[]
    createdAt: Date
    deletedAt?: Date | null
    deletedBy?: { id: string; name: string; avatarUrl: string | null } | null
    category: { id: string; name: string; icon: string | null; color: string | null } | null
    paidBy: { id: string; name: string; avatarUrl: string | null }
    splits: Array<{
      userId: string
      amount: Prisma.Decimal
      percentage: Prisma.Decimal | null
      isExcluded: boolean
      user: { id: string; name: string; avatarUrl: string | null }
    }>
    _count?: { comments: number }
  },
  extra?: { createdBy?: { id: string; name: string; avatarUrl: string | null } | null },
): ExpenseDto {
  return {
    id: e.id,
    groupId: e.groupId,
    title: e.title,
    description: e.description,
    amount: String(e.amount),
    currency: e.currency,
    splitType: e.splitType,
    status: e.status,
    isStandalone: e.isStandalone,
    settlementId: e.settlementId,
    expenseDate: e.expenseDate.toISOString(),
    tags: e.tags,
    imageUrls: e.imageUrls,
    category: e.category
      ? {
          id: e.category.id,
          name: e.category.name,
          icon: e.category.icon,
          color: e.category.color,
        }
      : null,
    paidBy: {
      id: e.paidBy.id,
      name: e.paidBy.name,
      avatarUrl: e.paidBy.avatarUrl,
    },
    createdBy: extra?.createdBy
      ? {
          id: extra.createdBy.id,
          name: extra.createdBy.name,
          avatarUrl: extra.createdBy.avatarUrl,
        }
      : null,
    splits: e.splits.map((s) => ({
      userId: s.userId,
      amount: String(s.amount),
      percentage: s.percentage != null ? String(s.percentage) : null,
      isExcluded: s.isExcluded,
      user: {
        id: s.user.id,
        name: s.user.name,
        avatarUrl: s.user.avatarUrl,
      },
    })),
    commentCount: e._count?.comments ?? 0,
    createdAt: e.createdAt.toISOString(),
    deletedAt: e.deletedAt ? e.deletedAt.toISOString() : null,
    deletedBy: e.deletedBy
      ? {
          id: e.deletedBy.id,
          name: e.deletedBy.name,
          avatarUrl: e.deletedBy.avatarUrl,
        }
      : null,
  }
}

/** Presign MinIO avatar URLs for the client (same as group members list). */
async function toExpenseDtoWithSignedAvatars(
  e: Parameters<typeof toExpenseDto>[0],
  viewerUserId: string,
  extra?: Parameters<typeof toExpenseDto>[1],
): Promise<ExpenseDto> {
  const dto = toExpenseDto(e, extra)
  const paidByUrl = await signedStorageUrlForUser(e.paidBy.avatarUrl, viewerUserId)
  const splitUrls = await Promise.all(
    e.splits.map((s) => signedStorageUrlForUser(s.user.avatarUrl, viewerUserId)),
  )
  let createdByOut = dto.createdBy
  if (dto.createdBy != null && extra?.createdBy != null) {
    const url = await signedStorageUrlForUser(extra.createdBy.avatarUrl, viewerUserId)
    createdByOut = { ...dto.createdBy, avatarUrl: url }
  }
  let deletedByOut: NonNullable<ExpenseDto['deletedBy']> | null = dto.deletedBy ?? null
  if (dto.deletedBy != null && e.deletedBy != null) {
    const url = await signedStorageUrlForUser(e.deletedBy.avatarUrl, viewerUserId)
    deletedByOut = { ...dto.deletedBy, avatarUrl: url }
  }
  return {
    ...dto,
    paidBy: { ...dto.paidBy, avatarUrl: paidByUrl },
    createdBy: createdByOut,
    deletedBy: deletedByOut,
    splits: dto.splits.map((s, i) => ({
      ...s,
      user: { ...s.user, avatarUrl: splitUrls[i] ?? null },
    })),
  }
}

function toCommentDto(c: {
  id: string
  content: string
  imageUrls: string[]
  isEdited: boolean
  createdAt: Date
  user: { id: string; name: string; avatarUrl: string | null }
}): CommentDto {
  return {
    id: c.id,
    content: c.content,
    imageUrls: c.imageUrls,
    isEdited: c.isEdited,
    createdAt: c.createdAt.toISOString(),
    user: { id: c.user.id, name: c.user.name, avatarUrl: c.user.avatarUrl },
  }
}

async function toCommentDtoSigned(
  row: Parameters<typeof toCommentDto>[0],
  viewerUserId: string,
): Promise<CommentDto> {
  const dto = toCommentDto(row)
  const url = await signedStorageUrlForUser(row.user.avatarUrl, viewerUserId)
  return { ...dto, user: { ...dto.user, avatarUrl: url } }
}

function toPaymentRecordDto(r: {
  id: string
  payerUserId: string
  receiverUserId: string
  amount: Prisma.Decimal
  status: string
  proofImageUrls: string[]
  payerComment: string | null
  leaderComment: string | null
  confirmedAt: Date | null
  acceptedAt: Date | null
  rejectedAt: Date | null
  payer: { id: string; name: string; avatarUrl: string | null }
  receiver: { id: string; name: string; avatarUrl: string | null }
}): PaymentRecordDto {
  return {
    id: r.id,
    payerUserId: r.payerUserId,
    receiverUserId: r.receiverUserId,
    amount: String(r.amount),
    status: r.status,
    proofImageUrls: r.proofImageUrls,
    payerComment: r.payerComment,
    leaderComment: r.leaderComment,
    confirmedAt: r.confirmedAt?.toISOString() ?? null,
    acceptedAt: r.acceptedAt?.toISOString() ?? null,
    rejectedAt: r.rejectedAt?.toISOString() ?? null,
    payer: { id: r.payer.id, name: r.payer.name, avatarUrl: r.payer.avatarUrl },
    receiver: { id: r.receiver.id, name: r.receiver.name, avatarUrl: r.receiver.avatarUrl },
  }
}

async function toPaymentRecordDtoSigned(
  r: Parameters<typeof toPaymentRecordDto>[0],
  viewerUserId: string,
) {
  const dto = toPaymentRecordDto(r)
  const [payerAv, recvAv] = await Promise.all([
    signedStorageUrlForUser(r.payer.avatarUrl, viewerUserId),
    signedStorageUrlForUser(r.receiver.avatarUrl, viewerUserId),
  ])
  return {
    ...dto,
    payer: { ...dto.payer, avatarUrl: payerAv },
    receiver: { ...dto.receiver, avatarUrl: recvAv },
  }
}

export const groupExpenseRoutes = new Hono<{
  Variables: {
    userId: string
    userRole: string
    sessionJti: string
    groupId: string
    groupMember: GroupMember | null
    groupMemberIsFormer: boolean
    adminGroupBrowse: boolean
  }
}>()

groupExpenseRoutes.use('*', requireAuth)
groupExpenseRoutes.use('*', async (c, next) => {
  const gid = c.req.param('groupId')
  if (!gid) return c.json({ error: 'Thiếu nhóm' }, 400)
  c.set('groupId', gid)
  const blocked = await runGroupSubresourceGate(c, gid)
  if (blocked) return blocked
  await next()
})

groupExpenseRoutes.get('/', async (c) => {
  const userId = c.get('userId')
  const groupId = c.get('groupId')
  const m = c.get('groupMember')
  const adminBrowse = c.get('adminGroupBrowse')
  if (!m && !adminBrowse) return c.json({ error: 'Không tìm thấy nhóm' }, 404)
  const memberRole = m?.role ?? 'MEMBER'

  const q = expenseFilterSchema.safeParse(Object.fromEntries(new URL(c.req.url).searchParams))
  if (!q.success) {
    return c.json({ error: q.error.issues[0]?.message ?? 'Query không hợp lệ' }, 400)
  }
  const {
    page,
    limit,
    dateFrom,
    dateTo,
    categoryId,
    paidByUserId,
    status,
    isStandalone,
    standaloneIncomplete,
    settlementId: filterSettlementId,
    includeDeleted,
    deletedOnly,
  } = q.data
  const where: Prisma.ExpenseWhereInput = { groupId }
  const canListDeleted = Boolean(includeDeleted) && (Boolean(m) || adminBrowse)
  if (!canListDeleted) {
    where.deletedAt = null
  } else if (deletedOnly) {
    where.deletedAt = { not: null }
  }
  const dateFilter: Prisma.DateTimeFilter = {}
  if (dateFrom) dateFilter.gte = new Date(dateFrom)
  if (dateTo) dateFilter.lte = new Date(dateTo)
  if (Object.keys(dateFilter).length) where.expenseDate = dateFilter
  if (categoryId) where.categoryId = categoryId
  if (paidByUserId) where.paidByUserId = paidByUserId
  if (status) where.status = status as 'ACTIVE' | 'SETTLED' | 'STANDALONE_DONE'
  if (isStandalone !== undefined) where.isStandalone = isStandalone
  if (filterSettlementId) where.settlementId = filterSettlementId
  if (standaloneIncomplete) {
    where.isStandalone = true
    where.status = { not: 'STANDALONE_DONE' }
  }

  const [total, rows] = await Promise.all([
    prisma.expense.count({ where }),
    prisma.expense.findMany({
      where,
      orderBy: { expenseDate: 'desc' },
      skip: (page - 1) * limit,
      take: limit,
      include: {
        splits: { include: { user: { select: { id: true, name: true, avatarUrl: true } } } },
        category: true,
        paidBy: { select: { id: true, name: true, avatarUrl: true } },
        deletedBy: { select: { id: true, name: true, avatarUrl: true } },
        _count: { select: { comments: true } },
        standalonePayment: {
          select: {
            paymentRecords: {
              select: { payerUserId: true, receiverUserId: true, status: true },
            },
          },
        },
      },
    }),
  ])

  const data: PaginatedResponse<ExpenseDto> = {
    data: await Promise.all(
      rows.map(async (r) => ({
        ...(await toExpenseDtoWithSignedAvatars(r, userId)),
        standaloneAttention: standaloneAttentionForViewer(r, userId, memberRole),
      })),
    ),
    total,
    page,
    limit,
    totalPages: Math.max(1, Math.ceil(total / limit)),
  }
  return c.json({ data })
})

groupExpenseRoutes.post('/', async (c) => {
  const userId = c.get('userId')
  const groupId = c.get('groupId')
  const m = c.get('groupMember')
  if (!m) return c.json({ error: 'Không tìm thấy nhóm' }, 404)

  let body: unknown
  try {
    body = await c.req.json()
  } catch {
    return c.json({ error: 'Invalid JSON' }, 400)
  }
  const parsed = createExpenseSchema.safeParse(body)
  if (!parsed.success) {
    return c.json({ error: parsed.error.issues[0]?.message ?? 'Dữ liệu không hợp lệ' }, 400)
  }
  const d = parsed.data

  const members = await prisma.groupMember.findMany({
    where: { groupId, ...activeMemberWhere },
    select: { userId: true },
  })
  const memberIds = new Set(members.map((x) => x.userId))
  const paidByUserId = d.paidByUserId ?? userId
  if (!memberIds.has(paidByUserId)) {
    return c.json({ error: 'Người trả tiền phải là thành viên đang hoạt động trong nhóm' }, 400)
  }

  const total = new Prisma.Decimal(d.amount)
  let splitRows: {
    userId: string
    amount: Prisma.Decimal
    percentage: Prisma.Decimal | null
    isExcluded: boolean
  }[]

  if (d.splitType === 'EQUAL') {
    const splitsIn = d.splits?.length
      ? d.splits
      : members.map((mem) => ({ userId: mem.userId, isExcluded: false }))
    const active = splitsIn.filter((s) => !s.isExcluded)
    if (!active.length) return c.json({ error: 'Cần ít nhất một thành viên chia' }, 400)
    const n = active.length
    const each = total.div(n)
    let given = new Prisma.Decimal(0)
    let activeIndex = 0
    splitRows = splitsIn.map((s) => {
      if (s.isExcluded) {
        return {
          userId: s.userId,
          amount: new Prisma.Decimal(0),
          percentage: null,
          isExcluded: true,
        }
      }
      activeIndex++
      const isLast = activeIndex === n
      const amt = isLast ? total.sub(given) : each
      given = given.add(amt)
      return { userId: s.userId, amount: amt, percentage: null, isExcluded: false }
    })
  } else if (d.splitType === 'UNEQUAL') {
    if (!d.splits?.length) return c.json({ error: 'Cần phần chia' }, 400)
    splitRows = d.splits.map((s) => ({
      userId: s.userId,
      amount: new Prisma.Decimal(s.amount ?? 0),
      percentage: null,
      isExcluded: Boolean(s.isExcluded),
    }))
    const sum = splitRows
      .filter((s) => !s.isExcluded)
      .reduce((a, s) => a.add(s.amount), new Prisma.Decimal(0))
    if (sum.sub(total).abs().gt(new Prisma.Decimal(0.01))) {
      return c.json({ error: 'Tổng phần chia phải bằng số tiền' }, 400)
    }
  } else {
    if (!d.splits?.length) return c.json({ error: 'Cần phần chia' }, 400)
    splitRows = d.splits.map((s) => ({
      userId: s.userId,
      amount: total.mul(new Prisma.Decimal((s.percentage ?? 0) / 100)),
      percentage: new Prisma.Decimal(s.percentage ?? 0),
      isExcluded: Boolean(s.isExcluded),
    }))
    const sum = splitRows
      .filter((s) => !s.isExcluded)
      .reduce((a, s) => a.add(s.amount), new Prisma.Decimal(0))
    if (sum.sub(total).abs().gt(new Prisma.Decimal(0.01))) {
      return c.json({ error: 'Tổng phần trăm phải đạt 100%' }, 400)
    }
  }

  for (const s of splitRows) {
    if (!memberIds.has(s.userId)) return c.json({ error: 'userId không thuộc nhóm' }, 400)
  }

  const expenseIdCreated = await prisma.$transaction(async (tx) => {
    const ex = await tx.expense.create({
      data: {
        groupId,
        ...(d.categoryId != null ? { categoryId: d.categoryId } : {}),
        paidByUserId,
        title: d.title.trim(),
        description: d.description?.trim() ?? null,
        amount: total,
        currency: 'VND',
        splitType: d.splitType,
        status: 'ACTIVE',
        isStandalone: d.isStandalone,
        expenseDate: new Date(d.expenseDate),
        tags: d.tags,
        imageUrls: d.imageUrls,
        splits: {
          create: splitRows.map((s) => ({
            userId: s.userId,
            amount: s.amount,
            percentage: s.percentage,
            isExcluded: s.isExcluded,
          })),
        },
      },
      include: {
        splits: { include: { user: { select: { id: true, name: true, avatarUrl: true } } } },
        category: true,
        paidBy: { select: { id: true, name: true, avatarUrl: true } },
        _count: { select: { comments: true } },
      },
    })

    if (d.isStandalone) {
      const records = splitRows
        .filter((s) => !s.isExcluded && s.userId !== paidByUserId && s.amount.gt(0))
        .map((s) => ({
          payerUserId: s.userId,
          receiverUserId: paidByUserId,
          amount: s.amount,
          status: 'PENDING' as const,
        }))
      await tx.standalonePayment.create({
        data: {
          expenseId: ex.id,
          paymentRecords: { create: records },
        },
      })
    }

    if (d.recurringDays) {
      const next = new Date()
      next.setDate(next.getDate() + d.recurringDays)
      await tx.recurringExpense.create({
        data: { expenseId: ex.id, intervalDays: d.recurringDays, nextRunAt: next },
      })
    }

    await tx.auditLog.create({
      data: {
        userId,
        groupId,
        expenseId: ex.id,
        action: 'EXPENSE_CREATED',
        after: {
          title: ex.title,
          amount: String(ex.amount),
          status: ex.status,
          isStandalone: ex.isStandalone,
        },
        ipAddress: clientIp(c) || null,
      },
    })

    const act = await tx.user.findUnique({
      where: { id: userId },
      select: { name: true, email: true },
    })
    await writeGroupActivityLog(tx, {
      groupId,
      actorUserId: userId,
      actorName: act?.name ?? '',
      actorEmail: act?.email ?? '',
      action: 'EXPENSE_CREATED',
      summary: `${act?.name ?? '?'} (${act?.email ?? ''}) tạo chi ${d.isStandalone ? 'riêng' : 'chung'} «${ex.title}» — ${formatVndForSummary(ex.amount)}`,
      targetType: 'EXPENSE',
      targetId: ex.id,
      metadata: { isStandalone: d.isStandalone, title: ex.title, amount: String(ex.amount) },
    })

    return ex.id
  })

  const full = await prisma.expense.findFirstOrThrow({
    where: { id: expenseIdCreated, groupId },
    include: {
      splits: { include: { user: { select: { id: true, name: true, avatarUrl: true } } } },
      category: true,
      paidBy: { select: { id: true, name: true, avatarUrl: true } },
      _count: { select: { comments: true } },
    },
  })
  return c.json({ data: await toExpenseDtoWithSignedAvatars(full, userId) })
})

groupExpenseRoutes.get('/:expenseId/comments', async (c) => {
  const userId = c.get('userId')
  const groupId = c.get('groupId')
  const expenseId = c.req.param('expenseId')
  const m = c.get('groupMember')
  if (!m) return c.json({ error: 'Không tìm thấy nhóm' }, 404)

  const ex = await prisma.expense.findFirst({ where: { id: expenseId, groupId, deletedAt: null } })
  if (!ex) return c.json({ error: 'Không tìm thấy' }, 404)

  const list = await prisma.comment.findMany({
    where: { expenseId },
    include: { user: { select: { id: true, name: true, avatarUrl: true } } },
    orderBy: { createdAt: 'asc' },
  })
  return c.json({ data: await Promise.all(list.map((row) => toCommentDtoSigned(row, userId))) })
})

groupExpenseRoutes.post('/:expenseId/comments', async (c) => {
  const userId = c.get('userId')
  const groupId = c.get('groupId')
  const expenseId = c.req.param('expenseId')
  const m = c.get('groupMember')
  if (!m) return c.json({ error: 'Không tìm thấy nhóm' }, 404)

  const ex = await prisma.expense.findFirst({ where: { id: expenseId, groupId, deletedAt: null } })
  if (!ex) return c.json({ error: 'Không tìm thấy' }, 404)

  let body: unknown
  try {
    body = await c.req.json()
  } catch {
    return c.json({ error: 'Invalid JSON' }, 400)
  }
  const parsed = addCommentSchema.safeParse(body)
  if (!parsed.success) {
    return c.json({ error: parsed.error.issues[0]?.message ?? 'Dữ liệu không hợp lệ' }, 400)
  }

  const com = await prisma.comment.create({
    data: {
      expenseId,
      userId,
      content: parsed.data.content.trim(),
      imageUrls: parsed.data.imageUrls,
    },
    include: { user: { select: { id: true, name: true, avatarUrl: true } } },
  })
  return c.json({ data: await toCommentDtoSigned(com, userId) })
})

groupExpenseRoutes.delete('/:expenseId/comments/:commentId', async (c) => {
  const userId = c.get('userId')
  const groupId = c.get('groupId')
  const expenseId = c.req.param('expenseId')
  const commentId = c.req.param('commentId')
  const m = c.get('groupMember')
  if (!m) return c.json({ error: 'Không tìm thấy nhóm' }, 404)

  const com = await prisma.comment.findFirst({ where: { id: commentId, expenseId } })
  if (!com) return c.json({ error: 'Không tìm thấy' }, 404)
  if (com.userId !== userId) return c.json({ error: 'Chỉ xoá được bình luận của chính mình' }, 403)

  await prisma.comment.delete({ where: { id: commentId } })
  return c.json({ data: { ok: true } })
})

groupExpenseRoutes.get('/:expenseId/audit', async (c) => {
  const userId = c.get('userId')
  const groupId = c.get('groupId')
  const expenseId = c.req.param('expenseId')
  const m = c.get('groupMember')
  if (!m) return c.json({ error: 'Không tìm thấy nhóm' }, 404)

  const ex = await prisma.expense.findFirst({ where: { id: expenseId, groupId, deletedAt: null } })
  if (!ex) return c.json({ error: 'Không tìm thấy' }, 404)

  const [activities, audits] = await Promise.all([
    prisma.groupActivityLog.findMany({
      where: { groupId, targetType: 'EXPENSE', targetId: expenseId },
      orderBy: { createdAt: 'desc' },
    }),
    prisma.auditLog.findMany({
      where: { expenseId },
      include: { user: { select: { id: true, name: true } } },
      orderBy: { createdAt: 'desc' },
    }),
  ])

  const fromActivity: ExpenseHistoryEntryDto[] = activities.map((r) => ({
    id: r.id,
    source: 'group_activity',
    action: r.action,
    summary: r.summary,
    actorName: r.actorName,
    actorEmail: r.actorEmail,
    actorUserId: r.actorUserId,
    createdAt: r.createdAt.toISOString(),
  }))
  const legacy: ExpenseHistoryEntryDto[] = audits.map((l) => ({
    id: `audit-${l.id}`,
    source: 'audit_legacy',
    action: l.action,
    summary: legacyAuditSummary(l),
    actorName: l.user.name,
    actorEmail: '',
    actorUserId: l.user.id,
    createdAt: l.createdAt.toISOString(),
  }))
  const data = [...fromActivity, ...legacy].sort((a, b) => (a.createdAt < b.createdAt ? 1 : -1))
  return c.json({ data })
})

groupExpenseRoutes.get('/:expenseId/standalone', async (c) => {
  const userId = c.get('userId')
  const groupId = c.get('groupId')
  const expenseId = c.req.param('expenseId')
  const m = c.get('groupMember')
  if (!m) return c.json({ error: 'Không tìm thấy nhóm' }, 404)

  const ex = await prisma.expense.findFirst({
    where: { id: expenseId, groupId, isStandalone: true, deletedAt: null },
    include: {
      splits: { include: { user: { select: { id: true, name: true, avatarUrl: true } } } },
      category: true,
      paidBy: { select: { id: true, name: true, avatarUrl: true } },
      _count: { select: { comments: true } },
      standalonePayment: {
        include: {
          paymentRecords: {
            include: {
              payer: { select: { id: true, name: true, avatarUrl: true } },
              receiver: { select: { id: true, name: true, avatarUrl: true } },
            },
          },
        },
      },
    },
  })
  if (!ex?.standalonePayment) return c.json({ error: 'Không phải chi riêng' }, 404)

  const records = await Promise.all(
    ex.standalonePayment.paymentRecords.map((rec) => toPaymentRecordDtoSigned(rec, userId)),
  )
  const allAccepted = records.length > 0 && records.every((r) => r.status === 'ACCEPTED')
  return c.json({
    data: {
      expense: await toExpenseDtoWithSignedAvatars(ex, userId),
      records,
      standaloneStatus: ex.standalonePayment.status,
      allAccepted,
    },
  })
})

groupExpenseRoutes.post('/:expenseId/standalone/payments/:paymentRecordId/confirm', async (c) => {
  const userId = c.get('userId')
  const groupId = c.get('groupId')
  const expenseId = c.req.param('expenseId')
  const paymentRecordId = c.req.param('paymentRecordId')
  const m = c.get('groupMember')
  if (!m) return c.json({ error: 'Không tìm thấy nhóm' }, 404)

  let body: unknown
  try {
    body = await c.req.json()
  } catch {
    return c.json({ error: 'Invalid JSON' }, 400)
  }
  const parsed = confirmPaymentSchema.safeParse(body)
  if (!parsed.success) {
    return c.json({ error: parsed.error.issues[0]?.message ?? 'Dữ liệu không hợp lệ' }, 400)
  }

  const rec = await prisma.paymentRecord.findFirst({
    where: { id: paymentRecordId, standalonePayment: { expenseId } },
  })
  if (!rec) return c.json({ error: 'Không tìm thấy' }, 404)
  if (rec.payerUserId !== userId) return c.json({ error: 'Chỉ người trả mới xác nhận được' }, 403)
  if (rec.status !== 'PENDING') return c.json({ error: 'Trạng thái không hợp lệ' }, 400)

  await prisma.paymentRecord.update({
    where: { id: paymentRecordId },
    data: {
      status: 'CONFIRMED',
      proofImageUrls: parsed.data.proofImageUrls,
      payerComment: parsed.data.comment ?? null,
      confirmedAt: new Date(),
      leaderComment: null,
      rejectedAt: null,
    },
  })
  return c.json({ data: { ok: true } })
})

groupExpenseRoutes.post(
  '/:expenseId/standalone/payments/:paymentRecordId/reopen-after-reject',
  async (c) => {
    const userId = c.get('userId')
    const groupId = c.get('groupId')
    const expenseId = c.req.param('expenseId')
    const paymentRecordId = c.req.param('paymentRecordId')
    const m = c.get('groupMember')
    if (!m) return c.json({ error: 'Không tìm thấy nhóm' }, 404)

    const rec = await prisma.paymentRecord.findFirst({
      where: { id: paymentRecordId, standalonePayment: { expenseId } },
      include: {
        standalonePayment: { include: { expense: { select: { title: true } } } },
        payer: { select: { name: true } },
      },
    })
    if (!rec?.standalonePayment) return c.json({ error: 'Không tìm thấy' }, 404)
    if (rec.status !== 'REJECTED') {
      return c.json({ error: 'Chỉ mở lại khi thanh toán đã bị từ chối' }, 400)
    }

    const leader = await findGroupLeaderIncludingFormer(groupId, userId)
    const isPayer = rec.payerUserId === userId
    if (!leader && !isPayer) return c.json({ error: 'Không có quyền' }, 403)

    await prisma.paymentRecord.update({
      where: { id: rec.id },
      data: {
        status: 'PENDING',
        proofImageUrls: [],
        payerComment: null,
        confirmedAt: null,
        acceptedAt: null,
        rejectedAt: null,
      },
    })

    if (leader && !isPayer) {
      const title = rec.standalonePayment.expense.title
      await prisma.notification.create({
        data: {
          userId: rec.payerUserId,
          type: 'PAYMENT_REQUEST',
          title: 'Yêu cầu thanh toán lại (chi riêng)',
          body: `Trưởng nhóm yêu cầu bạn nộp lại chứng từ cho khoản «${title}».`,
          data: {
            groupId,
            expenseId,
            paymentRecordId: rec.id,
            kind: 'standalone_reopen',
          },
        },
      })
    }

    return c.json({ data: { ok: true } })
  },
)

groupExpenseRoutes.post(
  '/:expenseId/standalone/payments/:paymentRecordId/request-review',
  async (c) => {
    const userId = c.get('userId')
    const groupId = c.get('groupId')
    const expenseId = c.req.param('expenseId')
    const paymentRecordId = c.req.param('paymentRecordId')
    const m = c.get('groupMember')
    if (!m) return c.json({ error: 'Không tìm thấy nhóm' }, 404)

    const rec = await prisma.paymentRecord.findFirst({
      where: { id: paymentRecordId, standalonePayment: { expenseId } },
      include: {
        payer: { select: { name: true } },
        standalonePayment: { include: { expense: { select: { title: true } } } },
      },
    })
    if (!rec?.standalonePayment) return c.json({ error: 'Không tìm thấy' }, 404)
    if (rec.payerUserId !== userId) return c.json({ error: 'Chỉ người trả mới gửi nhắc được' }, 403)
    if (rec.status !== 'CONFIRMED')
      return c.json({ error: 'Chỉ gửi nhắc khi đã nộp chứng từ' }, 400)

    const leaders = await prisma.groupMember.findMany({
      where: { groupId, role: 'LEADER', isActive: true, leftAt: null },
      select: { userId: true },
    })
    const targets = new Set<string>([rec.receiverUserId, ...leaders.map((l) => l.userId)])
    targets.delete(userId)
    if (targets.size === 0) return c.json({ error: 'Không có người nhận thông báo' }, 400)

    const title = 'Nhắc xác nhận thanh toán (chi riêng)'
    const expenseTitle = rec.standalonePayment.expense.title
    const body = `${rec.payer.name} nhờ bạn xem chứng từ và duyệt khoản «${expenseTitle}».`

    const targetList = [...targets]
    await Promise.all(
      targetList.map((uid) =>
        prisma.notification.create({
          data: {
            userId: uid,
            type: 'PAYMENT_REQUEST',
            title,
            body,
            data: {
              groupId,
              expenseId,
              paymentRecordId: rec.id,
              kind: 'standalone',
            },
          },
        }),
      ),
    )

    return c.json({ data: { ok: true, notified: targetList.length } })
  },
)

/** Người nhận / trưởng nhóm nhắc người trả chuyển tiền (khi còn PENDING). */
groupExpenseRoutes.post(
  '/:expenseId/standalone/payments/:paymentRecordId/notify-payer',
  async (c) => {
    const userId = c.get('userId')
    const groupId = c.get('groupId')
    const expenseId = c.req.param('expenseId')
    const paymentRecordId = c.req.param('paymentRecordId')
    const m = c.get('groupMember')
    if (!m) return c.json({ error: 'Không tìm thấy nhóm' }, 404)

    const rec = await prisma.paymentRecord.findFirst({
      where: { id: paymentRecordId, standalonePayment: { expenseId } },
      include: {
        payer: { select: { name: true } },
        receiver: { select: { name: true } },
        standalonePayment: { include: { expense: { select: { title: true } } } },
      },
    })
    if (!rec?.standalonePayment) return c.json({ error: 'Không tìm thấy' }, 404)
    if (rec.status !== 'PENDING') {
      return c.json({ error: 'Chỉ nhắc khi khoản đang chờ người trả xác nhận chuyển tiền' }, 400)
    }

    const isReceiver = rec.receiverUserId === userId
    const isLeader = m.role === 'LEADER'
    if (!isReceiver && !isLeader) {
      return c.json({ error: 'Chỉ người nhận tiền hoặc trưởng nhóm mới gửi nhắc' }, 403)
    }
    if (rec.payerUserId === userId) {
      return c.json({ error: 'Người trả không gửi nhắc cho chính mình' }, 400)
    }

    const expenseTitle = rec.standalonePayment.expense.title
    const who = isLeader && !isReceiver ? 'Trưởng nhóm' : rec.receiver.name
    const body = `${who} nhắc bạn chuyển tiền cho khoản «${expenseTitle}» (chi tiêu riêng).`

    await prisma.notification.create({
      data: {
        userId: rec.payerUserId,
        type: 'PAYMENT_REQUEST',
        title: 'Nhắc chuyển tiền (chi riêng)',
        body,
        data: {
          groupId,
          expenseId,
          paymentRecordId: rec.id,
          kind: 'standalone_pay_reminder',
        },
      },
    })

    return c.json({ data: { ok: true, notified: 1 } })
  },
)

groupExpenseRoutes.post('/:expenseId/standalone/payments/accept', async (c) => {
  const userId = c.get('userId')
  const groupId = c.get('groupId')
  const expenseId = c.req.param('expenseId')

  let body: unknown
  try {
    body = await c.req.json()
  } catch {
    return c.json({ error: 'Invalid JSON' }, 400)
  }
  const parsed = acceptPaymentSchema.safeParse(body)
  if (!parsed.success) {
    return c.json({ error: parsed.error.issues[0]?.message ?? 'Dữ liệu không hợp lệ' }, 400)
  }

  const rec = await prisma.paymentRecord.findFirst({
    where: {
      id: parsed.data.paymentRecordId,
      standalonePayment: { expenseId },
    },
  })
  if (!rec) return c.json({ error: 'Không tìm thấy' }, 404)

  const leader = await findGroupLeaderIncludingFormer(groupId, userId)
  const isReceiver = rec.receiverUserId === userId

  const now = new Date()

  if (rec.status === 'PENDING') {
    if (userId === rec.payerUserId) {
      return c.json(
        {
          error:
            'Người trả vui lòng dùng «Xác nhận đã chuyển» kèm ảnh chứng từ, không dùng xác nhận phía người nhận',
        },
        403,
      )
    }
    if (!leader && !isReceiver) {
      return c.json({ error: 'Chỉ người nhận tiền hoặc trưởng nhóm mới xác nhận được' }, 403)
    }
    if (!parsed.data.accepted) {
      return c.json(
        {
          error:
            'Khi chưa có chứng từ từ người trả, chỉ có thể xác nhận đã nhận tiền (không từ chối ở bước này)',
        },
        400,
      )
    }
    await prisma.paymentRecord.update({
      where: { id: rec.id },
      data: {
        status: 'ACCEPTED',
        leaderComment: parsed.data.comment ?? null,
        acceptedAt: now,
        rejectedAt: null,
      },
    })
  } else if (rec.status === 'CONFIRMED') {
    if (!leader && !isReceiver) {
      return c.json({ error: 'Chỉ người nhận tiền hoặc trưởng nhóm mới xác nhận được' }, 403)
    }
    if (parsed.data.accepted) {
      await prisma.paymentRecord.update({
        where: { id: rec.id },
        data: {
          status: 'ACCEPTED',
          leaderComment: parsed.data.comment ?? null,
          acceptedAt: now,
          rejectedAt: null,
        },
      })
    } else {
      await prisma.paymentRecord.update({
        where: { id: rec.id },
        data: {
          status: 'REJECTED',
          leaderComment: parsed.data.comment ?? null,
          rejectedAt: now,
        },
      })
    }
  } else {
    return c.json({ error: 'Trạng thái thanh toán không hợp lệ' }, 400)
  }

  const sp = await prisma.standalonePayment.findUnique({
    where: { expenseId },
    include: { paymentRecords: true },
  })
  if (sp && sp.paymentRecords.every((p) => p.status === 'ACCEPTED')) {
    await prisma.$transaction([
      prisma.standalonePayment.update({
        where: { id: sp.id },
        data: { status: 'ACCEPTED', completedAt: now },
      }),
      prisma.expense.update({
        where: { id: expenseId },
        data: { status: 'STANDALONE_DONE' },
      }),
    ])
  }

  return c.json({ data: { ok: true } })
})

groupExpenseRoutes.get('/:expenseId', async (c) => {
  const groupId = c.get('groupId')
  const expenseId = c.req.param('expenseId')
  const m = c.get('groupMember')
  if (!m) return c.json({ error: 'Không tìm thấy nhóm' }, 404)

  const [e, creatorLog] = await Promise.all([
    prisma.expense.findFirst({
      where: { id: expenseId, groupId, deletedAt: null },
      include: {
        splits: { include: { user: { select: { id: true, name: true, avatarUrl: true } } } },
        category: true,
        paidBy: { select: { id: true, name: true, avatarUrl: true } },
        _count: { select: { comments: true } },
      },
    }),
    prisma.auditLog.findFirst({
      where: { expenseId, action: 'EXPENSE_CREATED' },
      orderBy: { createdAt: 'asc' },
      include: { user: { select: { id: true, name: true, avatarUrl: true } } },
    }),
  ])
  if (!e) return c.json({ error: 'Không tìm thấy' }, 404)
  const createdBy = creatorLog?.user
    ? {
        id: creatorLog.user.id,
        name: creatorLog.user.name,
        avatarUrl: creatorLog.user.avatarUrl,
      }
    : null
  return c.json({
    data: await toExpenseDtoWithSignedAvatars(
      e,
      c.get('userId'),
      createdBy ? { createdBy } : undefined,
    ),
  })
})

groupExpenseRoutes.patch('/:expenseId', async (c) => {
  const userId = c.get('userId')
  const groupId = c.get('groupId')
  const expenseId = c.req.param('expenseId')
  const m = c.get('groupMember')
  if (!m) return c.json({ error: 'Không tìm thấy nhóm' }, 404)

  const existing = await prisma.expense.findFirst({
    where: { id: expenseId, groupId, deletedAt: null },
    include: { standalonePayment: { include: { paymentRecords: true } } },
  })
  if (!existing) return c.json({ error: 'Không tìm thấy' }, 404)
  if (existing.status === 'SETTLED') return c.json({ error: 'Không sửa được chi đã tổng kết' }, 400)
  if (existing.status === 'STANDALONE_DONE') {
    return c.json({ error: 'Không sửa được chi riêng đã hoàn tất thanh toán' }, 400)
  }

  let body: unknown
  try {
    body = await c.req.json()
  } catch {
    return c.json({ error: 'Invalid JSON' }, 400)
  }
  const parsed = updateExpenseSchema.safeParse(body)
  if (!parsed.success) {
    return c.json({ error: parsed.error.issues[0]?.message ?? 'Dữ liệu không hợp lệ' }, 400)
  }
  const d = parsed.data

  // Build split rows if splits/splitType provided
  let splitRows:
    | {
        userId: string
        amount: Prisma.Decimal
        percentage: Prisma.Decimal | null
        isExcluded: boolean
      }[]
    | null = null
  if (d.splits?.length && d.splitType) {
    const total = new Prisma.Decimal(d.amount ?? existing.amount)
    const splitType = d.splitType
    if (splitType === 'EQUAL') {
      const active = d.splits.filter((s) => !s.isExcluded)
      if (!active.length) return c.json({ error: 'Cần ít nhất một thành viên chia' }, 400)
      const n = active.length
      const each = total.div(n)
      let given = new Prisma.Decimal(0)
      let activeIndex = 0
      splitRows = d.splits.map((s) => {
        if (s.isExcluded)
          return {
            userId: s.userId,
            amount: new Prisma.Decimal(0),
            percentage: null,
            isExcluded: true,
          }
        activeIndex++
        const isLast = activeIndex === n
        const amt = isLast ? total.sub(given) : each
        given = given.add(amt)
        return { userId: s.userId, amount: amt, percentage: null, isExcluded: false }
      })
    } else if (splitType === 'UNEQUAL') {
      splitRows = d.splits.map((s) => ({
        userId: s.userId,
        amount: new Prisma.Decimal(s.amount ?? 0),
        percentage: null,
        isExcluded: Boolean(s.isExcluded),
      }))
      const sum = splitRows
        .filter((s) => !s.isExcluded)
        .reduce((a, s) => a.add(s.amount), new Prisma.Decimal(0))
      if (sum.sub(total).abs().gt(new Prisma.Decimal(0.01))) {
        return c.json({ error: 'Tổng phần chia phải bằng số tiền' }, 400)
      }
    } else {
      splitRows = d.splits.map((s) => ({
        userId: s.userId,
        amount: total.mul(new Prisma.Decimal((s.percentage ?? 0) / 100)),
        percentage: new Prisma.Decimal(s.percentage ?? 0),
        isExcluded: Boolean(s.isExcluded),
      }))
      const sum = splitRows
        .filter((s) => !s.isExcluded)
        .reduce((a, s) => a.add(s.amount), new Prisma.Decimal(0))
      if (sum.sub(total).abs().gt(new Prisma.Decimal(0.01))) {
        return c.json({ error: 'Tổng phần trăm phải đạt 100%' }, 400)
      }
    }
  }

  if (d.isStandalone === false && existing.standalonePayment?.paymentRecords.length) {
    const blocked = existing.standalonePayment.paymentRecords.some(
      (r) => r.status === 'CONFIRMED' || r.status === 'ACCEPTED',
    )
    if (blocked) {
      return c.json(
        { error: 'Đã có chứng từ hoặc đã duyệt thanh toán riêng — không thể tắt chi riêng lẻ' },
        400,
      )
    }
  }

  const memberRows = await prisma.groupMember.findMany({
    where: { groupId, ...activeMemberWhere },
    select: { userId: true },
  })
  const memberIdSet = new Set(memberRows.map((x) => x.userId))
  if (d.paidByUserId !== undefined && !memberIdSet.has(d.paidByUserId)) {
    return c.json({ error: 'Người trả tiền phải là thành viên đang hoạt động trong nhóm' }, 400)
  }

  const paidByWillChange = d.paidByUserId !== undefined && d.paidByUserId !== existing.paidByUserId
  if (paidByWillChange && existing.isStandalone && existing.standalonePayment) {
    const blockedPaidBy = existing.standalonePayment.paymentRecords.some(
      (r) => r.status === 'CONFIRMED' || r.status === 'ACCEPTED',
    )
    if (blockedPaidBy) {
      return c.json(
        {
          error: 'Không đổi người trả tiền khi chi riêng đã có chứng từ hoặc thanh toán được duyệt',
        },
        400,
      )
    }
  }

  const receiverForStandalone = d.paidByUserId ?? existing.paidByUserId

  const updated = await prisma.$transaction(async (tx) => {
    if (splitRows) {
      await tx.expenseSplit.deleteMany({ where: { expenseId } })
      await tx.expenseSplit.createMany({
        data: splitRows.map((s) => ({
          expenseId,
          userId: s.userId,
          amount: s.amount,
          percentage: s.percentage,
          isExcluded: s.isExcluded,
        })),
      })
    }

    const splitsForStandalone = splitRows
      ? splitRows
      : await tx.expenseSplit.findMany({ where: { expenseId } })

    if (d.isStandalone === true) {
      const sp = await tx.standalonePayment.findUnique({ where: { expenseId } })
      if (!sp) {
        const records = splitsForStandalone
          .filter((s) => !s.isExcluded && s.userId !== receiverForStandalone && s.amount.gt(0))
          .map((s) => ({
            payerUserId: s.userId,
            receiverUserId: receiverForStandalone,
            amount: s.amount,
            status: 'PENDING' as const,
          }))
        await tx.standalonePayment.create({
          data: {
            expenseId,
            ...(records.length ? { paymentRecords: { create: records } } : {}),
          },
        })
      }
    }

    if (d.isStandalone === false) {
      const sp = await tx.standalonePayment.findUnique({ where: { expenseId } })
      if (sp) {
        await tx.paymentRecord.deleteMany({ where: { standalonePaymentId: sp.id } })
        await tx.standalonePayment.delete({ where: { id: sp.id } })
      }
    }

    const updatedExpense = await tx.expense.update({
      where: { id: expenseId },
      data: {
        ...(d.title != null ? { title: d.title.trim() } : {}),
        ...(d.description !== undefined ? { description: d.description?.trim() ?? null } : {}),
        ...(d.amount != null ? { amount: new Prisma.Decimal(d.amount) } : {}),
        ...(d.splitType != null ? { splitType: d.splitType } : {}),
        ...(d.categoryId !== undefined ? { categoryId: d.categoryId } : {}),
        ...(d.expenseDate != null ? { expenseDate: new Date(d.expenseDate) } : {}),
        ...(d.tags != null ? { tags: d.tags } : {}),
        ...(d.imageUrls != null ? { imageUrls: d.imageUrls } : {}),
        ...(d.isStandalone !== undefined ? { isStandalone: d.isStandalone } : {}),
        ...(d.paidByUserId !== undefined ? { paidByUserId: d.paidByUserId } : {}),
        ...(d.isStandalone === false && existing.status === 'STANDALONE_DONE'
          ? { status: 'ACTIVE' }
          : {}),
      },
      include: {
        splits: { include: { user: { select: { id: true, name: true, avatarUrl: true } } } },
        category: true,
        paidBy: { select: { id: true, name: true, avatarUrl: true } },
        _count: { select: { comments: true } },
      },
    })

    if (
      paidByWillChange &&
      existing.isStandalone &&
      d.isStandalone !== false &&
      updatedExpense.isStandalone
    ) {
      const sp = await tx.standalonePayment.findUnique({ where: { expenseId } })
      if (sp) {
        await tx.paymentRecord.deleteMany({ where: { standalonePaymentId: sp.id } })
        const splits = await tx.expenseSplit.findMany({ where: { expenseId } })
        const recv = updatedExpense.paidByUserId
        const rows = splits
          .filter((s) => !s.isExcluded && s.userId !== recv && s.amount.gt(0))
          .map((s) => ({
            standalonePaymentId: sp.id,
            payerUserId: s.userId,
            receiverUserId: recv,
            amount: s.amount,
            status: 'PENDING' as const,
          }))
        if (rows.length) {
          await tx.paymentRecord.createMany({ data: rows })
        }
      }
    }

    return updatedExpense
  })
  await prisma.auditLog.create({
    data: {
      userId,
      groupId,
      expenseId,
      action: 'EXPENSE_UPDATED',
      before: {
        title: existing.title,
        description: existing.description,
        amount: String(existing.amount),
        splitType: existing.splitType,
        categoryId: existing.categoryId,
        paidByUserId: existing.paidByUserId,
        expenseDate: existing.expenseDate.toISOString(),
        tags: existing.tags,
        imageUrls: existing.imageUrls,
        isStandalone: existing.isStandalone,
        status: existing.status,
      },
      after: {
        title: updated.title,
        description: updated.description,
        amount: String(updated.amount),
        splitType: updated.splitType,
        categoryId: updated.categoryId,
        paidByUserId: updated.paidByUserId,
        expenseDate: updated.expenseDate.toISOString(),
        tags: updated.tags,
        imageUrls: updated.imageUrls,
        isStandalone: updated.isStandalone,
        status: updated.status,
      },
      ipAddress: clientIp(c) || null,
    },
  })
  const actU = await actorSnapshot(prisma, userId)
  await writeGroupActivityLog(prisma, {
    groupId,
    actorUserId: userId,
    actorName: actU.name,
    actorEmail: actU.email,
    action: 'EXPENSE_UPDATED',
    summary: `${actU.name} (${actU.email}) cập nhật chi «${updated.title}» — ${formatVndForSummary(updated.amount)}`,
    targetType: 'EXPENSE',
    targetId: expenseId,
    metadata: {
      isStandalone: updated.isStandalone,
      title: updated.title,
      amount: String(updated.amount),
    },
  })
  return c.json({ data: await toExpenseDtoWithSignedAvatars(updated, userId) })
})

groupExpenseRoutes.delete('/:expenseId', async (c) => {
  const userId = c.get('userId')
  const groupId = c.get('groupId')
  const expenseId = c.req.param('expenseId')
  const m = c.get('groupMember')
  if (!m) return c.json({ error: 'Không tìm thấy nhóm' }, 404)

  const existing = await prisma.expense.findFirst({ where: { id: expenseId, groupId, deletedAt: null } })
  if (!existing) return c.json({ error: 'Không tìm thấy' }, 404)
  if (existing.status === 'SETTLED') return c.json({ error: 'Không xoá được chi đã tổng kết' }, 400)
  if (existing.status === 'STANDALONE_DONE') {
    return c.json({ error: 'Không xoá được chi riêng đã hoàn tất thanh toán' }, 400)
  }

  await prisma.$transaction(async (tx) => {
    const actD = await tx.user.findUnique({
      where: { id: userId },
      select: { name: true, email: true },
    })

    const [leaders, splitUsers] = await Promise.all([
      tx.groupMember.findMany({
        where: { groupId, role: 'LEADER', isActive: true, leftAt: null },
        select: { userId: true },
      }),
      tx.expenseSplit.findMany({ where: { expenseId }, select: { userId: true } }),
    ])
    const targetSet = new Set<string>([
      existing.paidByUserId,
      ...splitUsers.map((s) => s.userId),
      ...leaders.map((l) => l.userId),
    ])
    targetSet.delete(userId)
    const targets = [...targetSet]

    await writeGroupActivityLog(tx, {
      groupId,
      actorUserId: userId,
      actorName: actD?.name ?? '',
      actorEmail: actD?.email ?? '',
      action: 'EXPENSE_DELETED',
      summary: `${actD?.name ?? '?'} (${actD?.email ?? ''}) xóa chi «${existing.title}» — ${formatVndForSummary(existing.amount)} (mã ${expenseId})`,
      targetType: 'EXPENSE',
      targetId: expenseId,
      metadata: {
        title: existing.title,
        amount: String(existing.amount),
        isStandalone: existing.isStandalone,
      },
    })

    if (targets.length) {
      const title = 'Chi tiêu đã bị xoá'
      const body = `${actD?.name ?? 'Một thành viên'} đã xoá chi «${existing.title}» (${formatVndForSummary(existing.amount)}). Có thể khôi phục trong 7 ngày.`
      await tx.notification.createMany({
        data: targets.map((uid) => ({
          userId: uid,
          type: 'EXPENSE_DELETED',
          title,
          body,
          data: { groupId, expenseId, kind: 'expense_deleted' },
        })),
      })
    }

    await tx.auditLog.create({
      data: {
        userId,
        groupId,
        expenseId,
        action: 'EXPENSE_SOFT_DELETED',
        before: {
          title: existing.title,
          amount: String(existing.amount),
          status: existing.status,
          isStandalone: existing.isStandalone,
        },
        after: { deletedAt: new Date().toISOString() },
        ipAddress: clientIp(c) || null,
      },
    })
    await tx.expense.update({
      where: { id: expenseId },
      data: {
        deletedAt: new Date(),
        deletedByUserId: userId,
      },
    })
  })
  return c.json({ data: { ok: true } })
})

groupExpenseRoutes.post('/:expenseId/restore', async (c) => {
  const userId = c.get('userId')
  const groupId = c.get('groupId')
  const expenseId = c.req.param('expenseId')
  const m = c.get('groupMember')
  const adminBrowse = c.get('adminGroupBrowse')
  if (!m && !adminBrowse) return c.json({ error: 'Không tìm thấy nhóm' }, 404)

  const existing = await prisma.expense.findFirst({ where: { id: expenseId, groupId } })
  if (!existing) return c.json({ error: 'Không tìm thấy' }, 404)
  if (!existing.deletedAt) return c.json({ error: 'Chi tiêu chưa bị xoá' }, 400)
  const restoreDeadline = new Date()
  restoreDeadline.setDate(restoreDeadline.getDate() - 7)
  if (existing.deletedAt < restoreDeadline) {
    return c.json({ error: 'Đã quá hạn khôi phục (7 ngày)' }, 400)
  }
  if (existing.status === 'SETTLED') return c.json({ error: 'Không khôi phục chi đã tổng kết' }, 400)
  if (existing.status === 'STANDALONE_DONE') {
    return c.json({ error: 'Không khôi phục chi riêng đã hoàn tất thanh toán' }, 400)
  }

  await prisma.$transaction(async (tx) => {
    const act = await tx.user.findUnique({
      where: { id: userId },
      select: { name: true, email: true },
    })

    const [leaders, splitUsers] = await Promise.all([
      tx.groupMember.findMany({
        where: { groupId, role: 'LEADER', isActive: true, leftAt: null },
        select: { userId: true },
      }),
      tx.expenseSplit.findMany({ where: { expenseId }, select: { userId: true } }),
    ])
    const targetSet = new Set<string>([
      existing.paidByUserId,
      ...splitUsers.map((s) => s.userId),
      ...leaders.map((l) => l.userId),
    ])
    targetSet.delete(userId)
    const targets = [...targetSet]

    await tx.expense.update({
      where: { id: expenseId },
      data: { deletedAt: null, deletedByUserId: null },
    })

    if (targets.length) {
      const title = 'Chi tiêu đã được khôi phục'
      const body = `${act?.name ?? 'Một thành viên'} đã khôi phục chi «${existing.title}» (${formatVndForSummary(existing.amount)}).`
      await tx.notification.createMany({
        data: targets.map((uid) => ({
          userId: uid,
          type: 'EXPENSE_RESTORED',
          title,
          body,
          data: { groupId, expenseId, kind: 'expense_restored' },
        })),
      })
    }

    await tx.auditLog.create({
      data: {
        userId,
        groupId,
        expenseId,
        action: 'EXPENSE_RESTORED',
        before: {
          deletedAt: existing.deletedAt!.toISOString(),
          deletedByUserId: existing.deletedByUserId,
        },
        after: { deletedAt: null, deletedByUserId: null },
        ipAddress: clientIp(c) || null,
      },
    })
    await writeGroupActivityLog(tx, {
      groupId,
      actorUserId: userId,
      actorName: act?.name ?? '',
      actorEmail: act?.email ?? '',
      action: 'EXPENSE_RESTORED',
      summary: `${act?.name ?? '?'} (${act?.email ?? ''}) khôi phục chi «${existing.title}» — ${formatVndForSummary(existing.amount)} (mã ${expenseId})`,
      targetType: 'EXPENSE',
      targetId: expenseId,
      metadata: {
        title: existing.title,
        amount: String(existing.amount),
        isStandalone: existing.isStandalone,
      },
    })
  })

  return c.json({ data: { ok: true } })
})
