import { prisma } from '@expense/database'
import { Prisma } from '@expense/database'
import {
  contributeFundSchema,
  createGroupSchema,
  groupActivityLogFilterSchema,
  inviteMemberSchema,
  rejectFundContributionSchema,
  updateGroupFundSchema,
  updateGroupPresetTagsSchema,
  updateGroupSchema,
  updateMemberRoleSchema,
} from '@expense/types'
import type {
  GroupActivityLogDto,
  GroupDto,
  GroupInviteSearchUserDto,
  GroupMembersListDto,
  MemberDto,
  PendingGroupInviteDto,
} from '@expense/types'
import type { Context } from 'hono'
import { Hono } from 'hono'
import { z } from 'zod'
import { memberUnsettledFinancials, unsettledSharedNetBalance } from '../lib/dashboard-summary.js'
import { formatVndForSummary } from '../lib/format-vnd.js'
import { actorSnapshot, writeGroupActivityLog } from '../lib/group-activity-log.js'
import {
  GROUP_SUSPENDED_MSG,
  resolveGroupReadAccess,
  resolveGroupWriteAccess,
} from '../lib/group-gate.js'
import { signedStorageUrlForUser } from '../lib/minio.js'
import { requireAuth } from '../middleware/auth.js'
import { groupExpenseRoutes } from './expenses.js'
import { groupSettlementRoutes } from './settlements.js'

const activeMemberWhere = { isActive: true, leftAt: null } as const
const UNSETTLED_NET_EPS = new Prisma.Decimal('0.005')

async function resolveFundContributionReviewer(
  c: Context,
  groupId: string,
): Promise<{ ok: true; reviewerUserId: string } | { ok: false; response: Response }> {
  const userId = c.get('userId') as string
  const userRole = c.get('userRole') as string

  const group = await prisma.group.findUnique({ where: { id: groupId } })
  if (!group) return { ok: false, response: c.json({ error: 'Không tìm thấy nhóm' }, 404) }
  if (!group.isActive && userRole !== 'ADMIN') {
    return { ok: false, response: c.json({ error: GROUP_SUSPENDED_MSG }, 403) }
  }

  if (userRole === 'ADMIN') {
    return { ok: true, reviewerUserId: userId }
  }

  const m = await prisma.groupMember.findFirst({
    where: {
      groupId,
      userId,
      user: { isActive: true },
      role: { in: ['LEADER', 'VICE_LEADER'] },
    },
  })
  if (!m) {
    return {
      ok: false,
      response: c.json(
        { error: 'Chỉ trưởng nhóm, phó nhóm hoặc quản trị viên mới xác nhận được nộp quỹ' },
        403,
      ),
    }
  }
  return { ok: true, reviewerUserId: userId }
}

type FundTxMapRow = {
  id: string
  type: string
  amount: unknown
  note: string | null
  createdAt: Date
  contributionStatus: 'PENDING' | 'APPROVED' | 'REJECTED' | null
  proofImageUrls: string[]
  reviewedByUserId: string | null
  reviewedAt: Date | null
  reviewNote: string | null
  user: { id: string; name: string; avatarUrl: string | null }
  reviewedBy: { id: string; name: string } | null
}

async function mapFundTransactionForViewer(row: FundTxMapRow, viewerUserId: string) {
  const proofUrls: string[] = []
  for (const u of row.proofImageUrls) {
    proofUrls.push((await signedStorageUrlForUser(u, viewerUserId)) ?? u)
  }
  const av = await signedStorageUrlForUser(row.user.avatarUrl, viewerUserId)
  return {
    id: row.id,
    type: row.type,
    amount: String(row.amount),
    note: row.note,
    createdAt: row.createdAt.toISOString(),
    user: {
      id: row.user.id,
      name: row.user.name,
      avatarUrl: av,
    },
    contributionStatus: row.type === 'CONTRIBUTE' ? row.contributionStatus : null,
    proofImageUrls: row.type === 'CONTRIBUTE' ? proofUrls : [],
    reviewedAt: row.reviewedAt?.toISOString() ?? null,
    reviewNote: row.reviewNote,
    reviewedBy: row.reviewedBy ? { id: row.reviewedBy.id, name: row.reviewedBy.name } : null,
  }
}

async function buildFundResponsePayload(fundId: string, viewerUserId: string) {
  const fund = await prisma.groupFund.findUnique({
    where: { id: fundId },
    include: {
      transactions: {
        take: 50,
        orderBy: { createdAt: 'desc' },
        include: {
          user: { select: { id: true, name: true, avatarUrl: true } },
          reviewedBy: { select: { id: true, name: true } },
        },
      },
    },
  })
  if (!fund) return null
  const transactions = await Promise.all(
    fund.transactions.map((t) => mapFundTransactionForViewer(t as FundTxMapRow, viewerUserId)),
  )
  return {
    id: fund.id,
    groupId: fund.groupId,
    balance: String(fund.balance),
    lowThreshold: String(fund.lowThreshold),
    transactions,
  }
}

function fundBalanceString(balance: unknown): string | null {
  if (balance == null) return null
  return String(balance)
}

function fundLowThresholdString(fund: { lowThreshold: unknown } | null | undefined): string | null {
  if (!fund) return null
  return String(fund.lowThreshold)
}

async function toGroupDto(
  group: {
    id: string
    name: string
    description: string | null
    avatarUrl: string | null
    icon: string | null
    color: string | null
    inviteCode: string
    inviteEnabled: boolean
    inviteExpires: Date | null
    isActive: boolean
    requireApproval: boolean
    debtReminderEnabled: boolean
    debtReminderDays: number
    presetTags?: string[]
    createdAt: Date
  },
  myRole: string,
  memberCount: number,
  fundBalance: string | null,
  fundLowThreshold: string | null,
  viewerUserId: string,
  extras?: { adminViewer?: boolean; memberNames?: string[] },
): Promise<GroupDto> {
  return {
    id: group.id,
    name: group.name,
    description: group.description,
    avatarUrl: await signedStorageUrlForUser(group.avatarUrl, viewerUserId),
    icon: group.icon,
    color: group.color,
    inviteCode: group.inviteCode,
    inviteEnabled: group.inviteEnabled,
    inviteExpires: group.inviteExpires?.toISOString() ?? null,
    isActive: group.isActive,
    requireApproval: group.requireApproval,
    debtReminderEnabled: group.debtReminderEnabled,
    debtReminderDays: group.debtReminderDays,
    memberCount,
    myRole,
    fundBalance,
    fundLowThreshold,
    createdAt: group.createdAt.toISOString(),
    presetTags: group.presetTags ?? [],
    ...(extras?.memberNames ? { memberNames: extras.memberNames } : {}),
    ...(extras?.adminViewer ? { adminViewer: true } : {}),
  }
}

function inviteJoinAllowed(group: {
  inviteEnabled: boolean
  inviteExpires: Date | null
  isActive: boolean
}): boolean {
  if (!group.isActive || !group.inviteEnabled) return false
  if (group.inviteExpires != null && group.inviteExpires.getTime() <= Date.now()) return false
  return true
}

function newInviteCodeCandidate(): string {
  const alphabet = 'abcdefghijklmnopqrstuvwxyz0123456789'
  let s = 'c'
  for (let i = 0; i < 24; i++) s += alphabet[Math.floor(Math.random() * alphabet.length)]!
  return s
}

function toMemberDto(m: {
  id: string
  userId: string
  groupId: string
  role: string
  nickname: string | null
  isActive: boolean
  joinedAt: Date
  user: { id: string; name: string; email: string; avatarUrl: string | null }
}): MemberDto {
  return {
    id: m.id,
    userId: m.userId,
    groupId: m.groupId,
    role: m.role,
    nickname: m.nickname,
    isActive: m.isActive,
    joinedAt: m.joinedAt.toISOString(),
    user: {
      id: m.user.id,
      name: m.user.name,
      email: m.user.email,
      avatarUrl: m.user.avatarUrl,
    },
  }
}

export const groupRoutes = new Hono<{
  Variables: { userId: string; userRole: string; sessionJti: string }
}>()

groupRoutes.use('*', requireAuth)

