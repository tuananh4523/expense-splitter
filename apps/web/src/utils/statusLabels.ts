/** Nhãn tiếng Việt cho enum trạng thái từ API */

export function paymentRecordStatusVi(status: string): string {
  const m: Record<string, string> = {
    PENDING: 'Chờ nộp chứng từ hoặc xác nhận nhận tiền',
    CONFIRMED: 'Chờ duyệt chứng từ',
    ACCEPTED: 'Đã duyệt',
    REJECTED: 'Đã từ chối',
  }
  return m[status] ?? status
}

/** Nhãn ngắn trên Tag; hover xem `paymentRecordStatusVi`. */
export function paymentRecordStatusShort(status: string): string {
  const m: Record<string, string> = {
    PENDING: 'Chờ xử lý',
    CONFIRMED: 'Chờ duyệt',
    ACCEPTED: 'Hoàn tất',
    REJECTED: 'Từ chối',
  }
  return m[status] ?? status
}

export function settlementStatusVi(status: string): string {
  const m: Record<string, string> = {
    DRAFT: 'Nháp',
    PENDING: 'Đang chờ thanh toán',
    COMPLETED: 'Hoàn tất',
  }
  return m[status] ?? status
}
