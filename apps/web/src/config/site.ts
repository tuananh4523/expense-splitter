import { APP_NAME } from '@/config/app'

/** Mô tả mặc định cho meta / OG / chia sẻ link. */
export const SITE_DESCRIPTION = 'Phần mềm quản lý chi tiêu nhóm'

/**
 * URL gốc site (không có / cuối), dùng cho og:image / og:url / canonical.
 * - Dev: mặc định localhost (Facebook **không** lấy được ảnh preview từ link local).
 * - Production: **bắt buộc** `NEXT_PUBLIC_SITE_URL=https://your-domain` trong `.env` và **cùng giá trị lúc `next build`**
 *   (Docker: ARG/ENV trong `apps/web/Dockerfile` + `NEXT_PUBLIC_SITE_URL` trong `.env` gốc cho `compose build`).
 */
export function getPublicSiteUrl(): string {
  const raw = process.env.NEXT_PUBLIC_SITE_URL?.trim()
  if (raw) return raw.replace(/\/$/, '')
  return 'http://localhost:3000'
}

export function pageTitle(page?: string | null): string {
  if (page && page.trim() !== '') return `${page.trim()} — ${APP_NAME}`
  return APP_NAME
}
