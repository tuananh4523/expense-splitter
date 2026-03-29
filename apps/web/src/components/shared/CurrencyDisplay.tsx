import { formatVND } from '@/utils/currency'

/**
 * Khi colorize + số dương: mặc định xanh (success). Dùng `owe` cho tiền đang nợ (đỏ dù amount là số dương).
 */
export function CurrencyDisplay({
  amount,
  colorize = false,
  className,
  colorizeRole,
}: {
  amount: string | number
  colorize?: boolean
  className?: string
  /** owe = đang nợ (dương → đỏ), owed = được nợ (dương → xanh). Mặc định owed. */
  colorizeRole?: 'owe' | 'owed'
}) {
  const n = typeof amount === 'string' ? Number.parseFloat(amount) : amount
  const text = formatVND(amount)
  if (!colorize || Number.isNaN(n) || n === 0) {
    return <span className={className}>{text}</span>
  }
  const role = colorizeRole ?? 'owed'
  const color =
    n > 0 ? (role === 'owe' ? '#d63638' : '#00a32a') : '#d63638'
  return (
    <span className={className} style={{ color }}>
      {text}
    </span>
  )
}
