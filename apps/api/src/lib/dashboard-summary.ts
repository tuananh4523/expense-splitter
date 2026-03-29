import { prisma, Prisma } from '@expense/database'

const activeMemberWhere = { isActive: true, leftAt: null } as const
const EPS = new Prisma.Decimal('0.005')

/** Nộp quỹ đã duyệt − khấu trừ quỹ ghi cho user (một nhóm). */
async function fundApprovedNetForUser(
  groupId: string,
  userId: string,
  db: typeof prisma = prisma,
): Promise<Prisma.Decimal> {
  const fund = await db.groupFund.findUnique({ where: { groupId }, select: { id: true } })
  if (!fund) return new Prisma.Decimal(0)
  const [contrib, deduct] = await Promise.all([
    db.fundTransaction.aggregate({
      where: {
        fundId: fund.id,
        userId,
        type: 'CONTRIBUTE',
        contributionStatus: 'APPROVED',
      },
      _sum: { amount: true },
    }),
    db.fundTransaction.aggregate({
      where: { fundId: fund.id, userId, type: 'DEDUCT' },
      _sum: { amount: true },
    }),
  ])
  const c = contrib._sum.amount ?? new Prisma.Decimal(0)
  const d = deduct._sum.amount ?? new Prisma.Decimal(0)
  return c.sub(d)
}

/**
 * Ước tính chênh lệch: **đã trả hộ bill + phần quỹ (duyệt, trừ khấu trừ) − phần chia bill**,
 * chỉ chi chung còn **ACTIVE** (gồm cả bill đang nằm trong đợt tổng kết chờ đóng). Khi đợt đóng xong bill → **SETTLED** và không còn vào tổng này.
 */
export async function unsettledSharedNetBalance(
  groupId: string,
  userId: string,
  db: typeof prisma = prisma,
): Promise<Prisma.Decimal> {
  const expenses = await db.expense.findMany({
    where: {
      groupId,
      status: 'ACTIVE',
      isStandalone: false,
    },
    select: {
      paidByUserId: true,
      amount: true,
      splits: { select: { userId: true, amount: true, isExcluded: true } },
    },
  })

  let paid = new Prisma.Decimal(0)
  let owed = new Prisma.Decimal(0)
  for (const e of expenses) {
    if (e.paidByUserId === userId) paid = paid.add(e.amount)
    for (const s of e.splits) {
      if (s.isExcluded) continue
      if (s.userId === userId) owed = owed.add(s.amount)
    }
  }
  const fundNet = await fundApprovedNetForUser(groupId, userId, db)
  return paid.add(fundNet).sub(owed)
}

/**
 * Theo từng thành viên: nộp quỹ (đã duyệt) · chi chung còn **ACTIVE** (kể cả đang trong đợt tổng kết chưa đóng):
 * - `paidShared` / `owedShared`: chỉ bill ACTIVE; khi đợt đóng xong → SETTLED, số liệu tab thành viên mới giảm.
 * - `netIou` = paid + fund − owed — trùng `unsettledSharedNetBalance` / «Đang nợ» trên Tổng quan
 */