groupRoutes.post('/join', async (c) => {
  const userId = c.get('userId')
  let body: unknown
  try {
    body = await c.req.json()
  } catch {
    return c.json({ error: 'Invalid JSON' }, 400)
  }
  const parsed = inviteMemberSchema.safeParse({
    inviteCode: (body as { inviteCode?: string }).inviteCode,
  })
  if (!parsed.success || !parsed.data.inviteCode) {
    return c.json({ error: 'Cần mã mời' }, 400)
  }
  const code = parsed.data.inviteCode.trim()
  const targetGroup = await prisma.group.findFirst({
    where: { inviteCode: code, isActive: true },
  })
  if (!targetGroup || !inviteJoinAllowed(targetGroup)) {
    return c.json({ error: 'Mã mời không hợp lệ hoặc đã tắt' }, 404)
  }
  const existing = await prisma.groupMember.findUnique({
    where: { groupId_userId: { groupId: targetGroup.id, userId } },
  })
  if (existing != null && existing.leftAt == null && existing.isActive) {
    return c.json({ error: 'Bạn đã là thành viên nhóm này' }, 409)
  }
  if (targetGroup.requireApproval) {
    const existingReq = await prisma.groupJoinRequest.findUnique({
      where: { groupId_userId: { groupId: targetGroup.id, userId } },
    })
    if (existingReq) {
      if (existingReq.status === 'PENDING') {
        return c.json({ error: 'Đã gửi yêu cầu tham gia, vui lòng chờ quản trị viên duyệt' }, 409)
      }
      if (existingReq.status === 'REJECTED') {
        return c.json({ error: 'Yêu cầu tham gia của bạn đã bị từ chối trước đó' }, 403)
      }
    }
    await prisma.groupJoinRequest.upsert({
      where: { groupId_userId: { groupId: targetGroup.id, userId } },
      create: { groupId: targetGroup.id, userId, status: 'PENDING' },
      update: { status: 'PENDING' },
    })
    return c.json({ data: { ok: true, groupId: targetGroup.id, pendingApproval: true } })
  }

  if (existing) {
    await prisma.groupMember.update({
      where: { id: existing.id },
      data: { isActive: true, leftAt: null, role: 'MEMBER' },
    })
  } else {
    await prisma.groupMember.create({
      data: { groupId: targetGroup.id, userId, role: 'MEMBER' },
    })
  }
  const joiner = await actorSnapshot(prisma, userId)
  await writeGroupActivityLog(prisma, {
    groupId: targetGroup.id,
    actorUserId: userId,
    actorName: joiner.name,
    actorEmail: joiner.email,
    action: 'MEMBER_JOINED_INVITE',
    summary: `${joiner.name} (${joiner.email}) tham gia nhóm bằng mã mời`,
    targetType: 'MEMBER',
    targetId: userId,
  })
  return c.json({ data: { ok: true, groupId: targetGroup.id } })
})

groupRoutes.get('/', async (c) => {
  const userId = c.get('userId')
  const rows = await prisma.groupMember.findMany({
    where: { userId, ...activeMemberWhere, group: { isActive: true } },
    include: {
      group: {
        include: {
          fund: true,
          _count: { select: { members: { where: { ...activeMemberWhere } } } },
        },
      },
    },
    orderBy: { joinedAt: 'desc' },
  })

  const groupIds = rows.map((r) => r.groupId)
  const members = await prisma.groupMember.findMany({
    where: { groupId: { in: groupIds }, ...activeMemberWhere, user: { isActive: true } },
    select: { groupId: true, user: { select: { name: true } } },
  })
  const namesByGroupId = new Map<string, string[]>()
  for (const m of members) {
    const arr = namesByGroupId.get(m.groupId) ?? []
    arr.push(m.user.name)
    namesByGroupId.set(m.groupId, arr)
  }

  const data: GroupDto[] = await Promise.all(
    rows.map((row) =>
      toGroupDto(
        row.group,
        row.role,
        row.group._count.members,
        row.group.fund ? fundBalanceString(row.group.fund.balance) : null,
        fundLowThresholdString(row.group.fund),
        userId,
        { memberNames: namesByGroupId.get(row.groupId) ?? [] },
      ),
    ),
  )
  return c.json({ data })
})

groupRoutes.post('/', async (c) => {
  const userId = c.get('userId')
  let body: unknown
  try {
    body = await c.req.json()
  } catch {
    return c.json({ error: 'Invalid JSON' }, 400)
  }
  const parsed = createGroupSchema.safeParse(body)
  if (!parsed.success) {
    const msg = parsed.error.issues[0]?.message ?? 'Dữ liệu không hợp lệ'
    return c.json({ error: msg }, 400)
  }

  const name = parsed.data.name.trim()
  const description = parsed.data.description?.trim() || null
  const icon = parsed.data.icon?.trim() || null
  const color = parsed.data.color?.trim() || null

  const group = await prisma.$transaction(async (tx) => {
    const g = await tx.group.create({
      data: {
        name,
        description,
        icon,
        color,
        fund: { create: { balance: 0, lowThreshold: 0 } },
        members: {
          create: { userId, role: 'LEADER' },
        },
      },
      include: {
        fund: true,
        _count: { select: { members: { where: { ...activeMemberWhere } } } },
      },
    })
    return g
  })

  return c.json({
    data: await toGroupDto(
      group,
      'LEADER',
      group._count.members,
      group.fund ? fundBalanceString(group.fund.balance) : null,
      fundLowThresholdString(group.fund),
      userId,
    ),
  })
})

groupRoutes.route('/:groupId/expenses', groupExpenseRoutes)
groupRoutes.route('/:groupId/settlements', groupSettlementRoutes)

// ── CUSTOM CATEGORIES ─────────────────────────────
import { createCategorySchema, updateCategorySchema } from '@expense/types'

groupRoutes.post('/:groupId/categories', async (c) => {
  const groupId = c.req.param('groupId')
  const userId = c.get('userId')
  
  const w = await resolveGroupWriteAccess(c, groupId)
  if (!w.ok) return w.response
  if (w.m.role !== 'LEADER' && w.m.role !== 'VICE_LEADER') {
    return c.json({ error: 'Chỉ trưởng nhóm hoặc phó nhóm có thể thêm danh mục' }, 403)
  }

  let body: unknown
  try {
    body = await c.req.json()
  } catch {
    return c.json({ error: 'Invalid JSON' }, 400)
  }

  const parsed = createCategorySchema.safeParse(body)
  if (!parsed.success) {
    return c.json({ error: parsed.error.issues[0]?.message ?? 'Dữ liệu không hợp lệ' }, 400)
  }

  const existing = await prisma.category.findFirst({
    where: { groupId, name: parsed.data.name }
  })
  if (existing) {
    return c.json({ error: 'Danh mục này đã tồn tại trong nhóm' }, 409)
  }

  const cat = await prisma.category.create({
    data: {
      groupId,
      name: parsed.data.name,
      icon: parsed.data.icon ?? null,
      color: parsed.data.color ?? null,
      isSystem: false,
    }
  })

  return c.json({ data: cat })
})

groupRoutes.put('/:groupId/categories/:categoryId', async (c) => {
  const groupId = c.req.param('groupId')
  const categoryId = c.req.param('categoryId')
  const w = await resolveGroupWriteAccess(c, groupId)
  if (!w.ok) return w.response
  if (w.m.role !== 'LEADER' && w.m.role !== 'VICE_LEADER') {
    return c.json({ error: 'Không có quyền' }, 403)
  }

  let body: unknown
  try {
    body = await c.req.json()
  } catch {
    return c.json({ error: 'Invalid JSON' }, 400)
  }
  const parsed = updateCategorySchema.safeParse(body)
  if (!parsed.success) {
    return c.json({ error: 'Dữ liệu không hợp lệ' }, 400)
  }

  const target = await prisma.category.findFirst({
    where: { id: categoryId, groupId }
  })
  if (!target) return c.json({ error: 'Không tìm thấy danh mục' }, 404)

  if (parsed.data.name && parsed.data.name !== target.name) {
    const existing = await prisma.category.findFirst({
      where: { groupId, name: parsed.data.name, NOT: { id: categoryId } }
    })
    if (existing) return c.json({ error: 'Tên danh mục đã tồn tại' }, 409)
  }

  const cat = await prisma.category.update({
    where: { id: categoryId },
    data: {
      ...(parsed.data.name ? { name: parsed.data.name } : {}),
      ...(parsed.data.icon !== undefined ? { icon: parsed.data.icon } : {}),
      ...(parsed.data.color !== undefined ? { color: parsed.data.color } : {})
    }
  })

  return c.json({ data: cat })
})

