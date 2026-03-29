import { prisma } from '@expense/database'
import { presignUploadSchema } from '@expense/types'
import { Hono } from 'hono'
import { z } from 'zod'
import { getMinioClient, minioBucket, publicObjectUrl, signedStorageUrlForUser } from '../lib/minio.js'
import { requireAuth } from '../middleware/auth.js'

const activeMemberWhere = { isActive: true, leftAt: null } as const

function safeFilename(name: string): string {
  return name.replace(/[^a-zA-Z0-9._-]/g, '_').slice(0, 80) || 'file'
}

export const uploadRoutes = new Hono<{
  Variables: { userId: string; userRole: string; sessionJti: string }
}>()
uploadRoutes.use('*', requireAuth)

const resolveViewsBody = z.object({
  urls: z.array(z.string().url()).max(40),
})

uploadRoutes.post('/resolve-views', async (c) => {
  const userId = c.get('userId')
  let body: unknown
  try {
    body = await c.req.json()
  } catch {
    return c.json({ error: 'Invalid JSON' }, 400)
  }
  const parsed = resolveViewsBody.safeParse(body)
  if (!parsed.success) {
    return c.json({ error: parsed.error.issues[0]?.message ?? 'Dữ liệu không hợp lệ' }, 400)
  }
  const resolved: Record<string, string> = {}
  await Promise.all(
    parsed.data.urls.map(async (u) => {
      const out = await signedStorageUrlForUser(u, userId)
      if (out) resolved[u] = out
    }),
  )
  return c.json({ data: { resolved } })
})

uploadRoutes.post('/presign', async (c) => {
  const userId = c.get('userId')
  let body: unknown
  try {
    body = await c.req.json()
  } catch {
    return c.json({ error: 'Invalid JSON' }, 400)
  }
  const parsed = presignUploadSchema.safeParse(body)
  if (!parsed.success) {
    return c.json({ error: parsed.error.issues[0]?.message ?? 'Dữ liệu không hợp lệ' }, 400)
  }

  const { filename, contentType, uploadType, groupId } = parsed.data

  if (uploadType !== 'avatar' && uploadType !== 'feedback' && uploadType !== 'bankQr' && groupId) {
    const g = await prisma.group.findUnique({ where: { id: groupId }, select: { isActive: true } })
    if (!g?.isActive) {
      return c.json({ error: 'Nhóm đã bị tạm khóa — không thể upload' }, 403)
    }
    const m = await prisma.groupMember.findFirst({
      where: { groupId, userId, ...activeMemberWhere },
    })
    if (!m) {
      return c.json({ error: 'Không có quyền upload cho nhóm này' }, 403)
    }
  }

  const client = getMinioClient()
  const bucket = minioBucket()
  if (!client) {
    return c.json({ error: 'Chưa cấu hình MinIO (MINIO_*)' }, 503)
  }

  const exists = await client.bucketExists(bucket).catch(() => false)
  if (!exists) {
    await client.makeBucket(bucket, 'us-east-1').catch(() => {
      /* may already exist */
    })
  }

  const prefix =
    uploadType === 'avatar'
      ? `avatars/${userId}`
      : uploadType === 'feedback'
        ? `feedback/${userId}`
        : uploadType === 'bankQr'
          ? `bank-qr/${userId}`
          : uploadType === 'expense'
            ? `groups/${groupId}/expenses`
            : `groups/${groupId}/payments`
  const objectName = `${prefix}/${Date.now()}-${safeFilename(filename)}`

  const uploadUrl = await client.presignedPutObject(bucket, objectName, 10 * 60)
  const viewUrl = publicObjectUrl(bucket, objectName)

  return c.json({
    data: {
      uploadUrl,
      objectName,
      viewUrl,
    },
  })
})
