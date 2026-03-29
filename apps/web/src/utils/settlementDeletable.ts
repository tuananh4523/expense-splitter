import type { SettlementDto } from '@expense/types'

/** Xoá được khi đợt chưa đóng (PENDING/DRAFT), hoặc tổng 0đ kể cả đã COMPLETED — không xoá đợt đã hoàn tất có số tiền > 0. */
export function isSettlementDeletable(s: SettlementDto): boolean {
  const amt = Number(s.totalAmount)
  if (s.status === 'COMPLETED' && Number.isFinite(amt) && amt > 0) return false
  return true
}
