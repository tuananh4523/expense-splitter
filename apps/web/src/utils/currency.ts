/** Tiền VND hiển thị (ví dụ 1.234.567 ₫). */
export const formatVND = (amount: number | string): string => {
  const n = typeof amount === 'string' ? Number.parseFloat(amount) : amount
  if (Number.isNaN(n)) return '—'
  return new Intl.NumberFormat('vi-VN', {
    style: 'currency',
    currency: 'VND',
    currencyDisplay: 'narrowSymbol',
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(n)
}

export const parseVND = (value: string): number =>
  Number.parseInt(value.replace(/[^\d-]/g, ''), 10) || 0

/** Nhập số tiền VN: ngăn cách hàng nghìn bằng dấu chấm (1.000.000). */
export const formatMoneyInputVN = (value: string | number | undefined): string => {
  if (value === undefined || value === '') return ''
  const digits = String(value).replace(/\D/g, '')
  if (!digits) return ''
  return digits.replace(/\B(?=(\d{3})+(?!\d))/g, '.')
}

export const parseMoneyInputVN = (value: string | undefined): number =>
  Number(value?.replace(/\./g, '').replace(/,/g, '') ?? 0) || 0
