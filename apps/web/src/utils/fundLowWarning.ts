/** Số dư quỹ đã chạm hoặc thấp hơn ngưỡng cảnh báo (ngưỡng > 0). */
export function isGroupFundAtOrBelowWarning(
  fundBalance: string | null | undefined,
  fundLowThreshold: string | null | undefined,
): boolean {
  if (fundBalance == null || fundLowThreshold == null) return false
  const bal = Number.parseFloat(fundBalance)
  const thr = Number.parseFloat(fundLowThreshold)
  if (Number.isNaN(bal) || Number.isNaN(thr)) return false
  if (thr <= 0) return false
  return bal <= thr
}
