/** Nhãn + màu Tag trạng thái — dùng chung bảng danh sách và drawer chi tiết. */
export const expenseStatusLabel: Record<string, string> = {
  ACTIVE: 'Hoạt động',
  SETTLED: 'Đã tổng kết',
  STANDALONE_DONE: 'Chi riêng xong',
}

export const expenseStatusColor: Record<string, string> = {
  ACTIVE: 'processing',
  SETTLED: 'success',
  STANDALONE_DONE: 'purple',
}

export function expenseLockedForEditDelete(status: string) {
  return status === 'SETTLED' || status === 'STANDALONE_DONE'
}