groupRoutes.delete('/:groupId/categories/:categoryId', async (c) => {
  const groupId = c.req.param('groupId')
  const categoryId = c.req.param('categoryId')
  
  const w = await resolveGroupWriteAccess(c, groupId)
  if (!w.ok) return w.response
  if (w.m.role !== 'LEADER' && w.m.role !== 'VICE_LEADER') {
    return c.json({ error: 'Không có quyền' }, 403)
  }

  const target = await prisma.category.findFirst({
    where: { id: categoryId, groupId },
    include: { _count: { select: { expenses: true } } }
  })
  if (!target) return c.json({ error: 'Không tìm thấy danh mục' }, 404)
  if (target._count.expenses > 0) {
    return c.json({ error: 'Không thể xoá danh mục đã có khoản chi' }, 400)
  }

  await prisma.category.delete({ where: { id: categoryId } })
  return c.json({ data: { ok: true } })
})

groupRoutes.put('/:groupId/preset-tags', async (c) => {
  const groupId = c.req.param('groupId')
  const userId = c.get('userId')
  const w = await resolveGroupWriteAccess(c, groupId)
  if (!w.ok) return w.response
  if (w.m.role !== 'LEADER' && w.m.role !== 'VICE_LEADER') {
    return c.json({ error: 'Chỉ trưởng nhóm hoặc phó nhóm có thể chỉnh thẻ gợi ý' }, 403)
  }

  let body: unknown
  try {
    body = await c.req.json()
  } catch {
    return c.json({ error: 'Invalid JSON' }, 400)
  }
  const parsed = updateGroupPresetTagsSchema.safeParse(body)
  if (!parsed.success) {
    return c.json({ error: parsed.error.issues[0]?.message ?? 'Dữ liệu không hợp lệ' }, 400)
  }

  const g = await prisma.group.update({
    where: { id: groupId },
    data: { presetTags: parsed.data.tags },
    include: {
      fund: true,
      _count: { select: { members: { where: { ...activeMemberWhere } } } },
    },
  })

  return c.json({
    data: await toGroupDto(
      g,
      w.m.role,
      g._count.members,
      g.fund ? fundBalanceString(g.fund.balance) : null,
      fundLowThresholdString(g.fund),
      userId,
    ),
  })
})

/** Thẻ đã xuất hiện trên ít nhất một khoản chi (chưa xóa mềm) trong nhóm. */
groupRoutes.get('/:groupId/used-tags', async (c) => {
  const groupId = c.req.param('groupId')
  const access = await resolveGroupReadAccess(c, groupId)
  if (!access.ok) return access.response

  const rows = await prisma.$queryRaw<{ tag: string }[]>`
    SELECT DISTINCT TRIM(t) AS tag
    FROM "Expense"
    CROSS JOIN LATERAL unnest(COALESCE("tags", ARRAY[]::text[])) AS u(t)
    WHERE "groupId" = ${groupId}
      AND "deletedAt" IS NULL
      AND TRIM(t) <> ''
    ORDER BY tag ASC
  `
  const tags = rows.map((r) => r.tag).filter((s) => s.length > 0)
  return c.json({ data: { tags } })
})

groupRoutes.get('/:groupId/activity-logs', async (c) => {
  const groupId = c.req.param('groupId')
  const access = await resolveGroupReadAccess(c, groupId)
  if (!access.ok) return access.response

  const parsed = groupActivityLogFilterSchema.safeParse(
    Object.fromEntries(new URL(c.req.url).searchParams),
  )
  if (!parsed.success) {
    return c.json({ error: parsed.error.issues[0]?.message ?? 'Query không hợp lệ' }, 400)
  }
  const { page, limit, action, targetType, targetId, q, dateFrom, dateTo, hideStandaloneExpenses } =
    parsed.data

  const where: Prisma.GroupActivityLogWhereInput = { groupId }
  if (action) where.action = action
  if (targetType) where.targetType = targetType
  if (targetId) where.targetId = targetId
  if (q) where.summary = { contains: q, mode: 'insensitive' }
  const dt: Prisma.DateTimeFilter = {}
  if (dateFrom) dt.gte = new Date(dateFrom)
  if (dateTo) dt.lte = new Date(dateTo)
  if (Object.keys(dt).length) where.createdAt = dt

  if (hideStandaloneExpenses) {
    where.NOT = {
      AND: [{ targetType: 'EXPENSE' }, { metadata: { path: ['isStandalone'], equals: true } }],
    }
  }

  const [total, rows] = await Promise.all([
    prisma.groupActivityLog.count({ where }),
    prisma.groupActivityLog.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      skip: (page - 1) * limit,
      take: limit,
    }),
  ])

  const data: GroupActivityLogDto[] = rows.map((r) => ({
    id: r.id,
    groupId: r.groupId,
    actorUserId: r.actorUserId,
    actorName: r.actorName,
    actorEmail: r.actorEmail,
    action: r.action,
    summary: r.summary,
    targetType: r.targetType,
    targetId: r.targetId,
    metadata: r.metadata === null ? null : (r.metadata as Record<string, unknown>),
    createdAt: r.createdAt.toISOString(),
  }))

  return c.json({
    data: {
      data,
      total,
      page,
      limit,
      totalPages: Math.max(1, Math.ceil(total / limit)),
    },
  })
})

groupRoutes.get('/:groupId/invites/me', async (c) => {
  const userId = c.get('userId')
  const groupId = c.req.param('groupId')
  const inv = await prisma.groupInvite.findFirst({
    where: { groupId, inviteeUserId: userId, status: 'PENDING' },
    include: {
      inviter: { select: { name: true, email: true } },
      group: { select: { id: true, name: true, isActive: true } },
    },
  })
  if (!inv || !inv.group.isActive) {
    return c.json({ data: null })
  }
  return c.json({
    data: {
      invite: { id: inv.id, groupId: inv.groupId, createdAt: inv.createdAt.toISOString() },
      group: inv.group,
      inviter: inv.inviter,
    },
  })
})

groupRoutes.post('/:groupId/invites/:inviteId/accept', async (c) => {
  const userId = c.get('userId')
  const groupId = c.req.param('groupId')
  const inviteId = c.req.param('inviteId')
  const inv = await prisma.groupInvite.findFirst({
    where: { id: inviteId, groupId, inviteeUserId: userId, status: 'PENDING' },
    include: { group: { select: { name: true, isActive: true } } },
  })
  if (!inv) {
    return c.json({ error: 'Không tìm thấy lời mời hoặc đã xử lý' }, 404)
  }
  if (!inv.group.isActive) {
    return c.json({ error: GROUP_SUSPENDED_MSG }, 403)
  }

  await prisma.$transaction(async (tx) => {
    const existing = await tx.groupMember.findUnique({
      where: { groupId_userId: { groupId, userId } },
    })
    if (existing) {
      await tx.groupMember.update({
        where: { id: existing.id },
        data: { isActive: true, leftAt: null, role: 'MEMBER' },
      })
    } else {
      await tx.groupMember.create({
        data: { groupId, userId, role: 'MEMBER' },
      })
    }
    await tx.groupInvite.update({
      where: { id: inviteId },
      data: { status: 'ACCEPTED' },
    })
  })

  const snap = await actorSnapshot(prisma, userId)
  await writeGroupActivityLog(prisma, {
    groupId,
    actorUserId: userId,
    actorName: snap.name,
    actorEmail: snap.email,
    action: 'GROUP_INVITE_ACCEPTED',
    summary: `${snap.name} (${snap.email}) đã chấp nhận lời mời và tham gia nhóm «${inv.group.name}»`,
    targetType: 'MEMBER',
    targetId: userId,
    metadata: { inviteId },
  })

  return c.json({ data: { ok: true } })
})

