import { prisma } from '@expense/database'

export type GroupOperationalCleanupResult = {
  commentsDeleted: number
  auditLogsDeleted: number
  groupActivityLogsDeleted: number
  fundTransactionsDeleted: number
  settlementsDeleted: number
  expensesDeleted: number
  paymentRecordsDeleted: number
  notificationsDeleted: number
}

/**
 * Giữ nguyên nhóm (tên, mô tả, avatar, icon, màu, thành viên, mời…).
 * Xóa: toàn bộ comment trong nhóm; log nhóm + audit; mọi giao dịch quỹ (reset số dư về 0);
 * các đợt tổng kết COMPLETED cùng chi tiêu thuộc đợt đó.
 */
export async function cleanupGroupOperationalData(
  groupId: string,
): Promise<GroupOperationalCleanupResult | null> {
  const exists = await prisma.group.findUnique({ where: { id: groupId }, select: { id: true } })
  if (!exists) return null

  return prisma.$transaction(
    async (tx) => {
      const fund = await tx.groupFund.findUnique({ where: { groupId }, select: { id: true } })
      let fundTransactionsDeleted = 0
      if (fund) {
        const fr = await tx.fundTransaction.deleteMany({ where: { fundId: fund.id } })
        fundTransactionsDeleted = fr.count
        await tx.groupFund.update({ where: { groupId }, data: { balance: 0 } })
      }

      const cDel = await tx.comment.deleteMany({ where: { expense: { groupId } } })

      const aDel = await tx.auditLog.deleteMany({
        where: { OR: [{ groupId }, { expense: { groupId } }] },
      })

      const completed = await tx.settlement.findMany({
        where: { groupId, status: 'COMPLETED' },
        select: { id: true },
      })
      const completedIds = completed.map((s) => s.id)

      let settlementsDeleted = 0
      let expensesDeleted = 0
      let paymentRecordsDeleted = 0
      let notificationsDeleted = 0

      if (completedIds.length > 0) {
        const expenseRows = await tx.expense.findMany({
          where: { groupId, settlementId: { in: completedIds } },
          select: { id: true },
        })
        const expenseIds = expenseRows.map((e) => e.id)

        if (expenseIds.length > 0) {
          const standalones = await tx.standalonePayment.findMany({
            where: { expenseId: { in: expenseIds } },
            select: { id: true },
          })
          const standaloneIds = standalones.map((s) => s.id)
          if (standaloneIds.length > 0) {
            const pr = await tx.paymentRecord.deleteMany({
              where: { standalonePaymentId: { in: standaloneIds } },
            })
            paymentRecordsDeleted += pr.count
          }
        }

        const prSet = await tx.paymentRecord.deleteMany({
          where: { settlementId: { in: completedIds } },
        })
        paymentRecordsDeleted += prSet.count

        const n = await tx.notification.deleteMany({
          where: { settlementId: { in: completedIds } },
        })
        notificationsDeleted = n.count

        if (expenseIds.length > 0) {
          const ex = await tx.expense.deleteMany({ where: { id: { in: expenseIds } } })
          expensesDeleted = ex.count
        }

        const st = await tx.settlement.deleteMany({ where: { id: { in: completedIds } } })
        settlementsDeleted = st.count
      }

      const ga = await tx.groupActivityLog.deleteMany({ where: { groupId } })

      return {
        commentsDeleted: cDel.count,
        auditLogsDeleted: aDel.count,
        groupActivityLogsDeleted: ga.count,
        fundTransactionsDeleted,
        settlementsDeleted,
        expensesDeleted,
        paymentRecordsDeleted,
        notificationsDeleted,
      }
    },
    { timeout: 120_000 },
  )
}
