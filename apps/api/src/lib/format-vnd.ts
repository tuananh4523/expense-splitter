const vnd = new Intl.NumberFormat('vi-VN', {
  style: 'currency',
  currency: 'VND',
  minimumFractionDigits: 0,
})

function toNumber(amount: string | number | { toString(): string }): number {
  if (typeof amount === 'number') return amount
  const s = typeof amount === 'string' ? amount : String(amount)
  const n = Number.parseFloat(s)
  return Number.isFinite(n) ? n : Number.NaN
}

/** Tiền VND trong câu chữ (vd. 1.234.567 ₫) — khớp web `formatVND`. */
export function formatVndForSummary(amount: string | number | { toString(): string }): string {
  const n = toNumber(amount)
  if (Number.isNaN(n)) return typeof amount === 'string' ? amount : String(amount)
  return vnd.format(n)
}
