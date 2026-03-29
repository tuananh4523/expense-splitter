import { getServerApiCandidateBases } from '@/lib/apiBaseUrl'

/**
 * Lấy role hiện tại từ API (DB) khi chạy trên server (GSSP).
 * JWT NextAuth có thể chưa kịp đồng bộ; gọi trực tiếp backend giống trình duyệt (Bearer).
 */
export async function fetchUserRoleFromAccessToken(accessToken: string): Promise<string | null> {
  for (const base of getServerApiCandidateBases()) {
    try {
      const res = await fetch(`${base}/api/users/me`, {
        headers: { Authorization: `Bearer ${accessToken}` },
        cache: 'no-store',
      })
      if (!res.ok) return null
      const j = (await res.json()) as { data?: { role?: string } }
      const r = j?.data?.role
      return typeof r === 'string' ? r : null
    } catch {
      continue
    }
  }
  return null
}
