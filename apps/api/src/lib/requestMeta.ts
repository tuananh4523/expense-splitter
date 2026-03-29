import { getConnInfo } from '@hono/node-server/conninfo'
import type { Context } from 'hono'

function normalizeIp(addr: string): string {
  const t = addr.trim().slice(0, 64)
  if (t.startsWith('::ffff:')) return t.slice(7)
  return t
}

function socketRemoteIp(c: Context): string {
  try {
    const addr = getConnInfo(c).remote.address
    if (addr && typeof addr === 'string') return normalizeIp(addr)
  } catch {
    // Không chạy qua @hono/node-server hoặc thiếu env.incoming
  }
  return ''
}

/** IP client: ưu tiên header proxy/CDN, cuối cùng là địa chỉ socket (dev local). */
export function clientIp(c: Context): string {
  const xff = c.req.header('x-forwarded-for')
  if (xff) {
    const first = xff.split(',')[0]?.trim()
    if (first) return normalizeIp(first)
  }
  const cf = c.req.header('cf-connecting-ip')?.trim()
  if (cf) return normalizeIp(cf)
  const trueClient = c.req.header('true-client-ip')?.trim()
  if (trueClient) return normalizeIp(trueClient)
  const xr = c.req.header('x-real-ip')?.trim()
  if (xr) return normalizeIp(xr)
  const sock = socketRemoteIp(c)
  if (sock) return sock
  return ''
}

/** Nhãn hiển thị ngắn từ User-Agent (không cần thư viện ngoài). */
export function summarizeUserAgent(ua: string): string {
  if (!ua?.trim()) return 'Thiết bị không xác định'
  const u = ua.toLowerCase()
  let browser = 'Trình duyệt'
  if (u.includes('edg/')) browser = 'Edge'
  else if (u.includes('chrome') && !u.includes('edg')) browser = 'Chrome'
  else if (u.includes('safari') && !u.includes('chrome')) browser = 'Safari'
  else if (u.includes('firefox')) browser = 'Firefox'
  let os = ''
  if (u.includes('windows')) os = 'Windows'
  else if (u.includes('mac os')) os = 'macOS'
  else if (u.includes('android')) os = 'Android'
  else if (u.includes('iphone') || u.includes('ipad')) os = 'iOS'
  else if (u.includes('linux')) os = 'Linux'
  if (os) return `${browser} · ${os}`
  return browser
}
