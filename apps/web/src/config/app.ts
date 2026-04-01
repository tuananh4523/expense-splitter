import pkg from '../../package.json'

type WebPackageJson = typeof pkg & {
  author?: string
  authorSocial?: { github?: string; linkedin?: string }
}

const webPkg = pkg as WebPackageJson

const rawName = process.env.NEXT_PUBLIC_APP_NAME

/** Tên phần mềm hiển thị (sidebar, đăng nhập, v.v.). Gán `NEXT_PUBLIC_APP_NAME` trong `apps/web/.env`. */
export const APP_NAME =
  typeof rawName === 'string' && rawName.trim() !== '' ? rawName.trim() : 'Quản lý chi tiêu'

/**
 * Phiên bản hiển thị (góc header, đăng nhập) — **một nguồn**: `version` trong `apps/web/package.json`.
 * Đổi số hiển thị → sửa trường `version` rồi build lại.
 */
export const APP_VERSION = String(pkg.version ?? '').trim() || '0.0.0'

/** Tên tác giả (đọc từ `author` trong `apps/web/package.json`). */
export const APP_AUTHOR =
  typeof webPkg.author === 'string' && webPkg.author.trim() !== '' ? webPkg.author.trim() : 'Đỗ Văn Cường'

const ghId = webPkg.authorSocial?.github?.trim() || 'tuananh4523'
const liId = webPkg.authorSocial?.linkedin?.trim() || 'tuananh4523'

export const APP_AUTHOR_GITHUB_URL = `https://github.com/${ghId}`
export const APP_AUTHOR_LINKEDIN_URL = `https://www.linkedin.com/in/${liId}`
