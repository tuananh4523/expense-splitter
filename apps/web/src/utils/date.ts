import { format, formatDistanceToNow, parseISO } from 'date-fns'
import { vi } from 'date-fns/locale'

function parseToDate(d: string | Date): Date | null {
  if (d instanceof Date) return Number.isNaN(d.getTime()) ? null : d
  if (typeof d !== 'string' || !d.trim()) return null
  const parsed = parseISO(d)
  return Number.isNaN(parsed.getTime()) ? null : parsed
}

export const fmtDate = (d: string | Date) => {
  const date = parseToDate(d)
  return date ? format(date, 'dd/MM/yyyy', { locale: vi }) : '—'
}

export const fmtDateTime = (d: string | Date) => {
  const date = parseToDate(d)
  return date ? format(date, 'HH:mm dd/MM/yyyy', { locale: vi }) : '—'
}

export const timeAgo = (d: string | Date) => {
  const date = parseToDate(d)
  return date ? formatDistanceToNow(date, { addSuffix: true, locale: vi }) : '—'
}
