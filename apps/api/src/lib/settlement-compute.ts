import { Prisma, prisma } from '@expense/database'
import type { MemberBalance, SettlementPreviewExpenseItem, Transfer } from '@expense/types'

/** Thành viên nhóm (kể cả đã rời) miễn tài khoản User còn hoạt động — dùng cho tổng kết. */
const settlementParticipantMemberWhere = { user: { isActive: true } } as const

type SettlementPreviewDb = Pick<
  typeof prisma,
  'groupMember' | 'expense' | 'user' | 'groupFund' | 'fundTransaction'
>

export type ComputedSettlementPreview = {
  balances: MemberBalance[]
  transactions: Transfer[]
  suggestedReceiver: { id: string; name: string }
  receiverCandidateUserIds: string[]
  /** Tổng tiền các khoản chuyển trong luồng quyết toán tối giản (cộng từng dòng “ai trả ai”). */
  totalAmount: Prisma.Decimal
  /** Tổng tiền các khoản chi chung trong kỳ (cộng hết amount từng bill). */
  periodExpensesTotal: Prisma.Decimal
  expenseCount: number
  expenses: SettlementPreviewExpenseItem[]
}

/**
 * Nộp quỹ đã duyệt (theo reviewedAt) và khấu trừ quỹ (theo createdAt) trong [periodStart, periodEnd].
 */
async function fundNetByUserInPeriod(
  fundId: string,
  periodStart: Date,
  periodEnd: Date,
  db: Pick<typeof prisma, 'fundTransaction'>,
): Promise<Map<string, Prisma.Decimal>> {
  const out = new Map<string, Prisma.Decimal>()
  const add = (userId: string, delta: Prisma.Decimal) => {
    const cur = out.get(userId) ?? new Prisma.Decimal(0)
    out.set(userId, cur.add(delta))
  }

  const [deductRows, contributeRows] = await Promise.all([
    db.fundTransaction.findMany({
      where: {
        fundId,
        type: 'DEDUCT',
        createdAt: { gte: periodStart, lte: periodEnd },
      },
      select: { userId: true, amount: true },
    }),
    db.fundTransaction.findMany({
      where: {
        fundId,
        type: 'CONTRIBUTE',
        contributionStatus: 'APPROVED',
        reviewedAt: { not: null, gte: periodStart, lte: periodEnd },
      },
      select: { userId: true, amount: true },
    }),
  ])

  for (const d of deductRows) {
    add(d.userId, new Prisma.Decimal(0).sub(d.amount))
  }
  for (const c of contributeRows) {
    add(c.userId, c.amount)
  }

  return out
}

