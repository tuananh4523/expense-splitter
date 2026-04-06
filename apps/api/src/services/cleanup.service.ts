import { prisma } from '@expense/database'

export async function cleanupOldDeletedExpenses() {
  const cutoffDate = new Date()
  cutoffDate.setDate(cutoffDate.getDate() - 7)

  const deletedExpenses = await prisma.expense.findMany({
    where: {
      deletedAt: {
        lt: cutoffDate,
      },
    },
    select: { id: true },
  })

  if (deletedExpenses.length === 0) {
    return 0
  }

  const expenseIds = deletedExpenses.map(e => e.id)

  await prisma.$transaction([
    prisma.comment.deleteMany({
      where: { expenseId: { in: expenseIds } },
    }),
    prisma.expenseSplit.deleteMany({
      where: { expenseId: { in: expenseIds } },
    }),
    prisma.auditLog.deleteMany({
      where: { expenseId: { in: expenseIds } },
    }),
    prisma.expense.deleteMany({
      where: { id: { in: expenseIds } },
    }),
  ])

  return expenseIds.length
}