export async function memberUnsettledFinancials(
  groupId: string,
  db: typeof prisma = prisma,
): Promise<{
  fundContributedByUser: Map<string, Prisma.Decimal>
  paidSharedByUser: Map<string, Prisma.Decimal>
  owedSharedByUser: Map<string, Prisma.Decimal>
  netIouByUser: Map<string, Prisma.Decimal>
}> {
  const members = await db.groupMember.findMany({
    where: { groupId, ...activeMemberWhere },
    select: { userId: true },
  })
  const userIds = members.map((m) => m.userId)
  const userIdSet = new Set(userIds)

  const fromFund = new Map<string, Prisma.Decimal>()
  for (const uid of userIds) fromFund.set(uid, new Prisma.Decimal(0))

  const fund = await db.groupFund.findUnique({ where: { groupId }, select: { id: true } })
  if (fund) {
    const contributes = await db.fundTransaction.groupBy({
      by: ['userId'],
      where: {
        fundId: fund.id,
        type: 'CONTRIBUTE',
        contributionStatus: 'APPROVED',
      },
      _sum: { amount: true },
    })
    for (const r of contributes) {
      if (userIdSet.has(r.userId)) {
        fromFund.set(r.userId, r._sum.amount ?? new Prisma.Decimal(0))
      }
    }
    const deducts = await db.fundTransaction.groupBy({
      by: ['userId'],
      where: { fundId: fund.id, type: 'DEDUCT' },
      _sum: { amount: true },
    })
    for (const r of deducts) {
      if (!userIdSet.has(r.userId)) continue
      const base = fromFund.get(r.userId) ?? new Prisma.Decimal(0)
      fromFund.set(r.userId, base.sub(r._sum.amount ?? new Prisma.Decimal(0)))
    }
  }

  const expenses = await db.expense.findMany({
    where: {
      groupId,
      status: 'ACTIVE',
      isStandalone: false,
    },
    select: {
      amount: true,
      paidByUserId: true,
      splits: { select: { userId: true, amount: true, isExcluded: true } },
    },
  })

  const paidSharedByUser = new Map<string, Prisma.Decimal>()
  const owedSharedByUser = new Map<string, Prisma.Decimal>()
  for (const uid of userIds) {
    paidSharedByUser.set(uid, new Prisma.Decimal(0))
    owedSharedByUser.set(uid, new Prisma.Decimal(0))
  }

  for (const e of expenses) {
    const p = paidSharedByUser.get(e.paidByUserId)
    if (p !== undefined) paidSharedByUser.set(e.paidByUserId, p.add(e.amount))
    for (const s of e.splits) {
      if (s.isExcluded) continue
      const o = owedSharedByUser.get(s.userId)
      if (o !== undefined) owedSharedByUser.set(s.userId, o.add(s.amount))
    }
  }

  const fundContributedByUser = new Map<string, Prisma.Decimal>()
  const netIouByUser = new Map<string, Prisma.Decimal>()
  for (const uid of userIds) {
    const fundNet = fromFund.get(uid)!
    fundContributedByUser.set(uid, fundNet)
    netIouByUser.set(
      uid,
      paidSharedByUser.get(uid)!.add(fundNet).sub(owedSharedByUser.get(uid)!),
    )
  }
  return { fundContributedByUser, paidSharedByUser, owedSharedByUser, netIouByUser }
}

export async function computeDashboardSummaryForUser(userId: string) {
  const memberships = await prisma.groupMember.findMany({
    where: { userId, ...activeMemberWhere, group: { isActive: true } },
    select: { groupId: true },
  })
  const groupIds = [...new Set(memberships.map((m) => m.groupId))]
  const participatingGroups = groupIds.length

  let totalDebt = new Prisma.Decimal(0)
  let totalCredit = new Prisma.Decimal(0)
  const debtGroupIds: string[] = []
  const creditGroupIds: string[] = []
  for (const gid of groupIds) {
    const net = await unsettledSharedNetBalance(gid, userId)
    if (net.lt(EPS.neg())) {
      totalDebt = totalDebt.add(net.neg())
      debtGroupIds.push(gid)
    } else if (net.gt(EPS)) {
      totalCredit = totalCredit.add(net)
      creditGroupIds.push(gid)
    }
  }

  const pendingWhere = {
    groupId: { in: groupIds },
    status: { in: ['DRAFT', 'PENDING'] as ('DRAFT' | 'PENDING')[] },
  }

  let pendingSettlementCount = 0
  const pendingSettlementGroupIdSet = new Set<string>()
  if (groupIds.length > 0) {
    pendingSettlementCount = await prisma.settlement.count({ where: pendingWhere })
    const pendingRows = await prisma.settlement.findMany({
      where: pendingWhere,
      select: { groupId: true },
    })
    for (const r of pendingRows) pendingSettlementGroupIdSet.add(r.groupId)
  }

  const pendingSettlementGroupIds = [...pendingSettlementGroupIdSet]

  return {
    participatingGroups,
    totalDebt: totalDebt.toFixed(2),
    totalCredit: totalCredit.toFixed(2),
    pendingSettlementCount,
    debtGroupIds,
    creditGroupIds,
    pendingSettlementGroupIds,
  }
}
