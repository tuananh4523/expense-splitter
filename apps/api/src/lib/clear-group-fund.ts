import { Prisma } from '@expense/database'

/**
 * Xoá toàn bộ giao dịch quỹ nhóm và đặt số dư = 0 (dùng sau khi đợt tổng kết đóng xong).
 */
export async function clearGroupFundLedger(
  tx: Prisma.TransactionClient,
  groupId: string,
): Promise<{ hadFund: boolean; deletedCount: number }> {
  const fund = await tx.groupFund.findUnique({ where: { groupId }, select: { id: true } })
  if (!fund) return { hadFund: false, deletedCount: 0 }
  const del = await tx.fundTransaction.deleteMany({ where: { fundId: fund.id } })
  await tx.groupFund.update({
    where: { id: fund.id },
    data: { balance: new Prisma.Decimal(0) },
  })
  return { hadFund: true, deletedCount: del.count }
}