groupRoutes.post('/:groupId/invites/:inviteId/decline', async (c) => {
  const userId = c.get('userId')
  const groupId = c.req.param('groupId')
  const inviteId = c.req.param('inviteId')
  const inv = await prisma.groupInvite.findFirst({
    where: { id: inviteId, groupId, inviteeUserId: userId, status: 'PENDING' },
  })
  if (!inv) {
    return c.json({ error: 'Không tìm thấy lời mời hoặc đã xử lý' }, 404)
  }
  await prisma.groupInvite.update({
    where: { id: inviteId },
    data: { status: 'DECLINED' },
  })
  const snap = await actorSnapshot(prisma, userId)
  const g = await prisma.group.findUnique({ where: { id: groupId }, select: { name: true } })
  await writeGroupActivityLog(prisma, {
    groupId,
    actorUserId: userId,
    actorName: snap.name,
    actorEmail: snap.email,
    action: 'GROUP_INVITE_DECLINED',
    summary: `${snap.name} (${snap.email}) đã từ chối lời mời tham gia nhóm «${g?.name ?? ''}»`,
    targetType: 'MEMBER',
    targetId: userId,
  })
  return c.json({ data: { ok: true } })
})

groupRoutes.delete('/:groupId/invites/:inviteId', async (c) => {
  const userId = c.get('userId')
  const groupId = c.req.param('groupId')
  const inviteId = c.req.param('inviteId')
  const w = await resolveGroupWriteAccess(c, groupId)
  if (!w.ok) return w.response
  if (w.m.role !== 'LEADER') {
    return c.json({ error: 'Chỉ trưởng nhóm' }, 403)
  }
  const inv = await prisma.groupInvite.findFirst({
    where: { id: inviteId, groupId, status: 'PENDING' },
    include: { invitee: { select: { name: true, email: true } } },
  })
  if (!inv) {
    return c.json({ error: 'Không tìm thấy lời mời' }, 404)
  }
  await prisma.groupInvite.update({
    where: { id: inviteId },
    data: { status: 'CANCELLED' },
  })
  const snap = await actorSnapshot(prisma, userId)
  await writeGroupActivityLog(prisma, {
    groupId,
    actorUserId: userId,
    actorName: snap.name,
    actorEmail: snap.email,
    action: 'GROUP_INVITE_CANCELLED',
    summary: `${snap.name} (${snap.email}) huỷ lời mời gửi tới ${inv.invitee.name} (${inv.invitee.email})`,
    targetType: 'MEMBER',
    targetId: inv.inviteeUserId,
  })
  return c.json({ data: { ok: true } })
})

/** Trưởng / phó nhóm: tìm user để mời (chưa trong nhóm, không có lời mời PENDING). */
groupRoutes.get('/:groupId/members/invite-search', async (c) => {
  const userId = c.get('userId')
  const groupId = c.req.param('groupId')
  const q = (c.req.query('q') ?? '').trim()
  if (q.length < 2) {
    return c.json({ data: [] as GroupInviteSearchUserDto[] })
  }

  const w = await resolveGroupWriteAccess(c, groupId)
  if (!w.ok) return w.response
  if (w.m.role !== 'LEADER' && w.m.role !== 'VICE_LEADER') {
    return c.json({ error: 'Không có quyền' }, 403)
  }

  const activeMembers = await prisma.groupMember.findMany({
    where: { groupId, ...activeMemberWhere },
    select: { userId: true },
  })
  const pendingRows = await prisma.groupInvite.findMany({
    where: { groupId, status: 'PENDING' },
    select: { inviteeUserId: true },
  })
  const excludeIds = new Set<string>([userId])
  for (const m of activeMembers) excludeIds.add(m.userId)
  for (const p of pendingRows) excludeIds.add(p.inviteeUserId)

  const users = await prisma.user.findMany({
    where: {
      isActive: true,
      id: { notIn: [...excludeIds] },
      OR: [
        { email: { contains: q, mode: 'insensitive' } },
        { name: { contains: q, mode: 'insensitive' } },
      ],
    },
    select: { id: true, email: true, name: true, avatarUrl: true },
    take: 20,
    orderBy: { email: 'asc' },
  })

  const data: GroupInviteSearchUserDto[] = await Promise.all(
    users.map(async (u) => ({
      id: u.id,
      email: u.email,
      name: u.name,
      avatarUrl: await signedStorageUrlForUser(u.avatarUrl, userId),
    })),
  )

  return c.json({ data })
})

groupRoutes.get('/:groupId/join-requests', async (c) => {
  const groupId = c.req.param('groupId')
  const userId = c.get('userId')
  const w = await resolveGroupWriteAccess(c, groupId)
  if (!w.ok) return w.response
  if (w.m.role !== 'LEADER' && w.m.role !== 'VICE_LEADER') {
    return c.json({ error: 'Không có quyền' }, 403)
  }
  const requests = await prisma.groupJoinRequest.findMany({
    where: { groupId, status: 'PENDING' },
    include: {
      user: { select: { id: true, name: true, email: true, avatarUrl: true } },
    },
    orderBy: { createdAt: 'asc' },
  })
  const dtos = await Promise.all(
    requests.map(async (req) => ({
      id: req.id,
      groupId: req.groupId,
      userId: req.userId,
      status: req.status,
      createdAt: req.createdAt.toISOString(),
      user: {
        ...req.user,
        avatarUrl: await signedStorageUrlForUser(req.user.avatarUrl, userId),
      },
    })),
  )
  return c.json({ data: dtos })
})

groupRoutes.post('/:groupId/join-requests/:requestId/approve', async (c) => {
  const groupId = c.req.param('groupId')
  const requestId = c.req.param('requestId')
  const userId = c.get('userId')
  const w = await resolveGroupWriteAccess(c, groupId)
  if (!w.ok) return w.response
  if (w.m.role !== 'LEADER' && w.m.role !== 'VICE_LEADER') {
    return c.json({ error: 'Không có quyền' }, 403)
  }
  const req = await prisma.groupJoinRequest.findFirst({
    where: { id: requestId, groupId, status: 'PENDING' },
    include: { user: { select: { id: true, name: true, email: true } } },
  })
  if (!req) return c.json({ error: 'Không tìm thấy yêu cầu' }, 404)

  await prisma.$transaction(async (tx) => {
    const existing = await tx.groupMember.findUnique({
      where: { groupId_userId: { groupId, userId: req.userId } },
    })
    if (existing) {
      await tx.groupMember.update({
        where: { id: existing.id },
        data: { isActive: true, leftAt: null, role: 'MEMBER' },
      })
    } else {
      await tx.groupMember.create({
        data: { groupId, userId: req.userId, role: 'MEMBER' },
      })
    }
    await tx.groupJoinRequest.update({
      where: { id: requestId },
      data: { status: 'APPROVED' },
    })
  })
  const adminSnap = await actorSnapshot(prisma, userId)
  await writeGroupActivityLog(prisma, {
    groupId,
    actorUserId: userId,
    actorName: adminSnap.name,
    actorEmail: adminSnap.email,
    action: 'JOIN_REQUEST_APPROVED',
    summary: `${adminSnap.name} (${adminSnap.email}) đã duyệt yêu cầu tham gia của ${req.user.name} (${req.user.email})`,
    targetType: 'MEMBER',
    targetId: req.userId,
  })
  return c.json({ data: { ok: true } })
})

groupRoutes.post('/:groupId/join-requests/:requestId/reject', async (c) => {
  const groupId = c.req.param('groupId')
  const requestId = c.req.param('requestId')
  const userId = c.get('userId')
  const w = await resolveGroupWriteAccess(c, groupId)
  if (!w.ok) return w.response
  if (w.m.role !== 'LEADER' && w.m.role !== 'VICE_LEADER') {
    return c.json({ error: 'Không có quyền' }, 403)
  }
  const req = await prisma.groupJoinRequest.findFirst({
    where: { id: requestId, groupId, status: 'PENDING' },
    include: { user: { select: { id: true, name: true, email: true } } },
  })
  if (!req) return c.json({ error: 'Không tìm thấy yêu cầu' }, 404)

  await prisma.groupJoinRequest.update({
    where: { id: requestId },
    data: { status: 'REJECTED' },
  })
  const adminSnap = await actorSnapshot(prisma, userId)
  await writeGroupActivityLog(prisma, {
    groupId,
    actorUserId: userId,
    actorName: adminSnap.name,
    actorEmail: adminSnap.email,
    action: 'JOIN_REQUEST_REJECTED',
    summary: `${adminSnap.name} (${adminSnap.email}) đã từ chối yêu cầu tham gia của ${req.user.name} (${req.user.email})`,
    targetType: 'MEMBER',
    targetId: req.userId,
  })
  return c.json({ data: { ok: true } })
})

