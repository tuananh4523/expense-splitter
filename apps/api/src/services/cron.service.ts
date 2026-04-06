import { prisma } from '@expense/database'
import dayjs from 'dayjs'
import { getIo } from '../realtime/socket.js'

export async function processDebtReminders() {
  const now = dayjs()

  const groups = await prisma.group.findMany({
    where: { debtReminderEnabled: true, isActive: true },
    select: { id: true, debtReminderDays: true },
  })

  let notifiedCount = 0

  for (const group of groups) {
    const cutOffDate = now.subtract(group.debtReminderDays, 'day').toDate()

    const overdueExpenses = await prisma.expense.findMany({
      where: {
        groupId: group.id,
        status: 'ACTIVE',
        expenseDate: { lt: cutOffDate },
        settlementId: null,
      },
      include: {
        splits: true,
        paidBy: true,
      },
    })

    for (const exp of overdueExpenses) {
      const debtors = exp.splits.filter(
        (s) => s.userId !== exp.paidByUserId && !s.isExcluded && Number(s.amount) > 0,
      )

      for (const debtor of debtors) {
        await prisma.notification.create({
          data: {
            userId: debtor.userId,
            type: 'DEBT_OVERDUE',
            title: 'Nhắc nợ chi tiêu quá hạn',
            body: `Khoản chi "${exp.title}" (${exp.amount} ${exp.currency}) đã quá hạn thanh toán ${group.debtReminderDays} ngày. Vui lòng thanh toán sớm!`,
            data: { expenseId: exp.id, groupId: group.id },
          },
        })

        getIo()?.to(`user:${debtor.userId}`).emit('notification_received', { type: 'DEBT_OVERDUE' })
        notifiedCount++
      }
    }
  }

  return notifiedCount
}
