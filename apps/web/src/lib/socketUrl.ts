/** URL gốc của API (Socket.IO handshake) — trùng NEXT_PUBLIC_API_URL hoặc mặc định dev :4000. */
export function getSocketBaseUrl(): string {
  const env = process.env.NEXT_PUBLIC_API_URL
  if (env && env.trim().length > 0) {
    return env.replace(/\/$/, '')
  }
  if (typeof window !== 'undefined' && window.location.hostname === 'localhost') {
    return 'http://localhost:4000'
  }
  return typeof window !== 'undefined' ? window.location.origin : ''
}
