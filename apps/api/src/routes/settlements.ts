import { Prisma, prisma } from '@expense/database'
import type { GroupMember } from '@expense/database'
import {
  acceptPaymentSchema,
  confirmPaymentSchema,
  createSettlementSchema,
  settlementPreviewSchema,
} from '@expense/types'
import type {
  PaymentRecordDto,
  SettlementDto,
  SettlementExpenseInBatchDto,
  SettlementPreviewDto,
  SettlementPreviewExpenseItem,
  SettlementSummary,
} from '@expense/types'
import { Hono } from 'hono'
import { clearGroupFundLedger } from '../lib/clear-group-fund.js'
import { formatVndForSummary } from '../lib/format-vnd.js'
import { actorSnapshot, writeGroupActivityLog } from '../lib/group-activity-log.js'
import { findGroupLeaderIncludingFormer, runGroupSubresourceGate } from '../lib/group-gate.js'
import { signedStorageUrlForUser } from '../lib/minio.js'
import { computeGroupSettlementPreview } from '../lib/settlement-compute.js'
import { requireAuth } from '../middleware/auth.js'

const activeMemberWhere = { isActive: true, leftAt: null } as const

/** Chỉ user id còn tài khoản hoạt động — không gửi thông báo tổng kết tới tài khoản đã khoá/xoá. */
async function activeUserIdSet(ids: string[]): Promise<Set<string>> {
  if (ids.length === 0) return new Set()
  const rows = await prisma.user.findMany({
    where: { id: { in: ids }, isActive: true },
    select: { id: true },
  })
  return new Set(rows.map((r) => r.id))
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

function periodExpensesTotalFromSummary(summary: SettlementSummary | null | undefined): string {
  if (summary?.periodExpensesTotal) return summary.periodExpensesTotal
  const ex = summary?.expenses
  if (ex?.length) {
    const n = ex.reduce((s, e) => s + (Number.parseFloat(e.amount) || 0), 0)
    return n.toFixed(2)
  }
  return '0'
}

async function toSettlementDto(
  s: {
    id: string
    groupId: string
    title: string
    periodStart: Date
    periodEnd: Date
    totalAmount: Prisma.Decimal
    status: string
    summaryData: unknown
    receiverUserId: string
    completedAt: Date | null
    createdAt: Date
    paymentRecords: Array<{
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
    }>
  },
  viewerUserId: string,
): Promise<SettlementDto> {
  const receiver = await prisma.user.findUnique({
    where: { id: s.receiverUserId },
    select: { id: true, name: true, avatarUrl: true },
  })
  const receiverAvatar = receiver?.avatarUrl
    ? await signedStorageUrlForUser(receiver.avatarUrl, viewerUserId)
    : null

  const paymentRecords: PaymentRecordDto[] = await Promise.all(
    s.paymentRecords.map(async (rec) => {
      const dto = toPaymentRecordDto(rec)
      const [payerAv, recvAv] = await Promise.all([
        signedStorageUrlForUser(dto.payer.avatarUrl, viewerUserId),
        signedStorageUrlForUser(dto.receiver.avatarUrl, viewerUserId),
      ])
      return {
        ...dto,
        payer: { ...dto.payer, avatarUrl: payerAv },
        receiver: { ...dto.receiver, avatarUrl: recvAv },
      }
    }),
  )

  const summary = s.summaryData as SettlementSummary
  return {
    id: s.id,
    groupId: s.groupId,
    title: s.title,
    periodStart: s.periodStart.toISOString(),
    periodEnd: s.periodEnd.toISOString(),
    totalAmount: String(s.totalAmount),
    periodExpensesTotal: periodExpensesTotalFromSummary(summary),
    status: s.status,
    summaryData: summary,
    receiver: receiver
      ? { id: receiver.id, name: receiver.name, avatarUrl: receiverAvatar }
      : { id: s.receiverUserId, name: '', avatarUrl: null },
    paymentRecords,
    completedAt: s.completedAt?.toISOString() ?? null,
    createdAt: s.createdAt.toISOString(),
  }
}

async function settlementExpensesForDetail(
  groupId: string,
  settlementId: string,
  summaryData: unknown,
): Promise<SettlementExpenseInBatchDto[]> {
  const linked = await prisma.expense.findMany({
    where: { groupId, settlementId, isStandalone: false },
    orderBy: [{ expenseDate: 'desc' }, { createdAt: 'desc' }],
    take: 500,
    include: { paidBy: { select: { id: true, name: true } } },
  })
  if (linked.length > 0) {
    return linked.map((e) => ({
      id: e.id,
      title: e.title,
      amount: String(e.amount),
      expenseDate: e.expenseDate.toISOString(),
      paidBy: { id: e.paidBy.id, name: e.paidBy.name },
      status: e.status,
      fromLiveDb: true,
    }))
  }
  const snap = summaryData as SettlementSummary
  const fallback = snap?.expenses
  if (!fallback?.length) return []
  return fallback.map((row: SettlementPreviewExpenseItem) => ({ ...row, fromLiveDb: false }))
}

export const groupSettlementRoutes = new Hono<{
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

groupSettlementRoutes.use('*', requireAuth)
groupSettlementRoutes.use('*', async (c, next) => {
  const gid = c.req.param('groupId')
  if (!gid) return c.json({ error: 'Thiếu nhóm' }, 400)
  c.set('groupId', gid)
  const blocked = await runGroupSubresourceGate(c, gid)
  if (blocked) return blocked
  await next()
})

const payInclude = {
  payer: { select: { id: true, name: true, avatarUrl: true } },
  receiver: { select: { id: true, name: true, avatarUrl: true } },
} as const

groupSettlementRoutes.post('/preview', async (c) => {
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
  const parsed = settlementPreviewSchema.safeParse(body)
  if (!parsed.success) {
    return c.json({ error: parsed.error.issues[0]?.message ?? 'Dữ liệu không hợp lệ' }, 400)
  }

  const start = new Date(parsed.data.periodStart)
  const end = new Date(parsed.data.periodEnd)
  const preview = await computeGroupSettlementPreview(groupId, start, end)

  const data: SettlementPreviewDto = {
    balances: preview.balances,
    transactions: preview.transactions,
    suggestedReceiver: preview.suggestedReceiver,
    receiverCandidateUserIds: preview.receiverCandidateUserIds,
    totalAmount: String(preview.totalAmount),
    periodExpensesTotal: String(preview.periodExpensesTotal),
    expenseCount: preview.expenseCount,
    expenses: preview.expenses,
  }
  return c.json({ data })
})

groupSettlementRoutes.get('/', async (c) => {
  const userId = c.get('userId')
  const groupId = c.get('groupId')
  const m = c.get('groupMember')
  const adminBrowse = c.get('adminGroupBrowse')
  if (!m && !adminBrowse) return c.json({ error: 'Không tìm thấy nhóm' }, 404)

  const rows = await prisma.settlement.findMany({
    where: { groupId },
    orderBy: { createdAt: 'desc' },
    include: {
      paymentRecords: { include: payInclude },
    },
  })
  const data: SettlementDto[] = await Promise.all(rows.map((s) => toSettlementDto(s, userId)))
  return c.json({ data })
})

groupSettlementRoutes.post('/', async (c) => {
  const userId = c.get('userId')
  const groupId = c.get('groupId')
  const leader = await prisma.groupMember.findFirst({
    where: { groupId, userId, ...activeMemberWhere, role: 'LEADER' },
  })
  if (!leader) return c.json({ error: 'Chỉ trưởng nhóm tạo tổng kết' }, 403)

  let body: unknown
  try {
    body = await c.req.json()
  } catch {
    return c.json({ error: 'Invalid JSON' }, 400)
  }
  const parsed = createSettlementSchema.safeParse(body)
  if (!parsed.success) {
    return c.json({ error: parsed.error.issues[0]?.message ?? 'Dữ liệu không hợp lệ' }, 400)
  }

  const start = new Date(parsed.data.periodStart)
  const end = new Date(parsed.data.periodEnd)

  let settlement
  try {
    settlement = await prisma.$transaction(async (tx) => {
      const preview = await computeGroupSettlementPreview(groupId, start, end, tx)

      const receiverOk = await tx.groupMember.findFirst({
        where: { groupId, userId: parsed.data.receiverUserId, user: { isActive: true } },
      })
      if (!receiverOk) {
        throw new Error('__SETTLEMENT_BAD_RECEIVER__')
      }

      if (
        preview.receiverCandidateUserIds.length > 0 &&
        !preview.receiverCandidateUserIds.includes(parsed.data.receiverUserId)
      ) {
        throw new Error('__SETTLEMENT_BAD_RECEIVER_SCOPE__')
      }

      const summary: SettlementSummary = {
        balances: preview.balances,
        transactions: preview.transactions,
        expenses: preview.expenses,
        periodExpensesTotal: String(preview.periodExpensesTotal),
      }

      const s = await tx.settlement.create({
        data: {
          groupId,
          title: parsed.data.title.trim(),
          periodStart: start,
          periodEnd: end,
          receiverUserId: parsed.data.receiverUserId,
          totalAmount: preview.totalAmount,
          status: 'PENDING',
          summaryData: summary as object,
          paymentRecords: {
            create: preview.transactions.map((t) => ({
              payerUserId: t.fromUserId,
              receiverUserId: t.toUserId,
              amount: new Prisma.Decimal(t.amount),
              status: 'PENDING' as const,
            })),
          },
        },
        include: {
          paymentRecords: { include: payInclude },
        },
      })

      const expenseIds = preview.expenses.map((e) => e.id)
      if (expenseIds.length > 0) {
        const n = await tx.expense.updateMany({
          where: { id: { in: expenseIds }, groupId, settlementId: null },
          data: { settlementId: s.id },
        })
        if (n.count !== expenseIds.length) {
          throw new Error('__SETTLEMENT_EXPENSE_CONFLICT__')
        }
      }

      /** Không có luồng chuyển tiền → đóng đợt ngay, khoá chi, làm sạch quỹ (cùng kỳ mới). */
      if (preview.transactions.length === 0) {
        const completeNow = new Date()
        await tx.settlement.update({
          where: { id: s.id },
          data: { status: 'COMPLETED', completedAt: completeNow },
        })
        await tx.expense.updateMany({
          where: {
            groupId,
            settlementId: s.id,
            status: 'ACTIVE',
            isStandalone: false,
          },
          data: { status: 'SETTLED' },
        })
        const { hadFund, deletedCount } = await clearGroupFundLedger(tx, groupId)
        const snapDone = await actorSnapshot(tx, userId)
        const fundPart = hadFund ? `; quỹ đã làm sạch (${deletedCount} bản ghi), số dư về 0` : ''
        await writeGroupActivityLog(tx, {
          groupId,
          actorUserId: userId,
          actorName: snapDone.name,
          actorEmail: snapDone.email,
          action: 'SETTLEMENT_COMPLETED',
          summary: `${snapDone.name} (${snapDone.email}) — đợt «${parsed.data.title.trim()}» đóng ngay (không có luồng chuyển tiền); chi trong đợt chuyển sang đã tổng kết${fundPart}`,
          targetType: 'SETTLEMENT',
          targetId: s.id,
        })
      }

      const stTitle = parsed.data.title.trim()
      const notifyUserIds = preview.receiverCandidateUserIds
      const [group, leaderUser, recipients] = await Promise.all([
        tx.group.findUnique({ where: { id: groupId }, select: { name: true } }),
        tx.user.findUnique({ where: { id: userId }, select: { name: true } }),
        notifyUserIds.length === 0
          ? Promise.resolve([] as { userId: string }[])
          : tx.groupMember.findMany({
              where: {
                groupId,
                userId: { not: userId, in: notifyUserIds },
                user: { isActive: true },
              },
              select: { userId: true },
            }),
      ])
      if (recipients.length > 0) {
        const leaderName = leaderUser?.name ?? 'Trưởng nhóm'
        const groupName = group?.name ?? 'nhóm'
        const bodyNoTransfers =
          preview.transactions.length === 0
            ? `${leaderName} vừa tạo và đóng đợt tổng kết «${stTitle}» trong nhóm «${groupName}» (không có chuyển tiền giữa thành viên; quỹ kỳ đã được xử lý nếu có).`
            : `${leaderName} vừa tạo đợt tổng kết «${stTitle}» trong nhóm «${groupName}». Mở chi tiết để xem khoản cần thanh toán.`
        await tx.notification.createMany({
          data: recipients.map((r) => ({
            userId: r.userId,
            type: 'SETTLEMENT_CREATED' as const,
            title: `Đợt tổng kết mới: ${stTitle}`,
            body: bodyNoTransfers,
            settlementId: s.id,
            data: { groupId, settlementId: s.id },
          })),
        })
      }

      const snap = await actorSnapshot(tx, userId)
      const periodLabel = `${start.toLocaleDateString('vi-VN')} — ${end.toLocaleDateString('vi-VN')}`
      await writeGroupActivityLog(tx, {
        groupId,
        actorUserId: userId,
        actorName: snap.name,
        actorEmail: snap.email,
        action: 'SETTLEMENT_CREATED',
        summary: `${snap.name} (${snap.email}) tạo đợt tổng kết «${stTitle}» (${periodLabel}), ${preview.expenseCount} khoản chi, tổng bill ${formatVndForSummary(preview.periodExpensesTotal)}, luồng quyết toán ${formatVndForSummary(preview.totalAmount)}`,
        targetType: 'SETTLEMENT',
        targetId: s.id,
        metadata: { receiverUserId: parsed.data.receiverUserId },
      })

      return s
    })
  } catch (e) {
    if (e instanceof Error) {
      if (e.message === '__SETTLEMENT_BAD_RECEIVER__') {
        return c.json(
          {
            error:
              'Người nhận không hợp lệ — cần từng là thành viên nhóm và tài khoản còn hoạt động.',
          },
          400,
        )
      }
      if (e.message === '__SETTLEMENT_BAD_RECEIVER_SCOPE__') {
        return c.json(
          {
            error:
              'Người nhận quỹ phải là người tham gia chi tiêu hoặc luồng chuyển tiền trong kỳ tổng kết này.',
          },
          400,
        )
      }
      if (e.message === '__SETTLEMENT_EXPENSE_CONFLICT__') {
        return c.json(
          {
            error: 'Một số chi tiêu vừa được gán đợt tổng kết khác. Làm mới xem trước rồi thử lại.',
          },
          409,
        )
      }
    }
    throw e
  }

  return c.json({ data: await toSettlementDto(settlement, userId) })
})

/** Trưởng nhóm nhắc các người trả còn PENDING/REJECTED (đã CONFIRMED/ACCEPTED thì bỏ qua). */
groupSettlementRoutes.post('/:settlementId/notify-pending-payers', async (c) => {
  const userId = c.get('userId')
  const groupId = c.get('groupId')
  const settlementId = c.req.param('settlementId')
  const leader = await prisma.groupMember.findFirst({
    where: { groupId, userId, ...activeMemberWhere, role: 'LEADER' },
  })
  if (!leader) return c.json({ error: 'Chỉ trưởng nhóm mới gửi nhắc hàng loạt được' }, 403)

  const settlement = await prisma.settlement.findFirst({
    where: { id: settlementId, groupId },
    include: { paymentRecords: true },
  })
  if (!settlement) return c.json({ error: 'Không tìm thấy' }, 404)
  if (settlement.status === 'COMPLETED') {
    return c.json({ error: 'Đợt tổng kết đã hoàn thành' }, 400)
  }

  const targetPayerIds = new Set<string>()
  for (const rec of settlement.paymentRecords) {
    if (rec.status === 'PENDING' || rec.status === 'REJECTED') {
      targetPayerIds.add(rec.payerUserId)
    }
  }
  if (targetPayerIds.size === 0) {
    return c.json({ error: 'Không còn người chờ nộp chứng từ / thanh toán' }, 400)
  }

  const activePayers = await activeUserIdSet([...targetPayerIds])
  const notifyIds = [...targetPayerIds].filter((id) => activePayers.has(id))
  if (notifyIds.length === 0) {
    return c.json(
      {
        error: 'Không gửi được nhắc — các tài khoản người trả đã bị vô hiệu hoá.',
      },
      400,
    )
  }

  const stTitle = settlement.title
  const body = `Trưởng nhóm nhắc bạn hoàn tất khoản trong đợt tổng kết «${stTitle}» (nộp chứng từ hoặc làm theo bước trên trang chi tiết).`

  await Promise.all(
    notifyIds.map((uid) =>
      prisma.notification.create({
        data: {
          userId: uid,
          type: 'PAYMENT_REQUEST',
          title: 'Nhắc thanh toán tổng kết',
          body,
          settlementId,
          data: {
            groupId,
            settlementId,
            kind: 'settlement_notify_payers',
          },
        },
      }),
    ),
  )

  return c.json({ data: { ok: true, notified: notifyIds.length } })
})

groupSettlementRoutes.get('/:settlementId', async (c) => {
  const userId = c.get('userId')
  const groupId = c.get('groupId')
  const settlementId = c.req.param('settlementId')
  const m = c.get('groupMember')
  const adminBrowse = c.get('adminGroupBrowse')
  if (!m && !adminBrowse) return c.json({ error: 'Không tìm thấy nhóm' }, 404)

  const s = await prisma.settlement.findFirst({
    where: { id: settlementId, groupId },
    include: { paymentRecords: { include: payInclude } },
  })
  if (!s) return c.json({ error: 'Không tìm thấy' }, 404)
  const base = await toSettlementDto(s, userId)
  const settlementExpenses = await settlementExpensesForDetail(groupId, settlementId, s.summaryData)
  const data: SettlementDto = { ...base, settlementExpenses }
  return c.json({ data })
})

groupSettlementRoutes.post('/:settlementId/payments/:paymentRecordId/confirm', async (c) => {
  const userId = c.get('userId')
  const groupId = c.get('groupId')
  const settlementId = c.req.param('settlementId')
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
    where: { id: paymentRecordId, settlementId },
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

groupSettlementRoutes.post(
  '/:settlementId/payments/:paymentRecordId/reopen-after-reject',
  async (c) => {
    const userId = c.get('userId')
    const groupId = c.get('groupId')
    const settlementId = c.req.param('settlementId')
    const paymentRecordId = c.req.param('paymentRecordId')
    const m = c.get('groupMember')
    if (!m) return c.json({ error: 'Không tìm thấy nhóm' }, 404)

    const rec = await prisma.paymentRecord.findFirst({
      where: { id: paymentRecordId, settlementId },
      include: {
        settlement: { select: { title: true } },
        payer: { select: { name: true } },
      },
    })
    if (!rec) return c.json({ error: 'Không tìm thấy' }, 404)
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
      const payerOk = await prisma.user.findFirst({
        where: { id: rec.payerUserId, isActive: true },
        select: { id: true },
      })
      if (payerOk) {
        await prisma.notification.create({
          data: {
            userId: rec.payerUserId,
            type: 'PAYMENT_REQUEST',
            title: 'Yêu cầu thanh toán lại (tổng kết)',
            body: `Trưởng nhóm yêu cầu bạn nộp lại chứng từ cho khoản trong «${rec.settlement?.title ?? 'tổng kết'}».`,
            settlementId,
            data: {
              groupId,
              settlementId,
              paymentRecordId: rec.id,
              kind: 'settlement_reopen',
            },
          },
        })
      }
    }

    return c.json({ data: { ok: true } })
  },
)

groupSettlementRoutes.post('/:settlementId/payments/:paymentRecordId/request-review', async (c) => {
  const userId = c.get('userId')
  const groupId = c.get('groupId')
  const settlementId = c.req.param('settlementId')
  const paymentRecordId = c.req.param('paymentRecordId')
  const m = c.get('groupMember')
  if (!m) return c.json({ error: 'Không tìm thấy nhóm' }, 404)

  const rec = await prisma.paymentRecord.findFirst({
    where: { id: paymentRecordId, settlementId },
    include: {
      payer: { select: { name: true } },
      settlement: { select: { title: true } },
    },
  })
  if (!rec) return c.json({ error: 'Không tìm thấy' }, 404)
  if (rec.payerUserId !== userId) return c.json({ error: 'Chỉ người trả mới gửi nhắc được' }, 403)
  if (rec.status !== 'CONFIRMED') return c.json({ error: 'Chỉ gửi nhắc khi đã nộp chứng từ' }, 400)

  const leaders = await prisma.groupMember.findMany({
    where: { groupId, role: 'LEADER', user: { isActive: true } },
    select: { userId: true },
  })
  const targets = new Set<string>([rec.receiverUserId, ...leaders.map((l) => l.userId)])
  targets.delete(userId)
  const activeTargets = await activeUserIdSet([...targets])
  const notifyIds = [...targets].filter((id) => activeTargets.has(id))
  if (notifyIds.length === 0) return c.json({ error: 'Không có người nhận thông báo' }, 400)

  const title = 'Nhắc xác nhận thanh toán (tổng kết)'
  const stTitle = rec.settlement?.title ?? 'Tổng kết'
  const body = `${rec.payer.name} nhờ bạn xem chứng từ và duyệt khoản trong «${stTitle}».`

  await Promise.all(
    notifyIds.map((uid) =>
      prisma.notification.create({
        data: {
          userId: uid,
          type: 'PAYMENT_REQUEST',
          title,
          body,
          settlementId,
          data: {
            groupId,
            settlementId,
            paymentRecordId: rec.id,
            kind: 'settlement',
          },
        },
      }),
    ),
  )

  return c.json({ data: { ok: true, notified: notifyIds.length } })
})

groupSettlementRoutes.post('/:settlementId/payments/accept', async (c) => {
  const userId = c.get('userId')
  const groupId = c.get('groupId')
  const settlementId = c.req.param('settlementId')

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
    where: { id: parsed.data.paymentRecordId, settlementId },
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
            'Người trả vui lòng nộp chứng từ chuyển khoản; không dùng xác nhận phía người nhận',
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

  const all = await prisma.paymentRecord.findMany({ where: { settlementId } })
  if (all.length > 0 && all.every((p) => p.status === 'ACCEPTED')) {
    const completionMeta = await prisma.$transaction(async (tx) => {
      const st = await tx.settlement.findUnique({ where: { id: settlementId } })
      await tx.settlement.update({
        where: { id: settlementId },
        data: { status: 'COMPLETED', completedAt: now },
      })
      if (!st) return null
      await tx.expense.updateMany({
        where: {
          groupId,
          settlementId,
          status: 'ACTIVE',
          isStandalone: false,
        },
        data: { status: 'SETTLED' },
      })
      const { hadFund, deletedCount } = await clearGroupFundLedger(tx, groupId)
      return { title: st.title, hadFund, deletedCount }
    })

    if (completionMeta) {
      const doneSnap = await actorSnapshot(prisma, userId)
      const fundPart = completionMeta.hadFund
        ? `; quỹ nhóm đã làm sạch (${completionMeta.deletedCount} bản ghi), số dư về 0 để bắt đầu kỳ mới`
        : ''
      await writeGroupActivityLog(prisma, {
        groupId,
        actorUserId: userId,
        actorName: doneSnap.name,
        actorEmail: doneSnap.email,
        action: 'SETTLEMENT_COMPLETED',
        summary: `${doneSnap.name} (${doneSnap.email}) xác nhận xong — đợt «${completionMeta.title}» đã đóng; các khoản chi trong đợt chuyển sang trạng thái đã tổng kết${fundPart}`,
        targetType: 'SETTLEMENT',
        targetId: settlementId,
      })
    }
  }

  return c.json({ data: { ok: true } })
})

/**
 * Trưởng nhóm xoá đợt tổng kết sớm / nhầm: chỉ khi chưa hoàn tất (PENDING/DRAFT), hoặc tổng 0đ.
 * Không xoá đợt COMPLETED có tổng > 0 (đã khóa chi). Có thể xoá dù đã có người chuyển/chờ duyệt.
 */
groupSettlementRoutes.delete('/:settlementId', async (c) => {
  const userId = c.get('userId')
  const groupId = c.get('groupId')
  const settlementId = c.req.param('settlementId')

  const leader = await prisma.groupMember.findFirst({
    where: { groupId, userId, ...activeMemberWhere, role: 'LEADER' },
  })
  if (!leader) return c.json({ error: 'Chỉ trưởng nhóm mới xoá được đợt tổng kết' }, 403)

  const st = await prisma.settlement.findFirst({
    where: { id: settlementId, groupId },
  })
  if (!st) return c.json({ error: 'Không tìm thấy' }, 404)

  const amount = new Prisma.Decimal(st.totalAmount)
  if (st.status === 'COMPLETED' && amount.gt(0)) {
    return c.json(
      {
        error:
          'Không xoá được đợt đã tổng kết xong (có số tiền). Chỉ xoá được đợt đang chờ hoặc đợt tổng 0 đồng.',
      },
      400,
    )
  }

  await prisma.$transaction(async (tx) => {
    await tx.notification.updateMany({
      where: { settlementId },
      data: { settlementId: null },
    })
    await tx.paymentRecord.deleteMany({ where: { settlementId } })
    const revertExpenseStatus = st.status === 'COMPLETED'
    await tx.expense.updateMany({
      where: { groupId, settlementId },
      data: {
        settlementId: null,
        ...(revertExpenseStatus ? { status: 'ACTIVE' } : {}),
      },
    })
    await tx.settlement.delete({ where: { id: settlementId } })
    const snap = await actorSnapshot(tx, userId)
    await writeGroupActivityLog(tx, {
      groupId,
      actorUserId: userId,
      actorName: snap.name,
      actorEmail: snap.email,
      action: 'SETTLEMENT_DELETED',
      summary: `${snap.name} (${snap.email}) xoá đợt tổng kết «${st.title}»`,
      targetType: 'SETTLEMENT',
      targetId: settlementId,
    })
  })

  return c.json({ data: { ok: true } })
})
