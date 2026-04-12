const RESTORE_WINDOW_DAYS = 7

/** Còn trong cửa sổ khôi phục (đồng bộ với API 7 ngày). */
export function expenseCanRestore(deletedAt: string | null | undefined): boolean {
  if (!deletedAt) return false
  const deleted = new Date(deletedAt)
  const limit = new Date()
  limit.setDate(limit.getDate() - RESTORE_WINDOW_DAYS)
  return deleted >= limit
}
