import { InputNumber, type InputNumberProps } from 'antd'
import type { ClipboardEvent, KeyboardEvent } from 'react'

const NAV_KEYS = new Set([
  'Backspace',
  'Delete',
  'Tab',
  'Escape',
  'Enter',
  'ArrowLeft',
  'ArrowRight',
  'ArrowUp',
  'ArrowDown',
  'Home',
  'End',
])

/** Dùng cho InputNumber khác (vd. % chia) — chặn gõ/dán chữ. */
export function moneyDigitsKeyDown(
  user?: InputNumberProps['onKeyDown'],
): InputNumberProps['onKeyDown'] {
  return (e: KeyboardEvent<HTMLInputElement>) => {
    user?.(e)
    if (e.defaultPrevented) return
    if (e.ctrlKey || e.metaKey || e.altKey) return
    if (NAV_KEYS.has(e.key)) return
    if (e.key.length === 1 && /\d/.test(e.key)) return
    e.preventDefault()
  }
}

export function moneyDigitsPaste(user?: InputNumberProps['onPaste']): InputNumberProps['onPaste'] {
  return (e: ClipboardEvent<HTMLInputElement>) => {
    const raw = e.clipboardData.getData('text/plain').replace(/[\s.,]/g, '')
    if (raw && !/^\d+$/.test(raw)) {
      e.preventDefault()
    }
    user?.(e)
  }
}

/** Gõ chỉ chữ số; dán chỉ chuỗi gồm chữ số (bỏ qua dấu phẩy/ngăn cách). */
export function MoneyInputNumber({ onKeyDown, onPaste, ...props }: InputNumberProps) {
  return (
    <InputNumber
      {...props}
      onKeyDown={moneyDigitsKeyDown(onKeyDown)}
      onPaste={moneyDigitsPaste(onPaste)}
    />
  )
}