groupRoutes.get('/:groupId/members', async (c) => {
  const userId = c.get('userId')
  const groupId = c.req.param('groupId')
  const access = await resolveGroupReadAccess(c, groupId)
  if (!access.ok) return access.response
  const showPendingInvites = access.adminViewer || access.m?.role === 'LEADER'
  const members = await prisma.groupMember.findMany({
    where: { groupId, ...activeMemberWhere },
    include: {
      user: { select: { id: true, name: true, email: true, avatarUrl: true } },
    },
    orderBy: { joinedAt: 'asc' },
  })
  const { fundContributedByUser, paidSharedByUser, owedSharedByUser, netIouByUser } =
    await memberUnsettledFinancials(groupId)
  const dtos = await Promise.all(
    members.map(async (m) => {
      const dto = toMemberDto(m)
      dto.user.avatarUrl = await signedStorageUrlForUser(m.user.avatarUrl, userId)
      dto.netBalance = (netIouByUser.get(m.userId) ?? new Prisma.Decimal(0)).toFixed(2)
      dto.sharedPaidTotal = (paidSharedByUser.get(m.userId) ?? new Prisma.Decimal(0)).toFixed(2)
      dto.sharedOwedTotal = (owedSharedByUser.get(m.userId) ?? new Prisma.Decimal(0)).toFixed(2)
      dto.fundContributedApproved = (
        fundContributedByUser.get(m.userId) ?? new Prisma.Decimal(0)
      ).toFixed(2)
      return dto
    }),
  )

  let pendingInvites: PendingGroupInviteDto[] = []
  if (showPendingInvites) {
    const pending = await prisma.groupInvite.findMany({
      where: { groupId, status: 'PENDING' },
      include: {
        invitee: { select: { id: true, name: true, email: true, avatarUrl: true } },
        inviter: { select: { id: true, name: true, email: true } },
      },
      orderBy: { createdAt: 'asc' },
    })
    pendingInvites = await Promise.all(
      pending.map(async (p) => ({
        id: p.id,
        groupId: p.groupId,
        inviteeUserId: p.inviteeUserId,
        invitedByUserId: p.invitedByUserId,
        createdAt: p.createdAt.toISOString(),
        invitee: {
          ...p.invitee,
          avatarUrl: await signedStorageUrlForUser(p.invitee.avatarUrl, userId),
        },
        invitedBy: p.inviter,
      })),
    )
  }

  const data: GroupMembersListDto = { members: dtos, pendingInvites }
  return c.json({ data })
})

groupRoutes.post('/:groupId/members', async (c) => {
  const userId = c.get('userId')
  const groupId = c.req.param('groupId')
  let body: unknown
  try {
    body = await c.req.json()
  } catch {
    return c.json({ error: 'Invalid JSON' }, 400)
  }
  const parsed = inviteMemberSchema.safeParse(body)
  if (!parsed.success) {
    const msg = parsed.error.issues[0]?.message ?? 'Dữ liệu không hợp lệ'
    return c.json({ error: msg }, 400)
  }

  const { email, inviteCode } = parsed.data

  if (email) {
    const w = await resolveGroupWriteAccess(c, groupId)
    if (!w.ok) return w.response
    const normalized = email.toLowerCase().trim()
    const target = await prisma.user.findUnique({ where: { email: normalized } })
    if (!target) {
      return c.json({ error: 'Không tìm thấy người dùng với email này' }, 404)
    }
    if (target.id === userId) {
      return c.json({ error: 'Không thể mời chính mình' }, 400)
    }
    const existingMember = await prisma.groupMember.findUnique({
      where: { groupId_userId: { groupId, userId: target.id } },
    })
    if (existingMember != null && existingMember.leftAt == null && existingMember.isActive) {
      return c.json({ error: 'Thành viên đã có trong nhóm' }, 409)
    }
    const dupPending = await prisma.groupInvite.findFirst({
      where: { groupId, inviteeUserId: target.id, status: 'PENDING' },
    })
    if (dupPending) {
      return c.json({ error: 'Đã có lời mời chờ người này xác nhận' }, 409)
    }

    const groupMeta = await prisma.group.findUnique({
      where: { id: groupId },
      select: { name: true },
    })
    const inviterRow = await prisma.user.findUnique({
      where: { id: userId },
      select: { name: true, email: true },
    })
    const inviteRow = await prisma.$transaction(async (tx) => {
      const inv = await tx.groupInvite.create({
        data: {
          groupId,
          inviteeUserId: target.id,
          invitedByUserId: userId,
          status: 'PENDING',
        },
      })
      await tx.notification.create({
        data: {
          userId: target.id,
          type: 'GROUP_INVITE',
          title: `Lời mời tham gia nhóm «${groupMeta?.name ?? 'Nhóm'}»`,
          body: `${inviterRow?.name ?? 'Trưởng nhóm'} (${inviterRow?.email ?? ''}) mời bạn vào nhóm. Mở thông báo và chọn xác nhận để tham gia.`,
          data: { groupId, inviteId: inv.id, kind: 'group_invite' },
        },
      })
      return inv
    })

    const [invS, tgtU] = await Promise.all([
      actorSnapshot(prisma, userId),
      prisma.user.findUnique({ where: { id: target.id }, select: { name: true, email: true } }),
    ])
    await writeGroupActivityLog(prisma, {
      groupId,
      actorUserId: userId,
      actorName: invS.name,
      actorEmail: invS.email,
      action: 'MEMBER_INVITED',
      summary: `${invS.name} (${invS.email}) gửi lời mời email tới ${tgtU?.name ?? '?'} (${tgtU?.email ?? ''}) — chờ xác nhận`,
      targetType: 'MEMBER',
      targetId: target.id,
      metadata: { inviteId: inviteRow.id },
    })
    return c.json({ data: { ok: true, inviteId: inviteRow.id } })
  }

  if (inviteCode) {
    const code = inviteCode.trim()
    const targetGroup = await prisma.group.findFirst({
      where: { inviteCode: code, isActive: true },
    })
    if (!targetGroup || !inviteJoinAllowed(targetGroup)) {
      return c.json({ error: 'Mã mời không hợp lệ hoặc đã tắt' }, 404)
    }
    const existing = await prisma.groupMember.findUnique({
      where: { groupId_userId: { groupId: targetGroup.id, userId } },
    })
    if (existing != null && existing.leftAt == null && existing.isActive) {
      return c.json({ error: 'Bạn đã là thành viên nhóm này' }, 409)
    }
    if (targetGroup.requireApproval) {
      const existingReq = await prisma.groupJoinRequest.findUnique({
        where: { groupId_userId: { groupId: targetGroup.id, userId } },
      })
      if (existingReq) {
        if (existingReq.status === 'PENDING')
          return c.json({ error: 'Đã gửi yêu cầu tham gia, chờ duyệt' }, 409)
        if (existingReq.status === 'REJECTED')
          return c.json({ error: 'Yêu cầu tham gia bị từ chối' }, 403)
      }
      await prisma.groupJoinRequest.upsert({
        where: { groupId_userId: { groupId: targetGroup.id, userId } },
        create: { groupId: targetGroup.id, userId, status: 'PENDING' },
        update: { status: 'PENDING' },
      })
      return c.json({ data: { ok: true, groupId: targetGroup.id, pendingApproval: true } })
    }
    if (existing) {
      await prisma.groupMember.update({
        where: { id: existing.id },
        data: { isActive: true, leftAt: null, role: 'MEMBER' },
      })
    } else {
      await prisma.groupMember.create({
        data: { groupId: targetGroup.id, userId, role: 'MEMBER' },
      })
    }
    const joiner2 = await actorSnapshot(prisma, userId)
    await writeGroupActivityLog(prisma, {
      groupId: targetGroup.id,
      actorUserId: userId,
      actorName: joiner2.name,
      actorEmail: joiner2.email,
      action: 'MEMBER_JOINED_INVITE',
      summary: `${joiner2.name} (${joiner2.email}) tham gia nhóm bằng mã mời (từ form mời)`,
      targetType: 'MEMBER',
      targetId: userId,
    })
    return c.json({ data: { ok: true, groupId: targetGroup.id } })
  }

  return c.json({ error: 'Cần email hoặc mã mời' }, 400)
})

