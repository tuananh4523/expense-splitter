import { prisma } from '@expense/database'
import * as Minio from 'minio'

const PRESIGN_SEC = 24 * 60 * 60

/**
 * MINIO_ENDPOINT hỗ trợ:
 * - URL đầy đủ: `http://192.168.1.5:9000` hoặc `https://files.example.com` (ưu tiên dùng cách này)
 * - Chỉ host: `minio` / `localhost` — kèm MINIO_PORT (mặc định 9000) và MINIO_USE_SSL
 * - host:port không scheme: `192.168.1.5:9000`
 */
export function parseMinioConnection(): { endPoint: string; port: number; useSSL: boolean } | null {
  const raw = process.env.MINIO_ENDPOINT?.trim()
  if (!raw) return null
  if (/^https?:\/\//i.test(raw)) {
    try {
      const u = new URL(raw)
      const useSSL = u.protocol === 'https:'
      const port = u.port
        ? Number(u.port)
        : Number(
            process.env.MINIO_PORT ?? (useSSL ? 443 : 9000),
          )
      return { endPoint: u.hostname, port, useSSL }
    } catch {
      return null
    }
  }
  const parts = raw.split(':')
  const host = parts[0]
  if (!host) return null
  const port = parts.length > 1 ? Number(parts[1]) : Number(process.env.MINIO_PORT ?? 9000)
  return {
    endPoint: host,
    port: Number.isFinite(port) ? port : 9000,
    useSSL: process.env.MINIO_USE_SSL === 'true',
  }
}

/** Base URL gắn object (bucket/key) khi không dùng presigned — ưu tiên MINIO_PUBLIC_URL. */
function minioPublicBaseUrl(): string {
  const explicit = process.env.MINIO_PUBLIC_URL?.trim()
  if (explicit) return explicit.replace(/\/$/, '')
  const raw = process.env.MINIO_ENDPOINT?.trim()
  if (raw && /^https?:\/\//i.test(raw)) {
    try {
      return new URL(raw).origin
    } catch {
      /* fallthrough */
    }
  }
  const conn = parseMinioConnection()
  if (!conn) return `http://localhost:${process.env.MINIO_PORT ?? '9000'}`
  const proto = conn.useSSL ? 'https' : 'http'
  if (conn.useSSL && conn.port === 443) return `${proto}://${conn.endPoint}`
  if (!conn.useSSL && conn.port === 80) return `${proto}://${conn.endPoint}`
  return `${proto}://${conn.endPoint}:${conn.port}`
}

function minioCredentials(): { accessKey: string; secretKey: string } | null {
  const accessKey = process.env.MINIO_ROOT_USER ?? process.env.MINIO_ACCESS_KEY
  const secretKey = process.env.MINIO_ROOT_PASSWORD ?? process.env.MINIO_SECRET_KEY
  if (!accessKey?.trim() || !secretKey?.trim()) return null
  return { accessKey: accessKey.trim(), secretKey: secretKey.trim() }
}

export function getMinioClient(): Minio.Client | null {
  const conn = parseMinioConnection()
  const cred = minioCredentials()
  if (!conn || !cred) return null
  const { accessKey, secretKey } = cred
  return new Minio.Client({
    endPoint: conn.endPoint,
    port: conn.port,
    useSSL: conn.useSSL,
    accessKey,
    secretKey,
  })
}

export function minioBucket(): string {
  return process.env.MINIO_BUCKET ?? 'expense-splitter'
}

export function publicObjectUrl(bucket: string, objectName: string): string {
  const base = minioPublicBaseUrl().replace(/\/$/, '')
  return `${base}/${bucket}/${objectName}`
}

export function parseStoredObject(stored: string): { bucket: string; objectName: string } | null {
  try {
    const pathname = new URL(stored).pathname.replace(/^\/+/, '')
    const slash = pathname.indexOf('/')
    if (slash === -1) return null
    const urlBucket = pathname.slice(0, slash)
    const objectName = pathname.slice(slash + 1)
    if (!objectName) return null
    return { bucket: urlBucket, objectName }
  } catch {
    return null
  }
}

async function viewerMayAccessObject(viewerUserId: string, bucket: string, objectName: string): Promise<boolean> {
  if (bucket !== minioBucket()) return false
  if (objectName.startsWith('avatars/')) {
    return true
  }
  const bqm = /^bank-qr\/([^/]+)\//.exec(objectName)
  if (bqm?.[1]) {
    const ownerId = bqm[1]
    if (ownerId === viewerUserId) return true
    const viewer = await prisma.user.findUnique({
      where: { id: viewerUserId },
      select: { role: true },
    })
    if (viewer?.role === 'ADMIN') return true
    const shared = await prisma.groupMember.findFirst({
      where: {
        isActive: true,
        leftAt: null,
        userId: ownerId,
        group: {
          members: { some: { userId: viewerUserId, isActive: true, leftAt: null } },
        },
      },
    })
    return !!shared
  }
  const fm = /^feedback\/([^/]+)\//.exec(objectName)
  if (fm?.[1]) {
    if (fm[1] === viewerUserId) return true
    const viewer = await prisma.user.findUnique({
      where: { id: viewerUserId },
      select: { role: true },
    })
    return viewer?.role === 'ADMIN'
  }
  const gm = /^groups\/([^/]+)\//.exec(objectName)
  if (gm?.[1]) {
    const gid = gm[1]
    const viewer = await prisma.user.findUnique({
      where: { id: viewerUserId },
      select: { role: true },
    })
    if (viewer?.role === 'ADMIN') return true
    const group = await prisma.group.findUnique({ where: { id: gid }, select: { isActive: true } })
    if (!group?.isActive) return false
    const m = await prisma.groupMember.findFirst({
      where: { groupId: gid, userId: viewerUserId, isActive: true, leftAt: null },
    })
    return !!m
  }
  return false
}

/**
 * URL xem object MinIO (bucket private): presigned GET nếu viewer được phép.
 * - avatars/*: mọi user đã đăng nhập (URL chỉ lộ qua API).
 * - groups/{groupId}/...: phải là thành viên nhóm.
 */
export async function signedStorageUrlForUser(
  stored: string | null,
  viewerUserId: string,
): Promise<string | null> {
  if (!stored) return null
  const client = getMinioClient()
  if (!client) return stored
  const parsed = parseStoredObject(stored)
  if (!parsed || parsed.bucket !== minioBucket()) return stored
  const ok = await viewerMayAccessObject(viewerUserId, parsed.bucket, parsed.objectName)
  if (!ok) return stored
  try {
    return await client.presignedGetObject(parsed.bucket, parsed.objectName, PRESIGN_SEC)
  } catch (e) {
    console.error('[minio] presignedGetObject failed:', e)
    return stored
  }
}

export async function avatarUrlForClient(
  stored: string | null,
  viewerUserId: string,
): Promise<string | null> {
  return signedStorageUrlForUser(stored, viewerUserId)
}
