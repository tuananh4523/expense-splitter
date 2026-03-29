/**
 * URL backend khi code chạy trên server Next (NextAuth, GSSP, v.v.).
 * `localhost` đôi khi resolve thành `::1` trong khi API Node chỉ lắng nghe IPv4 → ECONNREFUSED.
 * Đổi hostname `localhost` → `127.0.0.1`; giữ nguyên host khác (vd. Docker `api`).
 */
function normalizeBase(raw: string): string {
  try {
    const u = new URL(raw)
    if (u.hostname === 'localhost') {
      u.hostname = '127.0.0.1'
    }
    return u.toString().replace(/\/$/, '')
  } catch {
    return raw.replace(/\/$/, '')
  }
}

export function getServerApiBaseUrl(): string {
  const raw =
    process.env.INTERNAL_API_URL?.replace(/\/$/, '') ||
    process.env.NEXT_PUBLIC_API_URL?.replace(/\/$/, '') ||
    'http://127.0.0.1:4000'
  return normalizeBase(raw)
}

/**
 * Các URL backend để thử lần lượt khi gọi API từ server Next (đăng nhập, v.v.).
 * Nếu đặt INTERNAL_API_URL (Docker) thì chỉ dùng một URL đó.
 */
/** URL backend khi gọi từ trình duyệt (đăng ký, v.v.) — dùng `NEXT_PUBLIC_API_URL`. */
export function getBrowserApiBaseUrl(): string {
  const raw = process.env.NEXT_PUBLIC_API_URL?.trim()
  if (raw) {
    try {
      return new URL(raw).toString().replace(/\/$/, '')
    } catch {
      return raw.replace(/\/$/, '')
    }
  }
  return 'http://127.0.0.1:4000'
}

export function getServerApiCandidateBases(): string[] {
  const internal = process.env.INTERNAL_API_URL?.trim()
  if (internal) {
    try {
      return [new URL(internal).toString().replace(/\/$/, '')]
    } catch {
      return [getServerApiBaseUrl()]
    }
  }
  const primary = getServerApiBaseUrl()
  const np = process.env.NEXT_PUBLIC_API_URL?.replace(/\/$/, '')
  const fromPublic = np
    ? (() => {
        try {
          return new URL(np).toString().replace(/\/$/, '')
        } catch {
          return null
        }
      })()
    : null
  return [
    ...new Set([
      primary,
      ...(fromPublic ? [fromPublic] : []),
      'http://127.0.0.1:4000',
      'http://localhost:4000',
      'http://[::1]:4000',
    ]),
  ]
}