groupRoutes.patch('/:groupId/members/:memberId', async (c) => {
  const userId = c.get('userId')
  const groupId = c.req.param('groupId')
  const memberId = c.req.param('memberId')
  const w = await resolveGroupWriteAccess(c, groupId)
  if (!w.ok) return w.response
  const leader = w.m.role === 'LEADER' ? w.m : null
  if (!leader) return c.json({ error: 'Chỉ trưởng nhóm' }, 403)

  let body: unknown
  try {
    body = await c.req.json()
  } catch {
    return c.json({ error: 'Invalid JSON' }, 400)
  }
  const parsed = updateMemberRoleSchema.safeParse(body)
  if (!parsed.success) {
    return c.json({ error: parsed.error.issues[0]?.message ?? 'Dữ liệu không hợp lệ' }, 400)
  }

  const target = await prisma.groupMember.findFirst({
    where: { id: memberId, groupId, ...activeMemberWhere },
  })
  if (!target) return c.json({ error: 'Không tìm thấy thành viên' }, 404)

  if (target.role === 'LEADER' && parsed.data.role !== 'LEADER') {
    const otherLeaders = await prisma.groupMember.count({
      where: { groupId, role: 'LEADER', ...activeMemberWhere, NOT: { id: memberId } },
    })
    if (otherLeaders === 0) {
      return c.json({ error: 'Cần chỉ định trưởng nhóm khác trước' }, 400)
    }
  }

  const targetUser = await prisma.user.findUnique({
    where: { id: target.userId },
    select: { name: true, email: true },
  })
  const leaderS = await actorSnapshot(prisma, userId)
  await prisma.groupMember.update({
    where: { id: memberId },
    data: { role: parsed.data.role },
  })
  await writeGroupActivityLog(prisma, {
    groupId,
    actorUserId: userId,
    actorName: leaderS.name,
    actorEmail: leaderS.email,
    action: 'MEMBER_ROLE_CHANGED',
    summary: `${leaderS.name} (${leaderS.email}) đổi vai trò ${targetUser?.name ?? '?'} (${targetUser?.email ?? ''}): ${target.role} → ${parsed.data.role}`,
    targetType: 'MEMBER',
    targetId: target.userId,
  })
  return c.json({ data: { ok: true } })
})

groupRoutes.delete('/:groupId/members/:memberId', async (c) => {
  const userId = c.get('userId')
  const groupId = c.req.param('groupId')
  const memberId = c.req.param('memberId')
  const w = await resolveGroupWriteAccess(c, groupId)
  if (!w.ok) return w.response
  if (w.m.role !== 'LEADER') return c.json({ error: 'Chỉ trưởng nhóm' }, 403)

  const target = await prisma.groupMember.findFirst({
    where: { id: memberId, groupId, ...activeMemberWhere },
  })
  if (!target) return c.json({ error: 'Không tìm thấy thành viên' }, 404)
  if (target.role === 'LEADER') {
    return c.json({ error: 'Không xoá trưởng nhóm — hãy chuyển quyền trước' }, 400)
  }

  const targetUser = await prisma.user.findUnique({
    where: { id: target.userId },
    select: { name: true, email: true },
  })
  const leaderRm = await actorSnapshot(prisma, userId)
  await prisma.groupMember.update({
    where: { id: memberId },
    data: { isActive: false, leftAt: new Date() },
  })
  await writeGroupActivityLog(prisma, {
    groupId,
    actorUserId: userId,
    actorName: leaderRm.name,
    actorEmail: leaderRm.email,
    action: 'MEMBER_REMOVED',
    summary: `${leaderRm.name} (${leaderRm.email}) gỡ ${targetUser?.name ?? '?'} (${targetUser?.email ?? ''}) khỏi nhóm`,
    targetType: 'MEMBER',
    targetId: target.userId,
  })
  return c.json({ data: { ok: true } })
})

groupRoutes.post('/:groupId/leave', async (c) => {
  const userId = c.get('userId')
  const groupId = c.req.param('groupId')
  const group = await prisma.group.findUnique({ where: { id: groupId } })
  if (!group) return c.json({ error: 'Không tìm thấy nhóm' }, 404)
  const self = await prisma.groupMember.findFirst({
    where: { groupId, userId, ...activeMemberWhere },
  })
  if (!self) return c.json({ error: 'Không tìm thấy nhóm' }, 404)
  if (self.role === 'LEADER') {
    return c.json({ error: 'Trưởng nhóm không thể rời — hãy giải tán nhóm hoặc chuyển quyền' }, 400)
  }
  const leaver = await actorSnapshot(prisma, userId)
  await prisma.groupMember.update({
    where: { id: self.id },
    data: { isActive: false, leftAt: new Date() },
  })
  await writeGroupActivityLog(prisma, {
    groupId,
    actorUserId: userId,
    actorName: leaver.name,
    actorEmail: leaver.email,
    action: 'MEMBER_LEFT',
    summary: `${leaver.name} (${leaver.email}) rời nhóm`,
    targetType: 'MEMBER',
    targetId: userId,
  })
  return c.json({ data: { ok: true } })
})

groupRoutes.patch('/:groupId/fund', async (c) => {
  const userId = c.get('userId')
  const groupId = c.req.param('groupId')
  const w = await resolveGroupWriteAccess(c, groupId)
  if (!w.ok) return w.response
  if (w.m.role !== 'LEADER') return c.json({ error: 'Chỉ trưởng nhóm' }, 403)

  let body: unknown
  try {
    body = await c.req.json()
  } catch {
    return c.json({ error: 'Invalid JSON' }, 400)
  }
  const parsed = updateGroupFundSchema.safeParse(body)
  if (!parsed.success) {
    return c.json({ error: parsed.error.issues[0]?.message ?? 'Dữ liệu không hợp lệ' }, 400)
  }

  const fund = await prisma.groupFund.findUnique({ where: { groupId } })
  if (!fund) return c.json({ error: 'Nhóm chưa bật quỹ' }, 400)

  await prisma.groupFund.update({
    where: { groupId },
    data: { lowThreshold: new Prisma.Decimal(parsed.data.lowThreshold) },
  })
  const act = await actorSnapshot(prisma, userId)
  await writeGroupActivityLog(prisma, {
    groupId,
    actorUserId: userId,
    actorName: act.name,
    actorEmail: act.email,
    action: 'FUND_THRESHOLD_UPDATED',
    summary: `${act.name} (${act.email}) cập nhật ngưỡng cảnh báo quỹ → ${formatVndForSummary(parsed.data.lowThreshold)}`,
    targetType: 'FUND',
    targetId: fund.id,
  })
  return c.json({ data: { ok: true } })
})

groupRoutes.post('/:groupId/fund', async (c) => {
  const userId = c.get('userId')
  const groupId = c.req.param('groupId')
  const w = await resolveGroupWriteAccess(c, groupId)
  if (!w.ok) return w.response
  if (w.m.role !== 'LEADER') return c.json({ error: 'Chỉ trưởng nhóm' }, 403)

  const existing = await prisma.groupFund.findUnique({ where: { groupId } })
  if (existing) return c.json({ error: 'Quỹ đã tồn tại' }, 409)

  const created = await prisma.groupFund.create({
    data: { groupId, balance: 0, lowThreshold: 0 },
  })
  const actF = await actorSnapshot(prisma, userId)
  await writeGroupActivityLog(prisma, {
    groupId,
    actorUserId: userId,
    actorName: actF.name,
    actorEmail: actF.email,
    action: 'FUND_ENABLED',
    summary: `${actF.name} (${actF.email}) bật quỹ nhóm`,
    targetType: 'FUND',
    targetId: created.id,
  })
  return c.json({ data: { ok: true } })
})