export async function computeGroupSettlementPreview(
  groupId: string,
  periodStart: Date,
  periodEnd: Date,
  db: SettlementPreviewDb = prisma,
): Promise<ComputedSettlementPreview> {
  const expenses = await db.expense.findMany({
    where: {
      groupId,
      status: 'ACTIVE',
      isStandalone: false,
      settlementId: null,
      expenseDate: { gte: periodStart, lte: periodEnd },
    },
    include: { splits: true },
    orderBy: [{ expenseDate: 'desc' }, { createdAt: 'desc' }],
  })

  const fundRow = await db.groupFund.findUnique({ where: { groupId }, select: { id: true } })
  const fundNetByUser = fundRow
    ? await fundNetByUserInPeriod(fundRow.id, periodStart, periodEnd, db)
    : new Map<string, Prisma.Decimal>()

  const expenseUserIds = new Set<string>()
  for (const e of expenses) {
    expenseUserIds.add(e.paidByUserId)
    for (const s of e.splits) {
      if (!s.isExcluded) expenseUserIds.add(s.userId)
    }
  }
  for (const uid of fundNetByUser.keys()) {
    expenseUserIds.add(uid)
  }

  const memberRows = await db.groupMember.findMany({
    where: { groupId, ...settlementParticipantMemberWhere },
    include: { user: { select: { id: true, name: true } } },
  })
  const memberUserIds = new Set(memberRows.map((m) => m.userId))

  const missingFromMembers = [...expenseUserIds].filter((id) => !memberUserIds.has(id))
  const extraUsers =
    missingFromMembers.length > 0
      ? await db.user.findMany({
          where: { id: { in: missingFromMembers }, isActive: true },
          select: { id: true, name: true },
        })
      : []

  const participantById = new Map<string, string>()
  for (const m of memberRows) participantById.set(m.userId, m.user.name)
  for (const u of extraUsers) {
    if (!participantById.has(u.id)) participantById.set(u.id, u.name)
  }

  const participantIds = [...participantById.keys()]

  const paid = new Map<string, Prisma.Decimal>()
  const owed = new Map<string, Prisma.Decimal>()
  for (const id of participantIds) {
    paid.set(id, new Prisma.Decimal(0))
    owed.set(id, new Prisma.Decimal(0))
  }

  for (const e of expenses) {
    const cur = paid.get(e.paidByUserId) ?? new Prisma.Decimal(0)
    paid.set(e.paidByUserId, cur.add(e.amount))
    for (const s of e.splits) {
      if (s.isExcluded) continue
      const o = owed.get(s.userId) ?? new Prisma.Decimal(0)
      owed.set(s.userId, o.add(s.amount))
    }
  }

  const balances: MemberBalance[] = participantIds.map((userId) => {
    const p = paid.get(userId) ?? new Prisma.Decimal(0)
    const o = owed.get(userId) ?? new Prisma.Decimal(0)
    const f = fundNetByUser.get(userId) ?? new Prisma.Decimal(0)
    const net = p.sub(o).add(f)
    return {
      userId,
      userName: participantById.get(userId) ?? 'Thành viên',
      totalPaid: String(p),
      totalOwed: String(o),
      fundNetInPeriod: f.toFixed(2),
      netBalance: String(net),
    }
  })

  type Acc = { userId: string; remaining: number }
  const debtors: Acc[] = []
  const creditors: Acc[] = []
  for (const b of balances) {
    const n = Number(b.netBalance)
    if (n < -0.005) debtors.push({ userId: b.userId, remaining: -n })
    else if (n > 0.005) creditors.push({ userId: b.userId, remaining: n })
  }
  debtors.sort((a, b) => b.remaining - a.remaining)
  creditors.sort((a, b) => b.remaining - a.remaining)

  const transfers: Transfer[] = []
  let i = 0
  let j = 0
  while (i < debtors.length && j < creditors.length) {
    const di = debtors[i]
    const cj = creditors[j]
    if (!di || !cj) break
    const amt = Math.min(di.remaining, cj.remaining)
    if (amt < 0.005) {
      if (di.remaining <= cj.remaining) i++
      else j++
      continue
    }
    transfers.push({
      fromUserId: di.userId,
      toUserId: cj.userId,
      amount: amt.toFixed(2),
    })
    di.remaining -= amt
    cj.remaining -= amt
    if (di.remaining < 0.005) i++
    if (cj.remaining < 0.005) j++
  }

  const totalNum = transfers.reduce((s, t) => s + Number(t.amount), 0)
  const totalAmount = new Prisma.Decimal(totalNum.toFixed(2))

  let periodExpensesTotal = new Prisma.Decimal(0)
  for (const e of expenses) {
    periodExpensesTotal = periodExpensesTotal.add(e.amount)
  }

  const touchedInPeriod = new Set<string>()
  for (const e of expenses) {
    touchedInPeriod.add(e.paidByUserId)
    for (const s of e.splits) {
      if (!s.isExcluded) touchedInPeriod.add(s.userId)
    }
  }
  for (const [uid, amt] of fundNetByUser) {
    if (!amt.isZero()) touchedInPeriod.add(uid)
  }
  for (const t of transfers) {
    touchedInPeriod.add(t.fromUserId)
    touchedInPeriod.add(t.toUserId)
  }

  const receiverCandidateUserIds =
    touchedInPeriod.size > 0
      ? participantIds.filter((id) => touchedInPeriod.has(id))
      : [...participantIds]

  const pool =
    receiverCandidateUserIds.length > 0
      ? balances.filter((b) => receiverCandidateUserIds.includes(b.userId))
      : balances

  let suggestedReceiver: { id: string; name: string } = { id: '', name: '' }
  if (pool.length > 0) {
    let best = pool[0]!
    for (const b of pool) {
      const bp = Number(b.totalPaid) + Number(b.fundNetInPeriod ?? 0)
      const ap = Number(best.totalPaid) + Number(best.fundNetInPeriod ?? 0)
      if (bp > ap) best = b
      else if (bp === ap && Number(b.netBalance) > Number(best.netBalance)) best = b
    }
    suggestedReceiver = { id: best.userId, name: best.userName }
  } else if (balances[0]) {
    suggestedReceiver = { id: balances[0].userId, name: balances[0].userName }
  }

  const expenseItems: SettlementPreviewExpenseItem[] = expenses.map((e) => ({
    id: e.id,
    title: e.title,
    amount: String(e.amount),
    expenseDate: e.expenseDate.toISOString(),
    paidBy: {
      id: e.paidByUserId,
      name: participantById.get(e.paidByUserId) ?? 'Thành viên',
    },
  }))

  const allowedBalanceIds = new Set(receiverCandidateUserIds)
  const anyFundInPeriod = [...fundNetByUser.values()].some((v) => !v.isZero())
  const anyExpenseInPeriod = expenses.length > 0
  const balancesForPreview =
    !anyExpenseInPeriod && !anyFundInPeriod
      ? []
      : balances.filter((b) => allowedBalanceIds.has(b.userId))

  return {
    balances: balancesForPreview,
    transactions: transfers,
    suggestedReceiver,
    receiverCandidateUserIds,
    totalAmount,
    periodExpensesTotal,
    expenseCount: expenses.length,
    expenses: expenseItems,
  }
}
