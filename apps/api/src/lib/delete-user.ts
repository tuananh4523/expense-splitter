import { prisma } from '@expense/database'

/**
 * Xóa user và dữ liệu trỏ tới user (RESTRICT trong DB). Thứ tự tôn trọng FK.
 * Settlement có receiverUserId nhưng không có FK tới User — vẫn xóa các đợt mà user là người nhận.
 */
export async function deleteUserAndRelatedData(userId: string): Promise<void> {
  await prisma.$transaction(async (tx) => {
    await tx.paymentRecord.deleteMany({
      where: { OR: [{ payerUserId: userId }, { receiverUserId: userId }] },
    })
    await tx.settlement.deleteMany({ where: { receiverUserId: userId } })
    await tx.fundTransaction.deleteMany({ where: { userId } })
    await tx.comment.deleteMany({ where: { userId } })
    await tx.expenseSplit.deleteMany({ where: { userId } })
    await tx.expense.deleteMany({ where: { paidByUserId: userId } })
    await tx.auditLog.deleteMany({ where: { userId } })
    await tx.groupMember.deleteMany({ where: { userId } })
    await tx.user.delete({ where: { id: userId } })
  })
}