groupRoutes.post('/:groupId/fund/contribute', async (c) => {
  const userId = c.get('userId')
  const groupId = c.req.param('groupId')
  const w = await resolveGroupWriteAccess(c, groupId)
  if (!w.ok) return w.response

  let body: unknown
  try {
    body = await c.req.json()
  } catch {
    return c.json({ error: 'Invalid JSON' }, 400)
  }
  const parsed = contributeFundSchema.safeParse(body)
  if (!parsed.success) {
    return c.json({ error: parsed.error.issues[0]?.message ?? 'Dữ liệu không hợp lệ' }, 400)
  }

  const fund = await prisma.groupFund.findUnique({ where: { groupId } })
  if (!fund) return c.json({ error: 'Không có quỹ' }, 404)

  const amount = new Prisma.Decimal(parsed.data.amount)
  const tx = await prisma.fundTransaction.create({
    data: {
      fundId: fund.id,
      userId,
      type: 'CONTRIBUTE',
      amount,
      note: parsed.data.note?.trim() ?? null,
      contributionStatus: 'PENDING',
      proofImageUrls: parsed.data.proofImageUrls,
    },
  })

  const contr = await actorSnapshot(prisma, userId)
  const note = parsed.data.note?.trim()

  const [groupMeta, reviewerMembers] = await Promise.all([
    prisma.group.findUnique({ where: { id: groupId }, select: { name: true } }),
    prisma.groupMember.findMany({
      where: {
        groupId,
        role: { in: ['LEADER', 'VICE_LEADER'] },
        ...activeMemberWhere,
      },
      select: { userId: true },
    }),
  ])
  const reviewerIds = [...new Set(reviewerMembers.map((m) => m.userId))].filter(
    (id) => id !== userId,
  )
  if (reviewerIds.length > 0) {
    const groupLabel = groupMeta?.name ?? 'Nhóm'
    const amountLabel = formatVndForSummary(amount)
    await prisma.notification.createMany({
      data: reviewerIds.map((uid) => ({
        userId: uid,
        type: 'FUND_CONTRIBUTED' as const,
        title: `${contr.name} gửi nộp quỹ (${groupLabel})`,
        body: `Số tiền ${amountLabel} — có ảnh chứng từ, chờ bạn duyệt trên trang quỹ nhóm.`,
        data: {
          groupId,
          transactionId: tx.id,
          kind: 'fund_contribution_pending',
        },
      })),
    })
  }

  await writeGroupActivityLog(prisma, {
    groupId,
    actorUserId: userId,
    actorName: contr.name,
    actorEmail: contr.email,
    action: 'FUND_CONTRIBUTION_PENDING',
    summary: `${contr.name} (${contr.email}) gửi nộp quỹ ${formatVndForSummary(amount)} — chờ trưởng/phó nhóm hoặc quản trị duyệt${note ? ` — ghi chú: ${note}` : ''}`,
    targetType: 'FUND',
    targetId: fund.id,
    metadata: { amount: String(amount) },
  })

  const payload = await buildFundResponsePayload(fund.id, userId)
  if (!payload) return c.json({ error: 'Lỗi' }, 500)
  return c.json({ data: payload })
})

groupRoutes.post('/:groupId/fund/contributions/:transactionId/approve', async (c) => {
  const userId = c.get('userId')
  const groupId = c.req.param('groupId')
  const transactionId = c.req.param('transactionId')
  const gate = await resolveFundContributionReviewer(c, groupId)
  if (!gate.ok) return gate.response

  const fund = await prisma.groupFund.findUnique({ where: { groupId } })
  if (!fund) return c.json({ error: 'Không có quỹ' }, 404)

  const tx = await prisma.fundTransaction.findFirst({
    where: { id: transactionId, fundId: fund.id, type: 'CONTRIBUTE' },
    include: { user: { select: { id: true, name: true } } },
  })
  if (!tx) return c.json({ error: 'Không tìm thấy giao dịch' }, 404)
  if (tx.contributionStatus !== 'PENDING') {
    return c.json({ error: 'Giao dịch không chờ duyệt' }, 400)
  }
  const userRole = c.get('userRole') as string
  if (tx.userId === gate.reviewerUserId && userRole !== 'ADMIN') {
    return c.json({ error: 'Không thể tự duyệt giao dịch của chính mình' }, 403)
  }

  const now = new Date()
  await prisma.$transaction([
    prisma.fundTransaction.update({
      where: { id: tx.id },
      data: {
        contributionStatus: 'APPROVED',
        reviewedByUserId: gate.reviewerUserId,
        reviewedAt: now,
        reviewNote: null,
      },
    }),
    prisma.groupFund.update({
      where: { id: fund.id },
      data: { balance: { increment: tx.amount } },
    }),
  ])

  const reviewer = await actorSnapshot(prisma, gate.reviewerUserId)
  await writeGroupActivityLog(prisma, {
    groupId,
    actorUserId: gate.reviewerUserId,
    actorName: reviewer.name,
    actorEmail: reviewer.email,
    action: 'FUND_CONTRIBUTION_APPROVED',
    summary: `${reviewer.name} (${reviewer.email}) đã duyệt nộp quỹ ${formatVndForSummary(tx.amount)} của ${tx.user.name}`,
    targetType: 'FUND',
    targetId: fund.id,
    metadata: { transactionId: tx.id, amount: String(tx.amount) },
  })

  const payload = await buildFundResponsePayload(fund.id, userId)
  if (!payload) return c.json({ error: 'Lỗi' }, 500)
  return c.json({ data: payload })
})

groupRoutes.post('/:groupId/fund/contributions/:transactionId/reject', async (c) => {
  const userId = c.get('userId')
  const groupId = c.req.param('groupId')
  const transactionId = c.req.param('transactionId')
  const gate = await resolveFundContributionReviewer(c, groupId)
  if (!gate.ok) return gate.response

  let body: unknown
  try {
    body = await c.req.json()
  } catch {
    body = {}
  }
  const parsed = rejectFundContributionSchema.safeParse(body)
  if (!parsed.success) {
    return c.json({ error: parsed.error.issues[0]?.message ?? 'Dữ liệu không hợp lệ' }, 400)
  }

  const fund = await prisma.groupFund.findUnique({ where: { groupId } })
  if (!fund) return c.json({ error: 'Không có quỹ' }, 404)

  const tx = await prisma.fundTransaction.findFirst({
    where: { id: transactionId, fundId: fund.id, type: 'CONTRIBUTE' },
    include: { user: { select: { id: true, name: true } } },
  })
  if (!tx) return c.json({ error: 'Không tìm thấy giao dịch' }, 404)
  if (tx.contributionStatus !== 'PENDING') {
    return c.json({ error: 'Giao dịch không chờ duyệt' }, 400)
  }
  const userRole = c.get('userRole') as string
  if (tx.userId === gate.reviewerUserId && userRole !== 'ADMIN') {
    return c.json({ error: 'Không thể tự từ chối giao dịch của chính mình' }, 403)
  }

  const now = new Date()
  await prisma.fundTransaction.update({
    where: { id: tx.id },
    data: {
      contributionStatus: 'REJECTED',
      reviewedByUserId: gate.reviewerUserId,
      reviewedAt: now,
      reviewNote: parsed.data.note?.trim() || null,
    },
  })

  const reviewer = await actorSnapshot(prisma, gate.reviewerUserId)
  await writeGroupActivityLog(prisma, {
    groupId,
    actorUserId: gate.reviewerUserId,
    actorName: reviewer.name,
    actorEmail: reviewer.email,
    action: 'FUND_CONTRIBUTION_REJECTED',
    summary: `${reviewer.name} (${reviewer.email}) đã từ chối nộp quỹ ${formatVndForSummary(tx.amount)} của ${tx.user.name}`,
    targetType: 'FUND',
    targetId: fund.id,
    metadata: { transactionId: tx.id, amount: String(tx.amount) },
  })

  const payload = await buildFundResponsePayload(fund.id, userId)
  if (!payload) return c.json({ error: 'Lỗi' }, 500)
  return c.json({ data: payload })
})

groupRoutes.post('/:groupId/invite/regenerate', async (c) => {
  const userId = c.get('userId')
  const groupId = c.req.param('groupId')
  const w = await resolveGroupWriteAccess(c, groupId)
  if (!w.ok) return w.response
  if (w.m.role !== 'LEADER') return c.json({ error: 'Chỉ trưởng nhóm' }, 403)

  let code = newInviteCodeCandidate()
  for (let i = 0; i < 12; i++) {
    const clash = await prisma.group.findUnique({ where: { inviteCode: code } })
    if (!clash) break
    code = newInviteCodeCandidate()
  }

  const g = await prisma.group.update({
    where: { id: groupId },
    data: { inviteCode: code, inviteExpires: null },
    include: {
      fund: true,
      _count: { select: { members: { where: { ...activeMemberWhere } } } },
    },
  })
  const membership = await prisma.groupMember.findFirst({
    where: { groupId, userId, ...activeMemberWhere },
  })
  const reg = await actorSnapshot(prisma, userId)
  await writeGroupActivityLog(prisma, {
    groupId,
    actorUserId: userId,
    actorName: reg.name,
    actorEmail: reg.email,
    action: 'INVITE_CODE_REGENERATED',
    summary: `${reg.name} (${reg.email}) tạo lại mã mời nhóm`,
    targetType: 'GROUP',
    targetId: groupId,
  })
  return c.json({
    data: await toGroupDto(
      g,
      membership?.role ?? 'MEMBER',
      g._count.members,
      g.fund ? fundBalanceString(g.fund.balance) : null,
      fundLowThresholdString(g.fund),
      userId,
    ),
  })
})

groupRoutes.patch('/:groupId/invite/toggle', async (c) => {
  const userId = c.get('userId')
  const groupId = c.req.param('groupId')
  const w = await resolveGroupWriteAccess(c, groupId)
  if (!w.ok) return w.response
  if (w.m.role !== 'LEADER') return c.json({ error: 'Chỉ trưởng nhóm' }, 403)

  let body: unknown
  try {
    body = await c.req.json()
  } catch {
    return c.json({ error: 'Invalid JSON' }, 400)
  }
  const parsed = z.object({ enabled: z.boolean() }).safeParse(body)
  if (!parsed.success) {
    return c.json({ error: parsed.error.issues[0]?.message ?? 'Dữ liệu không hợp lệ' }, 400)
  }

  const g = await prisma.group.update({
    where: { id: groupId },
    data: { inviteEnabled: parsed.data.enabled },
    include: {
      fund: true,
      _count: { select: { members: { where: { ...activeMemberWhere } } } },
    },
  })
  const tg = await actorSnapshot(prisma, userId)
  await writeGroupActivityLog(prisma, {
    groupId,
    actorUserId: userId,
    actorName: tg.name,
    actorEmail: tg.email,
    action: 'INVITE_TOGGLED',
    summary: `${tg.name} (${tg.email}) ${parsed.data.enabled ? 'bật' : 'tắt'} mã mời nhóm`,
    targetType: 'GROUP',
    targetId: groupId,
  })
  return c.json({
    data: await toGroupDto(
      g,
      'LEADER',
      g._count.members,
      g.fund ? fundBalanceString(g.fund.balance) : null,
      fundLowThresholdString(g.fund),
      userId,
    ),
  })
})

groupRoutes.patch('/:groupId', async (c) => {
  const userId = c.get('userId')
  const groupId = c.req.param('groupId')
  const w = await resolveGroupWriteAccess(c, groupId)
  if (!w.ok) return w.response
  if (w.m.role !== 'LEADER') return c.json({ error: 'Chỉ trưởng nhóm' }, 403)

  let body: unknown
  try {
    body = await c.req.json()
  } catch {
    return c.json({ error: 'Invalid JSON' }, 400)
  }
  const parsed = updateGroupSchema.safeParse(body)
  if (!parsed.success) {
    return c.json({ error: parsed.error.issues[0]?.message ?? 'Dữ liệu không hợp lệ' }, 400)
  }

  const g = await prisma.group.update({
    where: { id: groupId },
    data: {
      ...(parsed.data.name != null ? { name: parsed.data.name.trim() } : {}),
      ...(parsed.data.description !== undefined
        ? { description: parsed.data.description?.trim() ?? null }
        : {}),
      ...(parsed.data.avatarUrl !== undefined ? { avatarUrl: parsed.data.avatarUrl } : {}),
      ...(parsed.data.icon !== undefined ? { icon: parsed.data.icon?.trim() ?? null } : {}),
      ...(parsed.data.color !== undefined ? { color: parsed.data.color?.trim() ?? null } : {}),
      ...(parsed.data.requireApproval !== undefined
        ? { requireApproval: parsed.data.requireApproval }
        : {}),
      ...(parsed.data.debtReminderEnabled !== undefined
        ? { debtReminderEnabled: parsed.data.debtReminderEnabled }
        : {}),
      ...(parsed.data.debtReminderDays !== undefined
        ? { debtReminderDays: parsed.data.debtReminderDays }
        : {}),
    },
    include: {
      fund: true,
      _count: { select: { members: { where: { ...activeMemberWhere } } } },
    },
  })
  const parts: string[] = []
  if (parsed.data.name != null) parts.push('tên nhóm')
  if (parsed.data.description !== undefined) parts.push('mô tả')
  if (parsed.data.avatarUrl !== undefined) parts.push('ảnh đại diện')
  if (parsed.data.icon !== undefined) parts.push('biểu tượng')
  if (parsed.data.color !== undefined) parts.push('màu')
  if (parsed.data.requireApproval !== undefined) parts.push('duyệt thành viên')
  const gu = await actorSnapshot(prisma, userId)
  await writeGroupActivityLog(prisma, {
    groupId,
    actorUserId: userId,
    actorName: gu.name,
    actorEmail: gu.email,
    action: 'GROUP_UPDATED',
    summary: `${gu.name} (${gu.email}) cập nhật nhóm: ${parts.length ? parts.join(', ') : 'thông tin'}`,
    targetType: 'GROUP',
    targetId: groupId,
  })
  return c.json({
    data: await toGroupDto(
      g,
      'LEADER',
      g._count.members,
      g.fund ? fundBalanceString(g.fund.balance) : null,
      fundLowThresholdString(g.fund),
      userId,
    ),
  })
})

groupRoutes.delete('/:groupId', async (c) => {
  const userId = c.get('userId')
  const groupId = c.req.param('groupId')
  const w = await resolveGroupWriteAccess(c, groupId)
  if (!w.ok) return w.response
  if (w.m.role !== 'LEADER') return c.json({ error: 'Chỉ trưởng nhóm' }, 403)

  await prisma.group.delete({ where: { id: groupId } })
  return c.json({ data: { ok: true } })
})

groupRoutes.get('/:groupId/fund', async (c) => {
  const userId = c.get('userId')
  const groupId = c.req.param('groupId')
  const access = await resolveGroupReadAccess(c, groupId)
  if (!access.ok) {
    const userRole = c.get('userRole') as string
    if (userRole === 'ADMIN') return access.response
    const fr = await prisma.groupMember.findFirst({
      where: {
        groupId,
        userId,
        user: { isActive: true },
        role: { in: ['LEADER', 'VICE_LEADER'] },
      },
    })
    const g = await prisma.group.findUnique({ where: { id: groupId } })
    if (!fr || !g?.isActive) return access.response
  }
  const fund = await prisma.groupFund.findUnique({ where: { groupId } })
  if (!fund) return c.json({ error: 'Không có quỹ' }, 404)
  const payload = await buildFundResponsePayload(fund.id, userId)
  if (!payload) return c.json({ error: 'Lỗi' }, 500)
  return c.json({ data: payload })
})

groupRoutes.get('/:groupId', async (c) => {
  const userId = c.get('userId')
  const groupId = c.req.param('groupId')
  const access = await resolveGroupReadAccess(c, groupId)
  if (!access.ok) return access.response
  const { group, m, adminViewer } = access
  const myRole = adminViewer ? 'MEMBER' : m!.role
  const base = await toGroupDto(
    group,
    myRole,
    group._count.members,
    group.fund ? fundBalanceString(group.fund.balance) : null,
    fundLowThresholdString(group.fund),
    userId,
    adminViewer ? { adminViewer: true } : undefined,
  )
  let unsettled: { myUnsettledDebt: string; myUnsettledCredit: string } | undefined
  if (!adminViewer && m) {
    const net = await unsettledSharedNetBalance(groupId, userId)
    let myUnsettledDebt = '0.00'
    let myUnsettledCredit = '0.00'
    if (net.lt(UNSETTLED_NET_EPS.neg())) myUnsettledDebt = net.neg().toFixed(2)
    else if (net.gt(UNSETTLED_NET_EPS)) myUnsettledCredit = net.toFixed(2)
    unsettled = { myUnsettledDebt, myUnsettledCredit }
  }
  return c.json({ data: { ...base, ...unsettled } })
})
